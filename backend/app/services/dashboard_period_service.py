"""Dashboard calculations for observed activity and date-based balance comparisons."""

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.app_clock import app_today
from app.models.category import Category
from app.schemas.dashboard import DashboardPeriod, PeriodSpending, PeriodBalance, PeriodBalancePoint
from app.services.admin_service import get_credit_card_accounting_mode
from app.services.custom_income_expenses import project_amounts
from app.services.dashboard_service import _balance_at, _balance_history_account_ids, _daily_balance_deltas_by_date
from app.services.report_contributions import ALL_STATUSES, load_contributions


async def get_period(
    session: AsyncSession, workspace_id: UUID, user_id: UUID, currency: str,
    start: date, end: date, account_ids: list[UUID] | None, *, monthly: bool,
) -> DashboardPeriod:
    mode = await get_credit_card_accounting_mode(session)
    observed, missing_fx = await load_contributions(
        session, workspace_id, user_id, currency, mode,
        start, min(end, app_today()), ALL_STATUSES, account_ids,
    )
    projected = (
        await project_amounts(session, workspace_id, user_id, currency, mode, start, end, account_ids, observed)
        if monthly and account_ids != [] else []
    )

    expense_categories = {}
    expense_by_category = defaultdict(Decimal)
    projection_by_category = defaultdict(Decimal)
    amounts = defaultdict(Decimal)
    uncategorized = set()
    uncategorized_amount = Decimal(0)
    for part in observed:
        if part.group == "investments":
            continue
        amounts[part.group, part.transaction.status] += part.amount
        if part.category_id is None:
            uncategorized.add(part.transaction.id)
            uncategorized_amount += part.amount
        if part.group == "expenses":
            expense_categories[part.category_id] = (part.label, part.color)
            expense_by_category[part.category_id] += part.amount

    projected_amounts = defaultdict(Decimal)
    for part in projected:
        projected_amounts[part.group] += part.value
        if part.group == "expenses":
            category_id = UUID(part.category) if part.category != "uncategorized" else None
            expense_categories.setdefault(category_id, (part.label, part.color))
            projection_by_category[category_id] += part.value

    category_ids = [key for key in expense_categories if key is not None]
    icons = dict((await session.execute(
        select(Category.id, Category.icon).where(Category.id.in_(category_ids))
    )).all()) if category_ids else {}
    spending = [
        PeriodSpending(
            category_id=category_id, category_name=label, category_color=color,
            category_icon=icons.get(category_id) or "circle-help",
            total=expense_by_category[category_id],
            projected_total=expense_by_category[category_id] + projection_by_category[category_id],
        )
        for category_id, (label, color) in expense_categories.items()
    ]

    return DashboardPeriod(
        currency=currency,
        posted_income=amounts["income", "posted"],
        pending_income=amounts["income", "pending"],
        posted_expenses=amounts["expenses", "posted"],
        pending_expenses=amounts["expenses", "pending"],
        additional_projected_income=projected_amounts["income"],
        additional_projected_expenses=projected_amounts["expenses"],
        spending=spending,
        missing_fx_count=len(missing_fx),
        uncategorized_count=len(uncategorized),
        uncategorized_amount=uncategorized_amount,
    )


async def get_period_balance(
    session: AsyncSession, workspace_id: UUID, currency: str,
    start: date, end: date, account_ids: list[UUID] | None,
) -> PeriodBalance:
    length = (end - start).days + 1
    comparison_end = start - timedelta(days=1)
    comparison_start = start - timedelta(days=length)
    today = app_today()
    account_ids = await _balance_history_account_ids(session, workspace_id, account_ids)
    cutoff = min(end, today)
    deltas = await _daily_balance_deltas_by_date(
        session, workspace_id, comparison_start, cutoff + timedelta(days=1),
        primary_currency_hint=currency, account_ids=account_ids,
    ) if comparison_start <= cutoff else {}

    async def series(first: date) -> list[PeriodBalancePoint]:
        opening = await _balance_at(
            session, workspace_id, first - timedelta(days=1),
            primary_currency_hint=currency, account_ids=account_ids,
        ) if first <= today else None
        change = 0.0
        result = []
        for offset in range(length):
            day = first + timedelta(days=offset)
            change += deltas.get(day, 0.0)
            result.append(PeriodBalancePoint(
                date=day,
                balance=round(opening + change, 2) if opening is not None and day <= today else None,
                change=round(change, 2) if day <= today else None,
            ))
        return result

    return PeriodBalance(
        currency=currency, comparison_from=comparison_start, comparison_to=comparison_end,
        current=await series(start), comparison=await series(comparison_start),
    )
