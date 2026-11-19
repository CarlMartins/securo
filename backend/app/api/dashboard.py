import uuid
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.reports import _resolve_custom_range
from app.core.database import get_async_session
from app.core.workspace_context import WorkspaceContext, current_workspace
from app.schemas.dashboard import DashboardSummary, SpendingByCategory, MonthlyTrend, ProjectedTransaction, BalanceHistory, DashboardPeriod, PeriodBalance
from app.services import dashboard_service, dashboard_period_service

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/period", response_model=DashboardPeriod)
async def get_period(
    month: Optional[date] = Query(None),
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    account_ids: Optional[list[uuid.UUID]] = Query(None),
    ctx: WorkspaceContext = Depends(current_workspace),
    session: AsyncSession = Depends(get_async_session),
):
    start, end = _resolve_custom_range(from_date, to_date, allow_future=True)
    if start is not None and end is not None:
        if month is not None:
            raise HTTPException(status_code=422, detail="Choose a month or a date range")
        monthly = False
    elif month is not None and month.year < date.max.year:
        start, exclusive_end = dashboard_service._month_range(month)
        end = exclusive_end - timedelta(days=1)
        monthly = True
    else:
        raise HTTPException(status_code=422, detail="A month or date range is required")
    return await dashboard_period_service.get_period(
        session, ctx.workspace.id, ctx.user_id, ctx.user.primary_currency,
        start, end, account_ids, monthly=monthly,
    )


@router.get("/balance-period", response_model=PeriodBalance)
async def get_balance_period(
    from_date: date = Query(alias="from"),
    to_date: date = Query(alias="to"),
    account_ids: Optional[list[uuid.UUID]] = Query(None),
    ctx: WorkspaceContext = Depends(current_workspace),
    session: AsyncSession = Depends(get_async_session),
):
    _resolve_custom_range(from_date, to_date, allow_future=True)
    if (from_date - date.min).days <= (to_date - from_date).days + 1:
        raise HTTPException(status_code=422, detail="Previous period is before the calendar's start")
    return await dashboard_period_service.get_period_balance(
        session, ctx.workspace.id, ctx.user.primary_currency, from_date, to_date, account_ids,
    )


@router.get("/summary", response_model=DashboardSummary)
async def get_summary(
    month: Optional[date] = Query(None),
    balance_date: Optional[date] = Query(None),
    account_ids: Optional[list[uuid.UUID]] = Query(None),
    asset_group_ids: Optional[list[uuid.UUID]] = Query(None),
    ctx: WorkspaceContext = Depends(current_workspace),
    session: AsyncSession = Depends(get_async_session),
):
    return await dashboard_service.get_summary(
        session, ctx.workspace.id, ctx.user_id, month, balance_date, account_ids,
        asset_group_ids,
    )


@router.get("/spending-by-category", response_model=list[SpendingByCategory])
async def get_spending_by_category(
    month: Optional[date] = Query(None),
    account_ids: Optional[list[uuid.UUID]] = Query(None),
    ctx: WorkspaceContext = Depends(current_workspace),
    session: AsyncSession = Depends(get_async_session),
):
    return await dashboard_service.get_spending_by_category(
        session, ctx.workspace.id, ctx.user_id, month, account_ids
    )


@router.get("/monthly-trend", response_model=list[MonthlyTrend])
async def get_monthly_trend(
    months: int = Query(6, ge=1, le=12),
    account_ids: Optional[list[uuid.UUID]] = Query(None),
    ctx: WorkspaceContext = Depends(current_workspace),
    session: AsyncSession = Depends(get_async_session),
):
    return await dashboard_service.get_monthly_trend(
        session, ctx.workspace.id, ctx.user_id, months, account_ids
    )


@router.get("/balance-history", response_model=BalanceHistory)
async def get_balance_history(
    month: Optional[date] = Query(None),
    account_ids: Optional[list[uuid.UUID]] = Query(None),
    comparison_months: Optional[list[date]] = Query(None),
    ctx: WorkspaceContext = Depends(current_workspace),
    session: AsyncSession = Depends(get_async_session),
) -> BalanceHistory:
    try:
        return await dashboard_service.get_balance_history(
            session, ctx.workspace.id, ctx.user_id, month, account_ids, comparison_months
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/balance-history/months", response_model=list[str])
async def get_balance_history_months(
    account_ids: Optional[list[uuid.UUID]] = Query(None),
    ctx: WorkspaceContext = Depends(current_workspace),
    session: AsyncSession = Depends(get_async_session),
):
    return await dashboard_service.get_balance_history_months(
        session, ctx.workspace.id, account_ids
    )


@router.get("/projected-transactions", response_model=list[ProjectedTransaction])
async def get_projected_transactions(
    month: Optional[date] = Query(None),
    account_id: Optional[uuid.UUID] = Query(None),
    account_ids: Optional[list[uuid.UUID]] = Query(None),
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    ctx: WorkspaceContext = Depends(current_workspace),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        return await dashboard_service.get_projected_transactions(
            session,
            ctx.workspace.id,
            ctx.user_id,
            month,
            account_id=account_id,
            account_ids=account_ids,
            from_date=from_date,
            to_date=to_date,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
