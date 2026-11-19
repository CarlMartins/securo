"""Observed income/expense contributions shared by charts, detail and the ledger."""

import uuid
from dataclasses import dataclass
from datetime import date
from decimal import ROUND_DOWN, ROUND_HALF_EVEN, Decimal
from typing import Iterable, Literal

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.shared_scope import in_bound_workspace, invited_group_member_ids
from app.models.group import Group, GroupMember
from app.models.transaction import Transaction
from app.models.transaction_category_line import TransactionCategoryLine
from app.models.transaction_split import TransactionSplit
from app.services._query_filters import reporting_date_col
from app.services.fx_rate_service import convert_or_none

ReportGroup = Literal["income", "expenses", "investments"]
ALL_STATUSES = ("posted", "pending")
ZERO = Decimal(0)
CENT = Decimal("0.01")


@dataclass(frozen=True)
class Contribution:
    transaction: Transaction
    day: date
    category_id: uuid.UUID | None
    label: str
    color: str
    group: ReportGroup
    amount: Decimal
    shared: bool


def provider_identity(transaction: Transaction):
    if transaction.external_id:
        return (
            transaction.workspace_id, transaction.user_id,
            transaction.account_id, transaction.external_id,
        )
    return None


def allocate_cents(raw: list[tuple[str, Decimal]]) -> dict[str, Decimal]:
    """Round the selected total once, then distribute cents by remainder and ID."""
    rounded = {key: value.quantize(CENT, rounding=ROUND_DOWN) for key, value in raw}
    target = sum((value for _, value in raw), ZERO).quantize(CENT, rounding=ROUND_HALF_EVEN)
    remaining = int((target - sum(rounded.values(), ZERO)) / CENT)
    by_remainder = sorted(raw, key=lambda row: (rounded[row[0]] - row[1], row[0]))
    for key, _ in by_remainder[:remaining]:
        rounded[key] += CENT
    return rounded


async def load_contributions(
    session: AsyncSession,
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    currency: str,
    accounting_mode: str,
    start: date,
    end: date,
    statuses: tuple[str, ...],
    account_ids: list[uuid.UUID] | None,
) -> tuple[list[Contribution], set[uuid.UUID]]:
    if start > end or account_ids == []:
        return [], set()

    report_date = reporting_date_col(accounting_mode)
    viewer_members = invited_group_member_ids(user_id)
    share_for_viewer = select(TransactionSplit.transaction_id).where(
        TransactionSplit.group_member_id.in_(viewer_members)
    )
    scope = Transaction.workspace_id == workspace_id
    if account_ids is not None:
        scope = and_(scope, Transaction.account_id.in_(account_ids))
    else:
        scope = or_(scope, and_(
            Transaction.workspace_id != workspace_id,
            Transaction.user_id != user_id,
            in_bound_workspace(Transaction.workspace_id),
            Transaction.id.in_(share_for_viewer),
        ))

    rows = (await session.execute(
        select(Transaction, report_date.label("report_date"))
        .where(
            scope,
            report_date.between(start, end),
            Transaction.status.in_(statuses),
            Transaction.source.not_in(("opening_balance", "settlement")),
            Transaction.type.in_(("credit", "debit")),
            Transaction.transfer_pair_id.is_(None),
            Transaction.is_ignored.is_(False),
            Transaction.exclude_from_pnl.is_(False),
        )
        .options(
            selectinload(Transaction.account),
            selectinload(Transaction.category),
            selectinload(Transaction.category_lines).selectinload(TransactionCategoryLine.category),
        )
        .order_by(report_date.desc(), Transaction.created_at.desc(), Transaction.id.desc())
    )).all()

    shares: dict[uuid.UUID, Decimal] = {}
    if account_ids is None and rows:
        own_members = select(GroupMember.id).outerjoin(Group).where(or_(
            GroupMember.linked_user_id == user_id,
            and_(GroupMember.is_self.is_(True), Group.user_id == user_id),
        ))
        relevant_shares = select(
            TransactionSplit.transaction_id, func.sum(TransactionSplit.share_amount)
        ).join(Transaction).where(
            scope,
            report_date.between(start, end),
            or_(
                and_(
                    Transaction.workspace_id == workspace_id, Transaction.user_id == user_id,
                    TransactionSplit.group_member_id.not_in(own_members),
                ),
                and_(
                    Transaction.workspace_id != workspace_id,
                    TransactionSplit.group_member_id.in_(viewer_members),
                ),
            )
        ).group_by(TransactionSplit.transaction_id)
        shares = dict((await session.execute(relevant_shares)).all())

    candidates: list[tuple[Transaction, list[Contribution] | None]] = []
    rate_cache: dict[tuple[str, date], Decimal | None] = {}
    for tx, day in rows:
        full = abs(tx.amount)
        if not full:
            continue
        shared = tx.workspace_id != workspace_id
        share = abs(shares.get(tx.id, ZERO))
        personal = min(full, share) if shared else max(ZERO, full - share)
        if not personal:
            continue
        parts = (
            [(str(line.id), line.category, abs(line.amount)) for line in tx.category_lines]
            if tx.category_lines else [(str(tx.id), tx.category, full)]
        )
        groups: dict[str, ReportGroup] = {}
        for key, category, _ in parts:
            if category and category.is_ignored:
                continue
            if category and category.treat_as_transfer:
                if tx.type == "debit" and not shared:
                    groups[key] = "investments"
            else:
                groups[key] = "income" if tx.type == "credit" else "expenses"
        eligible = [(key, category, value) for key, category, value in parts if key in groups and value]
        if not eligible:
            continue

        # Stored primary amounts are stamped for the owner. For a received
        # share, resolve a rate in the viewer's own primary currency.
        if tx.currency == currency:
            base = full
        elif tx.amount_primary is not None and tx.user_id == user_id:
            base = abs(tx.amount_primary)
        else:
            rate_key = (tx.currency, tx.date)
            if rate_key not in rate_cache:
                _, rate_cache[rate_key] = await convert_or_none(
                    session, Decimal(1), tx.currency, currency, tx.date, allow_fetch=False
                )
            rate = rate_cache[rate_key]
            if rate is None:
                candidates.append((tx, None))
                continue
            base = full * rate

        amounts = allocate_cents([
            (key, base * personal * value / (full * full)) for key, _, value in eligible
        ])
        contributions = []
        for key, category, _ in eligible:
            if not amounts[key]:
                continue
            # Categories from another workspace are unavailable in the native
            # category selector and must not reveal the owner's labels.
            visible_category = None if shared else category
            contributions.append(Contribution(
                tx, day, visible_category.id if visible_category else None,
                visible_category.name if visible_category else "Uncategorized",
                (visible_category.color if visible_category else None) or "#6B7280",
                groups[key], amounts[key], shared,
            ))
        if contributions:
            candidates.append((tx, contributions))

    posted = {
        identity for tx, parts in candidates
        if parts and tx.status == "posted" and (identity := provider_identity(tx)) is not None
    }
    observed: list[Contribution] = []
    missing_fx: set[uuid.UUID] = set()
    for tx, parts in candidates:
        if tx.status == "pending" and provider_identity(tx) in posted:
            continue
        if parts is None:
            missing_fx.add(tx.id)
        else:
            observed.extend(parts)
    return observed, missing_fx


def select_contributions(
    contributions: Iterable[Contribution],
    *,
    group: ReportGroup | None,
    category_ids: set[uuid.UUID] | None = None,
    uncategorized: bool = False,
    start: date | None = None,
    end: date | None = None,
) -> dict[uuid.UUID, tuple[Contribution, Decimal]]:
    rows: dict[uuid.UUID, tuple[Contribution, Decimal]] = {}
    for part in contributions:
        if group and part.group != group:
            continue
        if (start and part.day < start) or (end and part.day > end):
            continue
        if category_ids or uncategorized:
            if not (part.category_id in (category_ids or set()) or (uncategorized and part.category_id is None)):
                continue
        tx_id = part.transaction.id
        amount = part.amount if part.group == "income" else -part.amount
        rows[tx_id] = (part, rows.get(tx_id, (part, ZERO))[1] + amount)
    return rows
