"""Portable API acceptance scenarios for date and account filters on Overview."""

from datetime import date
from decimal import Decimal

import pytest

from app.models.account import Account
from app.models.transaction import Transaction


@pytest.fixture
def fixed_dashboard_day(monkeypatch):
    today = date(2026, 1, 3)
    for module in ("dashboard_period_service", "dashboard_service", "transaction_calendar_service"):
        monkeypatch.setattr(f"app.services.{module}.app_today", lambda: today)
    monkeypatch.setattr("app.api.reports.app_today", lambda: today)
    monkeypatch.setattr("app.api.transactions.app_today", lambda: today)
    return today


@pytest.fixture
async def dashboard_period_data(session, test_user, test_workspace, fixed_dashboard_day):
    a, b = [
        Account(workspace_id=test_workspace.id, user_id=test_user.id,
                name=name, currency=test_user.primary_currency, type="checking", balance=0)
        for name in ("Conta A", "Conta B")
    ]
    session.add_all([a, b])
    await session.flush()

    def debit(account, description, amount, bank_date, *, status="posted", external_id=None, report_date=None):
        day = date.fromisoformat(bank_date)
        return Transaction(
            workspace_id=test_workspace.id, user_id=test_user.id, account_id=account.id,
            description=description, amount=Decimal(amount), date=day, effective_date=day,
            reporting_date_override=date.fromisoformat(report_date) if report_date else None,
            type="debit", status=status, source="manual", external_id=external_id,
            currency=test_user.primary_currency,
        )

    session.add_all([
        debit(a, "Anterior", 20, "2025-12-29"),
        debit(a, "Lançado", 70, "2025-12-31", external_id="same"),
        debit(a, "Pendente duplicada", 70, "2026-01-01", status="pending", external_id="same"),
        debit(a, "Pendente elegível", 30, "2026-01-02", status="pending"),
        debit(a, "Data de referência ajustada", 50, "2026-01-06", report_date="2026-01-01"),
        debit(a, "Futuro fora da apuração", 80, "2026-01-04", status="pending"),
        debit(b, "Outra conta", 500, "2026-01-02", status="pending"),
    ])
    await session.commit()
    return str(a.id), str(b.id)


async def test_dashboard_period_reconciles_observed_activity(
    client, auth_headers, dashboard_period_data,
):
    first, second = dashboard_period_data
    start, end = "2025-12-31", "2026-01-04"
    shared = {"account_ids": first, "from": start, "to": end}

    result = await client.get("/api/dashboard/period", params=shared, headers=auth_headers)
    assert result.status_code == 200, result.text
    payload = result.json()
    assert Decimal(payload["posted_expenses"]) == 120
    assert Decimal(payload["pending_expenses"]) == 30
    assert Decimal(payload["additional_projected_expenses"]) == 0
    assert sum(Decimal(row["total"]) for row in payload["spending"]) == 150

    detail = await client.get("/api/reports/income-expenses/transactions", params={
        "start_date": start, "end_date": end, "account_ids": first,
        "group": "expenses", "statuses": "posted,pending",
    }, headers=auth_headers)
    assert detail.status_code == 200, detail.text
    assert Decimal(detail.json()["total_amount"]) == -150

    ledger = await client.get("/api/transactions", params={
        **shared, "report_group": "activity", "report_from": start, "report_to": end,
        "page": 2, "limit": 2, "sort_by": "date", "sort_dir": "asc",
    }, headers=auth_headers)
    assert ledger.status_code == 200, ledger.text
    assert ledger.json()["total"] == 3
    assert ledger.json()["items"][0]["description"] == "Pendente elegível"
    assert ledger.json()["items"][0]["report_date"] == "2026-01-02"

    scoped = await client.get("/api/dashboard/period", params={**shared, "account_ids": second}, headers=auth_headers)
    assert scoped.status_code == 200, scoped.text
    assert Decimal(scoped.json()["pending_expenses"]) == 500


async def test_dashboard_balance_and_calendar_use_their_own_date_basis(
    client, auth_headers, dashboard_period_data,
):
    account, _ = dashboard_period_data
    start, end = "2025-12-31", "2026-01-04"
    balance = await client.get("/api/dashboard/balance-period", headers=auth_headers, params={
        "account_ids": account, "from": start, "to": end,
    })
    assert balance.status_code == 200, balance.text
    data = balance.json()
    assert data["comparison_from"] == "2025-12-26"
    assert data["comparison_to"] == "2025-12-30"
    assert [row["change"] for row in data["current"]] == [-70, -70, -70, -70, None]
    assert [row["change"] for row in data["comparison"]] == [0, 0, 0, -20, -20]

    calendar = await client.get("/api/transactions/calendar", headers=auth_headers, params={
        "account_ids": account, "month": "2026-01-01", "observed_from": start, "observed_to": end,
    })
    assert calendar.status_code == 200, calendar.text
    days = {row["date"]: row for row in calendar.json()["days"]}
    assert days["2025-12-31"]["unavailable"]
    assert days["2026-01-01"]["expense"] == 50
    assert days["2026-01-02"]["expense"] == 30
    assert days["2026-01-02"]["items"][0]["status"] == "pending"
    assert days["2026-01-04"]["unavailable"]
    assert days["2026-01-04"]["items"] == []


@pytest.mark.parametrize("query", [
    {"from": "2026-01-01"},
    {"from": "2026-01-03", "to": "2026-01-02"},
    {"from": "2026-01-01", "to": "2036-01-02"},
    {"month": "2026-01-01", "from": "2026-01-01", "to": "2026-01-03"},
])
async def test_invalid_dashboard_period_returns_422(client, auth_headers, query):
    response = await client.get("/api/dashboard/period", headers=auth_headers, params=query)
    assert response.status_code == 422


async def test_single_day_and_future_dashboard_periods(client, auth_headers, dashboard_period_data):
    account, _ = dashboard_period_data
    for day, expected in [("2026-01-02", 30), ("2026-01-04", 0)]:
        response = await client.get("/api/dashboard/period", headers=auth_headers, params={
            "from": day, "to": day, "account_ids": account,
        })
        assert response.status_code == 200, response.text
        assert Decimal(response.json()["pending_expenses"]) == expected


async def test_monthly_forecast_does_not_repeat_observed_pending(
    client, auth_headers, dashboard_period_data,
):
    account, _ = dashboard_period_data
    response = await client.get("/api/dashboard/period", headers=auth_headers, params={
        "month": "2026-01-01", "account_ids": account,
    })
    assert response.status_code == 200, response.text
    payload = response.json()
    # The December counterpart is outside this month. January has two
    # recorded pending rows and one additional future expense.
    assert Decimal(payload["pending_expenses"]) == 100
    assert Decimal(payload["posted_expenses"]) == 50
    assert Decimal(payload["additional_projected_expenses"]) == 80
    assert sum(Decimal(row["projected_total"]) for row in payload["spending"]) == 230
