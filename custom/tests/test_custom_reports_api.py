"""Contract tests for the custom reports, using Securo's isolated API fixtures."""

from datetime import date, datetime, timezone
from decimal import Decimal

import pytest

from app.core import app_clock
from app.models.account import Account
from app.models.transaction import Transaction

# Reuse the native suite's SQLite shim for the PostgreSQL date formatter.
from tests.test_report_service_coverage import _ensure_to_char  # noqa: F401

TODAY = date(2026, 9, 12)
TOMORROW = date(2026, 9, 13)
REPORT = "/api/reports/income-expenses"
HISTORICAL_RANGE = {
    "start_date": "2026-09-11",
    "end_date": "2026-09-12",
    "interval": "daily",
}


@pytest.fixture(autouse=True)
def fixed_report_day(monkeypatch):
    class ReportClock(datetime):
        @classmethod
        def now(cls, tz=None):
            instant = datetime(2026, 9, 12, 12, tzinfo=timezone.utc)
            return instant.astimezone(tz) if tz else instant.replace(tzinfo=None)

    monkeypatch.setattr(app_clock, "datetime", ReportClock)


@pytest.fixture
async def report_accounts(session, test_user, test_workspace):
    accounts = [
        Account(
            user_id=test_user.id,
            workspace_id=test_workspace.id,
            name=name,
            type="checking",
            currency="BRL",
            balance=Decimal("0"),
        )
        for name in ("Conta fictícia A", "Conta fictícia B")
    ]
    session.add_all(accounts)
    await session.flush()
    account_a, account_b = accounts
    movements = [
        (account_a, 100, "credit", "posted", TODAY, None, False),
        (account_a, 65, "debit", "pending", TODAY, "fixture-operation", False),
        (account_a, 75, "debit", "posted", TODAY, "fixture-operation", False),
        (account_a, 15, "debit", "pending", TODAY, None, False),
        (account_a, 500, "debit", "pending", TODAY, None, True),
        (account_a, 200, "credit", "posted", TOMORROW, None, False),
        (account_b, 20, "debit", "pending", TODAY, "fixture-operation", False),
    ]
    for account, value, kind, status, day, provider_id, ignored in movements:
        session.add(Transaction(
            user_id=test_user.id,
            workspace_id=test_workspace.id,
            account_id=account.id,
            description="Movimentação fictícia",
            type=kind,
            status=status,
            source="sync" if provider_id else "manual",
            external_id=provider_id,
            amount=Decimal(value),
            currency="BRL",
            date=day,
            effective_date=day,
            is_ignored=ignored,
        ))
    await session.commit()
    return {key: str(account.id) for key, account in zip(("A", "B"), accounts)}


def assert_actuals(report, income, expense):
    totals = {item["key"]: item["value"] for item in report["summary"]["breakdowns"]}
    for key, expected in {
        "income": income,
        "expenses": expense,
        "netIncome": income - expense,
        "projectedIncome": 0,
        "projectedExpenses": 0,
    }.items():
        assert totals[key] == pytest.approx(expected), key

    assert sum(point["value"] for point in report["trend"]) == pytest.approx(income - expense)
    for group, expected in (("income", income), ("expenses", expense)):
        assert sum(
            point["breakdowns"][group] for point in report["trend"]
        ) == pytest.approx(expected), group
        assert sum(
            row["value"] for row in report["composition"] if row["group"] == group
        ) == pytest.approx(expected), group
        assert sum(
            row["total"] for row in report["category_trend"] if row["group"] == group
        ) == pytest.approx(expected), group


@pytest.mark.parametrize(
    ("statuses", "scope", "income", "expense"),
    [
        (None, "AB", 100, 75),
        ("posted", "A", 100, 75),
        ("pending", "A", 0, 80),
        ("posted,pending", "AB", 100, 110),
        ("pending,posted", "A", 100, 90),
        ("posted,pending", "B", 0, 20),
    ],
    ids=["default", "posted-A", "pending-A", "both-AB", "both-A", "both-B"],
)
async def test_actuals_follow_statuses_and_accounts(
    client, auth_headers, report_accounts, statuses, scope, income, expense,
):
    params = {**HISTORICAL_RANGE, "account_ids": [report_accounts[key] for key in scope]}
    if statuses is not None:
        params["statuses"] = statuses
    response = await client.get(REPORT, headers=auth_headers, params=params)
    assert response.status_code == 200, response.text
    report = response.json()
    assert report["trend"][-1]["date"] == TODAY.isoformat()
    assert_actuals(report, income, expense)


@pytest.mark.parametrize("statuses", ["", "posted,posted", "pending, posted", "unknown"])
async def test_invalid_statuses_are_rejected(client, auth_headers, statuses):
    response = await client.get(
        REPORT, headers=auth_headers, params={**HISTORICAL_RANGE, "statuses": statuses},
    )
    assert response.status_code == 422, response.text


@pytest.mark.parametrize(
    ("start", "income", "expense"),
    [("2026-09-11", 100, 90), ("2026-09-13", 0, 0)],
    ids=["overlaps-today", "future-only"],
)
async def test_future_custom_window_stops_at_workspace_today(
    client, auth_headers, report_accounts, start, income, expense,
):
    params = {
        "start_date": start,
        "end_date": "2026-09-20",
        "interval": "daily",
        "statuses": "posted,pending",
        "account_ids": [report_accounts["A"]],
    }
    response = await client.get(REPORT, headers=auth_headers, params=params)
    assert response.status_code == 200, response.text
    report = response.json()
    assert_actuals(report, income, expense)
    if start > TODAY.isoformat():
        assert report["trend"] == []
        assert report["composition"] == []
        assert report["category_trend"] == []
    else:
        assert report["trend"][-1]["date"] == TODAY.isoformat()


async def test_net_worth_keeps_historical_range_validation(client, auth_headers):
    response = await client.get(
        "/api/reports/net-worth",
        headers=auth_headers,
        params={"start_date": TODAY.isoformat(), "end_date": TOMORROW.isoformat()},
    )
    assert response.status_code == 422, response.text
