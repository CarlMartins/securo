"""The drill-down and native list share the observed report's accounting scope."""

import csv
import io
from decimal import Decimal

import pytest

from app.models.category import Category
from app.models.fx_rate import FxRate
from app.models.group import Group, GroupMember
from app.models.recurring_transaction import RecurringTransaction
from app.models.transaction import Transaction
from app.models.transaction_category_line import TransactionCategoryLine
from app.models.transaction_split import TransactionSplit

from tests.test_custom_reports_api import (  # noqa: F401
    HISTORICAL_RANGE,
    REPORT,
    TODAY,
    TOMORROW,
    fixed_report_day,
    report_accounts,
)


@pytest.mark.parametrize("kind", ["expenses", "income"])
async def test_detail_reconciles_with_native_transaction_list(
    client, auth_headers, report_accounts, kind,
):
    account = report_accounts["A"]
    report_params = {
        **HISTORICAL_RANGE,
        "statuses": "posted,pending",
        "account_ids": account,
    }
    report = await client.get(REPORT, params=report_params, headers=auth_headers)
    detail = await client.get(
        f"{REPORT}/transactions",
        params={**report_params, "group": kind, "category": "uncategorized", "limit": 1},
        headers=auth_headers,
    )
    assert report.status_code == detail.status_code == 200, detail.text
    detail_data = detail.json()
    point = report.json()["trend"][-1]["breakdowns"][kind]
    signed = point if kind == "income" else -point
    assert float(detail_data["total_amount"]) == signed
    assert detail_data["total"] == (1 if kind == "income" else 2)
    assert len(detail_data["items"]) == 1

    result = await client.get(
        "/api/transactions",
        headers=auth_headers,
        params={
            "account_ids": account,
            "from": HISTORICAL_RANGE["start_date"], "to": HISTORICAL_RANGE["end_date"],
            "type": "credit" if kind == "income" else "debit",
            "uncategorized": True,
            "report_group": kind,
            "report_from": HISTORICAL_RANGE["start_date"],
            "report_to": HISTORICAL_RANGE["end_date"],
        },
    )
    assert result.status_code == 200, result.text
    body = result.json()
    assert body["total"] == detail_data["total"]
    assert sum(float(item["report_amount"]) for item in body["items"]) == signed
    assert float(body["summary"]["net"]) == signed



def movement(account, amount, **attrs):
    fields = {
        "date": TODAY, "effective_date": TODAY, "type": "debit", "status": "posted",
        "currency": "BRL", "source": "manual", "description": "Synthetic movement",
    }
    fields.update(attrs)
    return Transaction(
        user_id=account.user_id, workspace_id=account.workspace_id, account_id=account.id,
        amount=Decimal(amount), **fields,
    )


@pytest.mark.parametrize("kind", ["expenses", "investments"])
async def test_split_attribution_reference_date_and_export(
    client, session, auth_headers, test_account, kind,
):
    category = Category(
        user_id=test_account.user_id, workspace_id=test_account.workspace_id, name="Synthetic split",
        treat_as_transfer=kind == "investments",
    )
    other = Category(
        user_id=test_account.user_id, workspace_id=test_account.workspace_id, name="Other allocation",
    )
    tx = movement(
        test_account, "100", date=TOMORROW, effective_date=TOMORROW,
        reporting_date_override=TODAY, has_category_lines=True,
    )
    session.add_all([category, other, tx])
    await session.flush()
    for position, (cat, value) in enumerate(((category, "40"), (other, "60"))):
        session.add(TransactionCategoryLine(
            workspace_id=tx.workspace_id, transaction_id=tx.id,
            category_id=cat.id, amount=Decimal(value), position=position,
        ))
    await session.commit()

    params = {**HISTORICAL_RANGE, "statuses": "posted,pending", "account_ids": str(test_account.id)}
    report = await client.get(REPORT, headers=auth_headers, params=params)
    part = next(item for item in report.json()["composition"] if item["key"] == str(category.id))
    assert part["group"] == kind
    assert part["value"] == 40
    detail = await client.get(
        f"{REPORT}/transactions", headers=auth_headers,
        params={**params, "group": kind, "category": str(category.id)},
    )
    body = detail.json()
    assert body["items"][0]["id"] == str(tx.id)
    assert body["items"][0]["date"] == TODAY.isoformat()
    assert body["items"][0]["bank_date"] == TOMORROW.isoformat()
    assert Decimal(body["total_amount"]) == -40

    ledger_params = {
        "account_ids": str(test_account.id), "category_id": str(category.id), "type": "debit",
        "report_group": kind, "report_from": HISTORICAL_RANGE["start_date"],
        "report_to": HISTORICAL_RANGE["end_date"],
    }
    ledger = await client.get("/api/transactions", headers=auth_headers, params=ledger_params)
    assert ledger.status_code == 200, ledger.text
    assert Decimal(ledger.json()["items"][0]["report_amount"]) == -40
    assert Decimal(str(ledger.json()["items"][0]["amount"])) == 100
    export = await client.get("/api/transactions/export", headers=auth_headers, params=ledger_params)
    assert export.status_code == 200, export.text
    records = list(csv.DictReader(io.StringIO(export.text.lstrip("\ufeff"))))
    assert [(row["id"], Decimal(row["report_amount"])) for row in records] == [(str(tx.id), Decimal(-40))]


async def test_quantization_and_missing_fx_do_not_change_original_transaction(
    client, session, auth_headers, test_account, test_categories,
):
    tx = movement(test_account, "3", currency="USD", has_category_lines=True)
    missing = movement(test_account, "2", currency="ZZZ")
    session.add_all([
        tx, missing,
        FxRate(base_currency="USD", quote_currency="BRL", date=TODAY,
               rate=Decimal("0.335"), source="fixture"),
    ])
    await session.flush()
    for position, category in enumerate(test_categories[:3]):
        session.add(TransactionCategoryLine(
            workspace_id=tx.workspace_id, transaction_id=tx.id,
            category_id=category.id, amount=Decimal(1), position=position,
        ))
    await session.commit()
    params = {**HISTORICAL_RANGE, "statuses": "posted,pending", "account_ids": str(test_account.id)}
    response = await client.get(REPORT, headers=auth_headers, params=params)
    assert response.status_code == 200, response.text
    report = response.json()
    assert report["meta"]["missing_fx_count"] == 1
    by_category = {row["key"]: Decimal(str(row["value"])) for row in report["composition"]}
    assert sorted(by_category.values()) == [Decimal("0.33"), Decimal("0.33"), Decimal("0.34")]
    for category_id, amount in by_category.items():
        detail = await client.get(
            f"{REPORT}/transactions", headers=auth_headers,
            params={**params, "group": "expenses", "category": category_id},
        )
        assert Decimal(detail.json()["total_amount"]) == -amount
    native = await client.get("/api/transactions", headers=auth_headers)
    row = next(item for item in native.json()["items"] if item["id"] == str(missing.id))
    assert row["currency"] == "ZZZ"
    assert Decimal(row["amount"]) == 2


async def test_owner_split_is_personal_but_an_explicit_account_is_integral(
    client, session, auth_headers, test_account,
):
    group = Group(user_id=test_account.user_id, workspace_id=test_account.workspace_id, name="Test group")
    tx = movement(test_account, "100", status="pending")
    member = GroupMember(group=group, workspace_id=group.workspace_id, name="Synthetic participant")
    session.add_all([member, tx])
    await session.flush()
    session.add(TransactionSplit(
        transaction_id=tx.id, group_member_id=member.id, workspace_id=tx.workspace_id,
        share_amount=Decimal("40"),
    ))
    await session.commit()
    for scope, expected in (({}, 60), ({"account_ids": str(test_account.id)}, 100)):
        params = {**HISTORICAL_RANGE, **scope, "statuses": "pending"}
        response = await client.get(REPORT, headers=auth_headers, params=params)
        assert response.status_code == 200, response.text
        report = response.json()
        assert report["composition"][0]["value"] == expected
        detail = await client.get(
            f"{REPORT}/transactions", headers=auth_headers,
            params={**params, "group": "expenses"},
        )
        assert Decimal(detail.json()["total_amount"]) == -expected


async def test_projection_preserves_independent_sources_and_skips_observed_equivalents(
    client, session, auth_headers, test_account,
):
    session.add_all([
        movement(test_account, "75", status="pending", source="sync", external_id="same-provider-id"),
        movement(test_account, "75", date=TOMORROW, effective_date=TOMORROW,
                 source="sync", external_id="same-provider-id"),
        movement(test_account, "20", date=TOMORROW, effective_date=TOMORROW),
        RecurringTransaction(
            user_id=test_account.user_id, workspace_id=test_account.workspace_id,
            account_id=test_account.id, description="Independent recurring bill", amount=Decimal(5),
            type="debit", currency="BRL", start_date=TOMORROW, next_occurrence=TOMORROW, frequency="monthly",
        ),
    ])
    await session.commit()
    params = {"months": 1, "account_ids": str(test_account.id), "statuses": "posted,pending"}
    result = await client.get(REPORT, headers=auth_headers, params=params)
    assert result.status_code == 200, result.text
    report = result.json()
    by_series = {b["key"]: b["value"] for b in report["summary"]["breakdowns"]}
    assert by_series["expenses"] == 75
    assert by_series["projectedExpenses"] == 25
    assert report["composition"][0]["value"] == 100
    assert report["composition"][0]["projected_value"] == 25

    observed_only = await client.get(REPORT, headers=auth_headers, params={**params, "statuses": "pending"})
    series = {b["key"]: b["value"] for b in observed_only.json()["summary"]["breakdowns"]}
    assert series["expenses"] == 75
    assert series["projectedExpenses"] == 0


@pytest.mark.parametrize(
    ("start", "end", "code"),
    [
        (TODAY.isoformat(), TODAY.isoformat(), 200),
        (TODAY.isoformat(), None, 422),
        (TOMORROW.isoformat(), TODAY.isoformat(), 422),
        ("2016-09-12", TODAY.isoformat(), 200),
        ("2016-09-11", TODAY.isoformat(), 422),
        ("9990-01-01", "9990-01-01", 200),
    ],
)
async def test_report_range_validation(client, auth_headers, start, end, code):
    params = {"start_date": start, "statuses": "pending"}
    if end:
        params["end_date"] = end
    response = await client.get(REPORT, headers=auth_headers, params=params)
    assert response.status_code == code, response.text


@pytest.mark.parametrize("posted_variant", ["ignored", "outside", "investment"])
async def test_replacement_requires_eligible_posted_contribution(
    client, session, auth_headers, test_account, posted_variant,
):
    category = Category(
        user_id=test_account.user_id, workspace_id=test_account.workspace_id,
        name="One sided transfer", treat_as_transfer=True,
    )
    session.add(category)
    await session.flush()
    changes = {
        "ignored": {"is_ignored": True},
        "outside": {"date": TOMORROW, "effective_date": TOMORROW},
        "investment": {"category_id": category.id},
    }
    session.add_all([
        movement(test_account, "75", status="pending", source="sync", external_id="replacement"),
        movement(test_account, "75", source="sync", external_id="replacement", **changes[posted_variant]),
    ])
    await session.commit()
    response = await client.get(
        REPORT, headers=auth_headers,
        params={**HISTORICAL_RANGE, "statuses": "posted,pending", "account_ids": str(test_account.id)},
    )
    assert response.status_code == 200, response.text
    rows = response.json()["composition"]
    assert [(row["group"], row["value"]) for row in rows] == [
        ("investments" if posted_variant == "investment" else "expenses", 75),
    ]


async def test_received_share_requires_a_viewer_portion_to_replace_pending(
    client, session, auth_headers, test_user,
):
    from app.models.account import Account
    from app.models.user import User
    from app.models.workspace import Workspace

    owner = User(email="pays@example.test", hashed_password="unused")
    session.add(owner)
    await session.flush()
    workspace = Workspace(
        name="Synthetic shared space", kind="shared", created_by_user_id=owner.id,
        default_currency="BRL",
    )
    session.add(workspace)
    await session.flush()
    account = Account(
        user_id=owner.id, workspace_id=workspace.id, name="Third-party account",
        type="checking", currency="BRL", balance=Decimal(0),
    )
    group = Group(user_id=owner.id, workspace_id=workspace.id, name="Shared fixture")
    member = GroupMember(group=group, workspace_id=workspace.id, name="Viewer", linked_user_id=test_user.id)
    session.add_all([account, member])
    await session.flush()
    pending = movement(account, "100", status="pending", source="sync", external_id="shared-purchase")
    posted = movement(account, "100", source="sync", external_id="shared-purchase")
    session.add_all([pending, posted])
    await session.flush()
    session.add(TransactionSplit(
        transaction_id=pending.id, group_member_id=member.id, workspace_id=workspace.id,
        share_amount=Decimal(30),
    ))
    await session.commit()

    params = {**HISTORICAL_RANGE, "statuses": "posted,pending", "group": "expenses"}
    first = await client.get(f"{REPORT}/transactions", params=params, headers=auth_headers)
    assert [(row["id"], Decimal(row["amount"])) for row in first.json()["items"]] == [(str(pending.id), -30)]
    session.add(TransactionSplit(
        transaction_id=posted.id, group_member_id=member.id, workspace_id=workspace.id,
        share_amount=Decimal(40),
    ))
    await session.commit()
    second = await client.get(f"{REPORT}/transactions", params=params, headers=auth_headers)
    assert [(row["id"], Decimal(row["amount"])) for row in second.json()["items"]] == [(str(posted.id), -40)]
    assert second.json()["items"][0]["account_name"] is None

    restricted = await client.get(
        REPORT, params={**params, "account_ids": str(account.id)}, headers=auth_headers,
    )
    assert restricted.json()["composition"] == []


async def test_report_cutoff_and_detail_use_workspace_midnight(
    client, session, auth_headers, test_workspace, test_account, monkeypatch,
):
    from datetime import datetime, timezone

    from app.core import app_clock

    class Clock(datetime):
        instant = datetime(2026, 9, 13, 1, tzinfo=timezone.utc)

        @classmethod
        def now(cls, tz=None):
            return cls.instant.astimezone(tz) if tz else cls.instant.replace(tzinfo=None)

    monkeypatch.setattr(app_clock, "datetime", Clock)
    test_workspace.timezone = "America/Sao_Paulo"
    session.add_all([
        movement(test_account, "10"),
        movement(test_account, "20", date=TOMORROW, effective_date=TOMORROW),
    ])
    await session.commit()

    params = {
        "start_date": TODAY.isoformat(), "end_date": "2026-09-20",
        "statuses": "posted,pending", "account_ids": str(test_account.id),
    }
    for last_day, amount in ((TODAY, 10), (TOMORROW, 30)):
        report = await client.get(REPORT, params=params, headers=auth_headers)
        assert report.json()["meta"]["observed_to"] == last_day.isoformat()
        detail = await client.get(
            f"{REPORT}/transactions", params={**params, "group": "expenses"}, headers=auth_headers,
        )
        assert Decimal(detail.json()["total_amount"]) == -amount
        Clock.instant = datetime(2026, 9, 13, 4, tzinfo=timezone.utc)
