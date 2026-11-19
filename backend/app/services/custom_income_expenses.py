"""Aggregation for the explicitly status-scoped income/expense report."""

import uuid
from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Callable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.category import Category
from app.models.transaction import Transaction
from app.models.transaction_category_line import TransactionCategoryLine
from app.schemas.report import (
    CategoryTrendItem,
    ReportBreakdown,
    ReportCompositionItem,
    ReportDataPoint,
    ReportMeta,
    ReportResponse,
    ReportSummary,
)
from app.services import invoice_forecast_service
from app.services._query_filters import (
    forecast_owner_share_fractions,
    reporting_date_col,
    reporting_date_value,
    user_pnl_parts,
)
from app.services.dashboard_service import (
    _get_forecast_transactions,
    _get_recurring_projections,
    _month_range,
)
from app.services.fx_rate_service import convert_or_none
from app.services.report_contributions import (
    ZERO,
    allocate_cents,
    load_contributions,
    provider_identity,
)


@dataclass(frozen=True)
class Amount:
    day: date
    category: str
    label: str
    color: str
    group: str
    value: Decimal
    projected: bool = False


async def project_amounts(
    session, workspace_id, user_id, currency, accounting_mode,
    start, end, account_ids, observed,
) -> list[Amount]:
    observed_ids = {part.transaction.id for part in observed}
    observed_keys = {key for part in observed if (key := provider_identity(part.transaction))}
    amounts: list[Amount] = []

    def append(day, category_id, category, group, value):
        if value:
            amounts.append(Amount(
                day, str(category_id) if category_id else "uncategorized",
                category.name if category else "Uncategorized",
                (category.color if category else None) or "#6B7280",
                group, value, projected=True,
            ))

    async def convert(amount, source, day):
        value, _ = await convert_or_none(
            session, amount, source, currency, day, allow_fetch=False,
        )
        return value

    cursor = start
    while cursor <= end:
        _, month_end = _month_range(cursor)
        virtual = await _get_recurring_projections(session, workspace_id, cursor, month_end, account_ids)
        category_ids = {row["category_id"] for row in virtual if row["category_id"]}
        categories = {row.id: row for row in (await session.scalars(
            select(Category).where(Category.id.in_(category_ids))
        )).all()} if category_ids else {}
        for row in virtual:
            value = await convert(Decimal(str(row["amount"])), row["currency"], row["date"])
            append(
                row["date"], row["category_id"], categories.get(row["category_id"]),
                "income" if row["type"] == "credit" else "expenses", value,
            )

        forecast = [
            tx for tx in await _get_forecast_transactions(
                session, workspace_id, cursor, month_end, account_ids,
                range_date_col=reporting_date_col(accounting_mode),
            )
            if tx.id not in observed_ids and provider_identity(tx) not in observed_keys
        ]
        if forecast:
            # Forecast helpers load the transaction and account, while this
            # calculation also needs each line's own category.
            (await session.scalars(
                select(Transaction).where(Transaction.id.in_([tx.id for tx in forecast]))
                .options(selectinload(Transaction.category_lines).selectinload(TransactionCategoryLine.category))
            )).all()
        fractions = (
            await forecast_owner_share_fractions(session, user_id, forecast)
            if account_ids is None and forecast else {}
        )
        for tx in forecast:
            day = reporting_date_value(tx, accounting_mode)
            group = "income" if tx.type == "credit" else "expenses"
            parts = user_pnl_parts(tx)
            if not parts:
                continue
            base = (
                abs(tx.amount_primary)
                if tx.amount_primary is not None and tx.user_id == user_id and tx.currency != currency
                else await convert(abs(tx.amount), tx.currency, tx.date)
            )
            if base is None:
                continue
            base *= fractions.get(tx.id, Decimal(1))
            allocated = allocate_cents([(str(i), base * ratio) for i, (_, _, ratio) in enumerate(parts)])
            for i, (category_id, category, _) in enumerate(parts):
                append(day, category_id, category, group, allocated[str(i)])

        if account_ids is None:
            for claim in await invoice_forecast_service.claims_in_range(
                session, workspace_id, cursor, month_end,
            ):
                value = await convert(claim.amount, claim.currency, claim.due_date)
                append(
                    claim.due_date, None, None,
                    "income" if claim.direction == "receivable" else "expenses", value,
                )
        cursor = month_end
    return amounts


async def build_report(
    session: AsyncSession,
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    currency: str,
    accounting_mode: str,
    start: date,
    end: date,
    statuses: tuple[str, ...],
    account_ids: list[uuid.UUID] | None,
    include_forecasts: bool,
    interval: str,
    labels: list[str],
    format_label: Callable[[date, str], str],
    trend_limit: int,
) -> ReportResponse:
    observed, missing_fx = await load_contributions(
        session, workspace_id, user_id, currency, accounting_mode, start, end, statuses, account_ids,
    )
    amounts = [
        Amount(part.day, str(part.category_id) if part.category_id else "uncategorized",
               part.label, part.color, part.group, part.amount)
        for part in observed
    ]
    if include_forecasts and account_ids != []:
        amounts.extend(await project_amounts(
            session, workspace_id, user_id, currency, accounting_mode,
            start, end, account_ids, observed,
        ))

    period_totals = defaultdict(lambda: defaultdict(Decimal))
    totals = defaultdict(Decimal)
    categories: dict[tuple[str, str], Amount] = {}
    observed_by_category = defaultdict(Decimal)
    forecast_by_category = defaultdict(Decimal)
    observed_by_period = defaultdict(Decimal)
    forecast_by_period = defaultdict(Decimal)
    for row in amounts:
        label = format_label(row.day, interval)
        key = (row.category, row.group)
        categories[key] = row
        if row.projected:
            forecast_by_category[key] += row.value
            forecast_by_period[(label, key)] += row.value
        else:
            observed_by_category[key] += row.value
            observed_by_period[(label, key)] += row.value
        if row.group != "investments":
            series = (
                {"income": "projectedIncome", "expenses": "projectedExpenses"}[row.group]
                if row.projected else row.group
            )
            period_totals[label][series] += row.value
            totals[series] += row.value

    series_meta = (
        ("income", "Income", "#10B981"), ("expenses", "Expenses", "#F43F5E"),
        ("projectedIncome", "Projected Income", "#34D399"),
        ("projectedExpenses", "Projected Expenses", "#FB7185"),
        ("netIncome", "Net Income", "#6366F1"),
    )
    totals["netIncome"] = totals["income"] - totals["expenses"]

    def composition_item(key, actual, projected):
        row = categories[key]
        return ReportCompositionItem(
            key=row.category, label=row.label, color=row.color, group=row.group,
            value=float(actual + projected), projected_value=float(projected),
        )

    keys_by_period = defaultdict(set)
    for label, key in observed_by_period.keys() | forecast_by_period.keys():
        keys_by_period[label].add(key)
    trend = []
    for label in labels:
        period = period_totals[label]
        trend.append(ReportDataPoint(
            date=label, value=float(period["income"] - period["expenses"]),
            breakdowns={key: float(period[key]) for key, _, _ in series_meta[:-1]},
            composition=[
                composition_item(key, observed_by_period[(label, key)], forecast_by_period[(label, key)])
                for key in sorted(keys_by_period[label])
            ],
        ))

    category_trend = []
    for group in ("expenses", "income"):
        group_keys = sorted(
            (key for key in categories if key[1] == group),
            key=lambda key: (-(observed_by_category[key] + forecast_by_category[key]), key),
        )
        top = [(key[0], categories[key].label, categories[key].color, [key]) for key in group_keys[:trend_limit]]
        if group_keys[trend_limit:]:
            top.append(("other", "Other", "#6B7280", group_keys[trend_limit:]))
        for key, label, color, members in top:
            projected = sum(forecast_by_category[item] for item in members)
            category_trend.append(CategoryTrendItem(
                key=key, label=label, color=color, group=group, projected_value=float(projected),
                total=float(sum(observed_by_category[item] for item in members) + projected),
                series=[
                    ReportDataPoint(date=day, breakdowns={}, value=float(sum(
                        observed_by_period[(day, item)] + forecast_by_period[(day, item)] for item in members
                    ))) for day in labels
                ],
            ))

    prior = trend[0].value if len(trend) > 1 else 0
    change = round((trend[-1].value if trend else 0) - prior, 2)
    return ReportResponse(
        summary=ReportSummary(
            primary_value=float(totals["netIncome"]), change_amount=change,
            change_percent=round(change / abs(prior) * 100, 2) if prior else None,
            breakdowns=[ReportBreakdown(key=key, label=label, value=float(totals[key]), color=color)
                        for key, label, color in series_meta],
        ),
        meta=ReportMeta(
            type="income_expenses", series_keys=[key for key, _, _ in series_meta[:-1]],
            currency=currency, interval=interval, observed_from=start.isoformat(),
            observed_to=end.isoformat(), missing_fx_count=len(missing_fx),
        ),
        trend=trend, category_trend=category_trend,
        composition=[
            composition_item(key, observed_by_category[key], forecast_by_category[key])
            for key in categories
        ],
    )
