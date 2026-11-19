import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.app_clock import app_today
from app.core.database import get_async_session
from app.core.workspace_context import WorkspaceContext, current_workspace
from app.schemas.report import (
    CategoryStatementResponse, ReportDataRange, ReportResponse,
    ReportTransactionItem, ReportTransactionsResponse,
)
from app.services.account_service import get_account_name
from app.services.admin_service import get_credit_card_accounting_mode
from app.services.report_contributions import ReportGroup, load_contributions, select_contributions
from app.services import category_statement_service, report_service

router = APIRouter(prefix="/api/reports", tags=["reports"])

# Cap the user-picked custom range so wide windows can't tie up the DB with
# per-day snapshot fan-out. Ten years covers every realistic personal-finance
# question and stays inside the existing daily-interval budget.
_MAX_CUSTOM_RANGE_YEARS = 10


def _add_years(value: date, years: int) -> date:
    """Add whole calendar years to a date.

    Clamps Feb 29 to Feb 28 when the target year isn't a leap year, so the
    result is always a valid calendar date rather than raising.
    """
    if value.year + years > date.max.year:
        return date.max
    try:
        return value.replace(year=value.year + years)
    except ValueError:
        return date(value.year + years, 2, 28)


def _financial_year_start_month(tax_jurisdiction: str | None) -> int:
    """Return the first month of the workspace's financial year."""
    return 4 if (tax_jurisdiction or "").upper() == "IN" else 1


def _reject_unsupported_fiscal_year_report(
    period: str | None, interval: str, financial_year_start_month: int
) -> None:
    if period == "ytd" and interval == "yearly" and financial_year_start_month != 1:
        raise HTTPException(
            status_code=422,
            detail="Yearly YTD reports are not supported for non-calendar financial years",
        )


def _resolve_custom_range(
    start_date: date | None, end_date: date | None, *, allow_future: bool = False
) -> tuple[date | None, date | None]:
    """Validate a user-supplied custom range and return the (start, end) pair.

    Both endpoints must be provided together; the range must be non-empty,
    end no later than today and stay within :data:`_MAX_CUSTOM_RANGE_YEARS`
    calendar years of start_date. Returns ``(None, None)`` when neither is
    set, so callers can use presets.
    """
    if start_date is None and end_date is None:
        return None, None
    if start_date is None or end_date is None:
        raise HTTPException(
            status_code=422,
            detail="start_date and end_date must be provided together",
        )
    if end_date < start_date:
        raise HTTPException(
            status_code=422,
            detail="end_date must be on or after start_date",
        )
    # The app's calendar, not the host clock: the workspace's request runs
    # on its own timezone (see the `current_workspace` dependency), and the
    # service below builds the same window from `app_today()`. Comparing
    # against a different calendar would reject the workspace's own today
    # or accept a date the workspace has not reached yet.
    if not allow_future and end_date > app_today():
        raise HTTPException(
            status_code=422,
            detail="end_date must be on or before today",
        )
    max_end_date = _add_years(start_date, _MAX_CUSTOM_RANGE_YEARS)
    if end_date > max_end_date:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Custom range is too wide (max {_MAX_CUSTOM_RANGE_YEARS} years)"
            ),
        )
    return start_date, end_date


@router.get("/data-range", response_model=ReportDataRange)
async def get_data_range(
    ctx: WorkspaceContext = Depends(current_workspace),
    session: AsyncSession = Depends(get_async_session),
):
    """The span of transaction data this workspace actually has.

    The Reports page builds its year picker from these bounds (issue #765).
    Opening balances are excluded: their dates are synthetic. Both bounds
    are null when the workspace has no reportable transactions.
    """
    min_date, max_date = await report_service.get_report_data_range(
        session, ctx.workspace.id
    )
    return ReportDataRange(
        min_date=min_date.isoformat() if min_date else None,
        max_date=max_date.isoformat() if max_date else None,
    )


@router.get("/net-worth", response_model=ReportResponse)
async def get_net_worth(
    months: int = Query(12, ge=1, le=24),
    interval: str = Query("monthly", pattern="^(daily|weekly|monthly|yearly)$"),
    account_ids: Optional[list[uuid.UUID]] = Query(None),
    asset_group_ids: Optional[list[uuid.UUID]] = Query(None),
    period: str | None = Query(None, pattern="^ytd$"),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    ctx: WorkspaceContext = Depends(current_workspace),
    session: AsyncSession = Depends(get_async_session),
):
    financial_year_start_month = _financial_year_start_month(ctx.workspace.tax_jurisdiction)
    custom_start, custom_end = _resolve_custom_range(start_date, end_date)
    effective_period = None if custom_start is not None else period
    _reject_unsupported_fiscal_year_report(
        effective_period, interval, financial_year_start_month
    )
    return await report_service.get_net_worth_report(
        session, ctx.workspace.id, ctx.user_id, months, interval, ctx.user.primary_currency,
        account_ids=account_ids, asset_group_ids=asset_group_ids, period=effective_period,
        financial_year_start_month=financial_year_start_month,
        start_date=custom_start, end_date=custom_end,
    )


def _parse_statuses(value: str | None) -> tuple[str, ...] | None:
    if value is None:
        return None
    if value not in {"posted", "pending", "posted,pending", "pending,posted"}:
        raise HTTPException(status_code=422, detail="Invalid report statuses")
    return tuple(value.split(","))


@router.get("/income-expenses", response_model=ReportResponse)
async def get_income_expenses(
    months: int = Query(12, ge=1, le=24),
    interval: str = Query("monthly", pattern="^(daily|weekly|monthly|yearly)$"),
    account_ids: Optional[list[uuid.UUID]] = Query(None),
    period: str | None = Query(None, pattern="^ytd$"),
    days: Optional[int] = Query(None, ge=1, le=730),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    statuses: str | None = Query(None),
    ctx: WorkspaceContext = Depends(current_workspace),
    session: AsyncSession = Depends(get_async_session),
):
    """`days` overrides `months` with an exact rolling window ending today.

    Alternatively `start_date`/`end_date` (both required together) pin the
    window to an explicit historical calendar range, overriding `months`,
    `period`, and `days`. Custom ranges include actuals only, without estimates.
    """
    financial_year_start_month = _financial_year_start_month(ctx.workspace.tax_jurisdiction)
    selected_statuses = _parse_statuses(statuses)
    custom_start, custom_end = _resolve_custom_range(
        start_date, end_date, allow_future=selected_statuses is not None,
    )
    effective_period = None if custom_start is not None else period
    _reject_unsupported_fiscal_year_report(
        effective_period, interval, financial_year_start_month
    )
    return await report_service.get_income_expenses_report(
        session, ctx.workspace.id, ctx.user_id, months, interval, ctx.user.primary_currency,
        account_ids=account_ids, period=effective_period, days=days,
        financial_year_start_month=financial_year_start_month,
        start_date=custom_start, end_date=custom_end,
        **({"statuses": selected_statuses} if selected_statuses is not None else {}),
    )


@router.get("/income-expenses/transactions", response_model=ReportTransactionsResponse)
async def get_income_expense_transactions(
    start_date: date,
    end_date: date,
    group: ReportGroup,
    selection_from: date | None = None,
    selection_to: date | None = None,
    category: uuid.UUID | str | None = None,
    statuses: str | None = None,
    account_ids: list[uuid.UUID] | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    ctx: WorkspaceContext = Depends(current_workspace),
    session: AsyncSession = Depends(get_async_session),
):
    _resolve_custom_range(start_date, end_date, allow_future=True)
    selected_statuses = _parse_statuses(statuses) or ("posted",)
    uncategorized = category == "uncategorized"
    if category is not None and not uncategorized:
        try:
            category = uuid.UUID(str(category))
        except ValueError as exc:
            raise HTTPException(status_code=422, detail="Invalid report category") from exc

    currency = ctx.user.primary_currency
    mode = await get_credit_card_accounting_mode(session)
    observed, _ = await load_contributions(
        session, ctx.workspace.id, ctx.user_id, currency, mode,
        start_date, min(end_date, app_today()), selected_statuses, account_ids,
    )
    rows = select_contributions(
        observed, group=group, uncategorized=uncategorized,
        category_ids={category} if isinstance(category, uuid.UUID) else None,
        start=selection_from, end=selection_to,
    )
    offset = (page - 1) * limit
    items = []
    for part, value in list(rows.values())[offset:offset + limit]:
        tx = part.transaction
        account = tx.account if not part.shared else None
        items.append(ReportTransactionItem(
            id=str(tx.id), description=tx.description,
            notes=tx.notes if not part.shared else None,
            account_name=get_account_name(account) if account else None,
            account_number=account.masked_number if account else None,
            date=part.day.isoformat(), bank_date=tx.date.isoformat(),
            status=tx.status, amount=value,
        ))
    return ReportTransactionsResponse(
        items=items, total=len(rows), currency=currency,
        total_amount=sum((value for _, value in rows.values()), Decimal(0)),
    )


@router.get("/cash-flow", response_model=ReportResponse)
async def get_cash_flow(
    months: int = Query(6, ge=1, le=12),
    interval: str = Query("daily", pattern="^(daily|weekly|monthly)$"),
    baseline: bool = Query(False),
    account_ids: Optional[list[uuid.UUID]] = Query(None),
    ctx: WorkspaceContext = Depends(current_workspace),
    session: AsyncSession = Depends(get_async_session),
):
    return await report_service.get_cash_flow_report(
        session, ctx.workspace.id, ctx.user_id, months, interval, ctx.user.primary_currency,
        baseline=baseline, account_ids=account_ids,
    )


@router.get("/category-statement", response_model=CategoryStatementResponse)
async def get_category_statement(
    month: str | None = Query(None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
    months: int = Query(3, ge=1, le=12),
    account_ids: Optional[list[uuid.UUID]] = Query(None),
    ctx: WorkspaceContext = Depends(current_workspace),
    session: AsyncSession = Depends(get_async_session),
):
    """Net income and expenses per category group for `month` (YYYY-MM,
    default the current month) and the `months - 1` months before it."""
    selected = (
        date.fromisoformat(f"{month}-01") if month else app_today().replace(day=1)
    )
    return await category_statement_service.get_category_statement(
        session, ctx.workspace.id, ctx.user_id, selected, months,
        primary_currency=ctx.user.primary_currency, account_ids=account_ids,
    )
