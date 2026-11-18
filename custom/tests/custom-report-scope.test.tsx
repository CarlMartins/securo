import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ReportsPage from '@/pages/reports'
import { renderWithProviders } from '@/test/utils'
import type { ReportResponse } from '@/types'

const api = vi.hoisted(() => ({
  reports: {
    netWorth: vi.fn(),
    incomeExpenses: vi.fn(),
    cashFlow: vi.fn(),
    dataRange: vi.fn(),
  },
  accounts: { list: vi.fn() },
  transactions: { list: vi.fn() },
  timezones: { list: vi.fn() },
  uiLayouts: { get: async () => ({ dashboard: null, reports: null }) },
}))

vi.mock('@/lib/api', () => api)
vi.mock('@/contexts/collection-filter-context', () => ({
  useCollectionFilter: () => ({
    activeAccountIds: ['account-a', 'account-b'],
    activeWalletIds: [],
  }),
}))
vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: { preferences: { currency_display: 'BRL' } } }),
}))

const report: ReportResponse = {
  summary: { primary_value: 0, change_amount: 0, change_percent: null, breakdowns: [] },
  trend: [],
  meta: { type: 'income_expenses', interval: 'monthly', currency: 'BRL', series_keys: [] },
  composition: [],
  category_trend: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  api.reports.netWorth.mockResolvedValue({ ...report, meta: { ...report.meta, type: 'net_worth' } })
  api.reports.incomeExpenses.mockResolvedValue(report)
  api.reports.dataRange.mockResolvedValue({ min_date: null, max_date: null })
  api.timezones.list.mockResolvedValue({ timezones: [], default: null })
  api.accounts.list.mockResolvedValue([
    { id: 'account-a', name: 'Conta fictícia A' },
    { id: 'account-b', name: 'Conta fictícia B' },
    { id: 'account-c', name: 'Conta fictícia C' },
  ])
})

describe.each(['Income vs Expenses', 'Money Map'])('%s account scope', (tab) => {
  it('requests the intersection of report accounts and the active collection', async () => {
    const { user } = renderWithProviders(<ReportsPage />, {
      route: '/reports?account_id=account-b,account-c&statuses=pending',
    })
    await user.click(screen.getByRole('button', { name: tab }))
    await waitFor(() => {
      const request = api.reports.incomeExpenses.mock.lastCall
      expect(request?.[2]).toEqual(['account-b'])
      expect(request?.[5]).toEqual(['pending'])
    })
  })

  it('does not fetch the report when the account intersection is empty', async () => {
    const { user } = renderWithProviders(<ReportsPage />, {
      route: '/reports?account_id=account-c',
    })
    await user.click(screen.getByRole('button', { name: tab }))
    await screen.findByRole('heading', { name: tab })
    expect(api.reports.incomeExpenses).not.toHaveBeenCalled()
  })
})
