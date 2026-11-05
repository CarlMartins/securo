import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import ReportsPage from '@/pages/reports'
import { renderWithProviders } from '@/test/utils'
import { saveReportsRange } from '@/lib/remembered-range'
import type { ReportResponse } from '@/types'

const api = vi.hoisted(() => ({
  reports: {
    netWorth: vi.fn(), incomeExpenses: vi.fn(), cashFlow: vi.fn(), dataRange: vi.fn(),
  },
  transactions: { list: vi.fn() },
  accounts: { list: vi.fn() },
  timezones: { list: vi.fn() },
}))

vi.mock('@/lib/api', () => ({
  reports: api.reports,
  transactions: api.transactions,
  accounts: api.accounts,
  timezones: api.timezones,
}))
vi.mock('@/hooks/use-display-locale', () => ({
  useDisplayLocale: () => 'en-US', useDateLocale: () => 'en-US',
}))
vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: { preferences: { currency_display: 'USD' } } }),
}))
vi.mock('@/contexts/collection-filter-context', () => ({
  useCollectionFilter: () => ({ activeAccountIds: null, activeWalletIds: null }),
}))
vi.mock('@/hooks/use-privacy-mode', () => ({
  usePrivacyMode: () => ({ mask: (value: string) => value, privacyMode: false, MASK: '••••' }),
}))

const marketId = '05956cb7-c035-4da0-b31b-0074ce07cc32'
const otherId = '64aac812-a06e-4589-b8c3-e0875eef46cf'
const salaryId = '84f3132e-f3a7-4232-a7e8-6fb2b0d3175b'
const investmentId = '75c22a38-e0c0-4f3d-bb9b-8b61eb38c4eb'

function report(interval: 'daily' | 'weekly'): ReportResponse {
  const dates = interval === 'weekly'
    ? ['2026-W37', '2026-W38', '2026-W39', '2026-W40']
    : ['2026-09-14']
  return {
    summary: {
      primary_value: -80, change_amount: 0, change_percent: 0,
      breakdowns: [
        { key: 'income', label: 'Income', value: 20, color: '#10B981' },
        { key: 'expenses', label: 'Expenses', value: 100, color: '#F43F5E' },
      ],
    },
    trend: dates.map((date) => ({
      date, value: -20, change: null,
      breakdowns: { income: 20, expenses: 100, projectedIncome: 0, projectedExpenses: 0 },
    })),
    meta: { type: 'income_expenses', series_keys: ['income', 'expenses'], currency: 'USD', interval },
    composition: [
      { key: marketId, label: 'Mercado', value: 50, color: '#10B981', group: 'expenses' },
      { key: otherId, label: 'Outros', value: 50, color: '#F59E0B', group: 'expenses' },
    ],
    category_trend: [
      { key: marketId, label: 'Mercado', total: 50, color: '#10B981', group: 'expenses',
        series: dates.map((date) => ({ date, value: 50, breakdowns: {}, change: null })) },
    ],
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 3, 12))
  vi.clearAllMocks()
  api.reports.netWorth.mockResolvedValue(report('weekly'))
  api.reports.incomeExpenses.mockResolvedValue(report('weekly'))
  api.reports.cashFlow.mockResolvedValue(report('weekly'))
  api.reports.dataRange.mockResolvedValue({ min_date: null, max_date: null })
  api.transactions.list.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 })
  api.accounts.list.mockResolvedValue([])
  api.timezones.list.mockResolvedValue({ timezones: [], default: null })
  saveReportsRange('income_expenses', {
    rangeKey: 'custom', from: '2026-09-12', to: '2026-10-03', interval: 'weekly', periodOffset: 0,
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function showMoneyMap() {
  const original = HTMLElement.prototype.getBoundingClientRect
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('privacy-sensitive')
      ? DOMRect.fromRect({ width: 800, height: 400 })
      : original.call(this)
  })
}

describe('Income vs Expenses transaction drilldown', () => {
  it('passes the account filter to the dialog and Transactions link', async () => {
    const { user } = renderWithProviders(<ReportsPage />, { route: '/reports?account_id=account-1&statuses=posted' })
    const cards = await screen.findAllByRole('button', { name: 'View Transactions · Mercado' })
    await user.click(cards.at(-1)!)
    await waitFor(() => expect(api.transactions.list).toHaveBeenCalledWith(expect.objectContaining({
      account_ids: ['account-1'], status: 'posted', category_ids: [marketId],
    })))
    expect(screen.getByRole('link', { name: 'View Transactions' })).toHaveAttribute(
      'href', expect.stringContaining('account_id=account-1'),
    )
  })

  it('opens a category trend card with the full report period, category and both statuses', async () => {
    const { user } = renderWithProviders(<ReportsPage />)
    await user.click(screen.getByRole('button', { name: 'Income vs Expenses' }))
    const cards = await screen.findAllByRole('button', { name: 'View Transactions · Mercado' })
    await user.click(cards.at(-1)!)
    await waitFor(() => expect(api.transactions.list).toHaveBeenCalledWith(expect.objectContaining({
      from: '2026-09-12', to: '2026-10-03', type: 'debit', category_ids: [marketId],
    })))
    expect(api.transactions.list.mock.calls.at(-1)?.[0]).not.toHaveProperty('status')
    expect(screen.getByRole('dialog')).toHaveTextContent('Transactions · Mercado')
    expect(screen.getByRole('link', { name: 'View Transactions' })).toHaveAttribute(
      'href', expect.stringContaining(`category_id=${marketId}`),
    )
  })

  it('opens a real Outros pie category by UUID', async () => {
    const { user } = renderWithProviders(<ReportsPage />)
    await user.click(screen.getByRole('button', { name: 'Income vs Expenses' }))
    const otherSector = await waitFor(() => {
      const sector = document.querySelector('.recharts-pie-sector path[fill="#F59E0B"]')
      expect(sector).not.toBeNull()
      return sector!
    })
    fireEvent.click(otherSector)
    await waitFor(() => expect(api.transactions.list).toHaveBeenCalledWith(expect.objectContaining({
      category_ids: [otherId], from: '2026-09-12', to: '2026-10-03', type: 'debit',
    })))
  })

  it('uses the clipped first ISO week when an expense bar is clicked', async () => {
    const { user } = renderWithProviders(<ReportsPage />, { route: '/reports?statuses=pending' })
    await user.click(screen.getByRole('button', { name: 'Income vs Expenses' }))
    const chart = await screen.findByTestId('income-expenses-chart')
    await waitFor(() => expect(chart.querySelectorAll('.recharts-bar-rectangle path').length).toBeGreaterThan(0))
    const expenses = chart.querySelectorAll('.recharts-bar-rectangle path[fill="#F43F5E"]')
    expect(expenses.length).toBeGreaterThan(0)
    fireEvent.click(expenses[0])
    await waitFor(() => expect(api.transactions.list).toHaveBeenCalledWith(expect.objectContaining({
      from: '2026-09-12', to: '2026-09-13', type: 'debit', status: 'pending',
    })))
  })

  it('opens an income bar without a category filter', async () => {
    api.transactions.list.mockResolvedValue({
      items: [
        { id: 'income-1', description: 'Salary', amount: 20, currency: 'USD', date: '2026-09-12', type: 'credit', status: 'posted', category: null },
        { id: 'income-2', description: 'Transfer', amount: 5, currency: 'USD', date: '2026-09-12', type: 'credit', status: 'posted', category: null },
      ],
      total: 2, page: 1, limit: 20,
      summary: { income: 20, expense: 0, net: 20, excluded: 5, currency: 'USD' },
    })
    const { user } = renderWithProviders(<ReportsPage />, { route: '/reports?statuses=posted' })
    await user.click(screen.getByRole('button', { name: 'Income vs Expenses' }))
    const chart = await screen.findByTestId('income-expenses-chart')
    const income = await waitFor(() => {
      const bars = chart.querySelectorAll('.recharts-bar-rectangle path[fill="#10B981"]')
      expect(bars.length).toBeGreaterThan(0)
      return bars
    })
    fireEvent.click(income[0])
    await waitFor(() => expect(api.transactions.list).toHaveBeenCalledWith(expect.objectContaining({
      from: '2026-09-12', to: '2026-09-13', type: 'credit', status: 'posted',
    })))
    expect(api.transactions.list.mock.calls.at(-1)?.[0]).not.toHaveProperty('category_ids')
    expect(await within(screen.getByRole('dialog')).findByText('$25.00')).toHaveClass('text-emerald-600')
  })

  it('uses a single day when a daily expense bar is clicked', async () => {
    api.reports.incomeExpenses.mockResolvedValue(report('daily'))
    saveReportsRange('income_expenses', {
      rangeKey: 'custom', from: '2026-09-12', to: '2026-10-03', interval: 'daily', periodOffset: 0,
    })
    const { user } = renderWithProviders(<ReportsPage />)
    await user.click(screen.getByRole('button', { name: 'Income vs Expenses' }))
    const chart = await screen.findByTestId('income-expenses-chart')
    const expenses = await waitFor(() => {
      const bars = chart.querySelectorAll('.recharts-bar-rectangle path[fill="#F43F5E"]')
      expect(bars.length).toBeGreaterThan(0)
      return bars
    })
    fireEvent.click(expenses[0])
    await waitFor(() => expect(api.transactions.list).toHaveBeenCalledWith(expect.objectContaining({
      from: '2026-09-14', to: '2026-09-14', type: 'debit',
    })))
    expect(within(screen.getByRole('dialog')).getByText(/Sep 14, 2026/)).toBeInTheDocument()
  })

  it('shows transaction details and paginates using the same filters', async () => {
    api.accounts.list.mockResolvedValue([{ id: 'account-1', name: 'Checking' }])
    api.transactions.list.mockImplementation(async ({ page }: { page: number }) => ({
      items: page === 1 ? [{
        id: 'transaction-1', account_id: 'account-1', description: 'Supermarket',
        notes: 'Groceries for the entire week, including fresh produce and household supplies',
        category: { name: 'Mercado' }, amount: 45, currency: 'USD',
        date: '2026-09-14', type: 'debit', status: 'pending',
      }] : [],
      total: 21, page, limit: 20,
      summary: { income: 0, expense: 45, net: -45, excluded: 25, currency: 'USD' },
    }))
    const { user } = renderWithProviders(<ReportsPage />, { route: '/reports?statuses=pending' })
    await user.click(screen.getByRole('button', { name: 'Income vs Expenses' }))
    await user.click((await screen.findAllByRole('button', { name: 'View Transactions · Mercado' })).at(-1)!)
    const dialog = screen.getByRole('dialog')
    expect(await within(dialog).findByText('Supermarket')).toHaveClass('truncate')
    expect(within(dialog).getByText('Supermarket')).toHaveAttribute('title', 'Supermarket')
    const notes = within(dialog).getByTitle('Groceries for the entire week, including fresh produce and household supplies')
    expect(notes).toHaveClass('truncate')
    expect(notes).toHaveTextContent('Groceries for the entire week, including fresh p…')
    expect(notes).not.toHaveTextContent('household supplies')
    expect(notes.parentElement).toContainElement(within(dialog).getByText('Supermarket'))
    expect(notes)
      .toHaveAttribute('title', 'Groceries for the entire week, including fresh produce and household supplies')
    expect(within(dialog).getByText('−$45.00')).toHaveClass('text-rose-500')
    expect(within(dialog).getByText('-$70.00')).toHaveClass('text-rose-500')
    expect(within(dialog).getByText(/Checking/)).toBeInTheDocument()
    expect(within(dialog).getByText('21 Transactions')).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: 'View Transactions' }))
      .toHaveAttribute('href', expect.stringContaining('status=pending'))
    await user.click(within(dialog).getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(api.transactions.list).toHaveBeenCalledWith(expect.objectContaining({
      page: 2, category_ids: [marketId], from: '2026-09-12', to: '2026-10-03', status: 'pending',
    })))
    expect(within(dialog).getByText('-$70.00')).toHaveClass('text-rose-500')
  })
})

describe('Money Map transaction drilldown', () => {
  beforeEach(() => {
    showMoneyMap()
    saveReportsRange('money_map', {
      rangeKey: 'custom', from: '2026-09-12', to: '2026-10-03', interval: 'monthly', periodOffset: 0,
    })
  })

  it('uses both statuses and opens a real category with the displayed period and type', async () => {
    const { user } = renderWithProviders(<ReportsPage />)
    await user.click(screen.getByRole('button', { name: 'Money Map' }))
    await waitFor(() => expect(api.reports.incomeExpenses.mock.calls.at(-1)?.[5]).toEqual(['posted', 'pending']))
    const category = await waitFor(() => {
      const node = document.querySelector<SVGGElement>('g[role="button"][aria-label="View Transactions · Outros"]')
      expect(node).not.toBeNull()
      return node!
    })
    fireEvent.click(category)
    await waitFor(() => expect(api.transactions.list).toHaveBeenCalledWith(expect.objectContaining({
      category_ids: [otherId], from: '2026-09-12', to: '2026-10-03', type: 'debit',
    })))
    expect(api.transactions.list.mock.calls.at(-1)?.[0]).not.toHaveProperty('status')
    expect(screen.getByRole('dialog')).toHaveTextContent('Transactions · Outros')
  })

  it('passes the selected account to a category drilldown', async () => {
    const { user } = renderWithProviders(<ReportsPage />, { route: '/reports?account_id=account-1' })
    await user.click(screen.getByRole('button', { name: 'Money Map' }))
    const category = await waitFor(() => {
      const node = document.querySelector<SVGGElement>('g[role="button"][aria-label="View Transactions · Outros"]')
      expect(node).not.toBeNull()
      return node!
    })
    fireEvent.click(category)
    await waitFor(() => expect(api.transactions.list).toHaveBeenCalledWith(expect.objectContaining({
      account_ids: ['account-1'], category_ids: [otherId],
    })))
    expect(screen.getByRole('link', { name: 'View Transactions' })).toHaveAttribute(
      'href', expect.stringContaining('account_id=account-1'),
    )
  })

  it('uses the selected pending status when opening a category by keyboard', async () => {
    const { user } = renderWithProviders(<ReportsPage />)
    await user.click(screen.getByRole('button', { name: 'Money Map' }))
    await user.click(screen.getByRole('button', { name: 'Filters' }))
    await user.click(screen.getByRole('checkbox', { name: /Posted/ }))
    await user.click(screen.getByRole('button', { name: 'Apply' }))
    expect(screen.getByRole('button', { name: 'Filters' })).toHaveTextContent('1')
    await waitFor(() => expect(api.reports.incomeExpenses.mock.calls.at(-1)?.[5]).toEqual(['pending']))
    const category = await waitFor(() => {
      const node = document.querySelector<SVGGElement>('g[role="button"][aria-label="View Transactions · Mercado"]')
      expect(node).not.toBeNull()
      return node!
    })
    fireEvent.keyDown(category, { key: 'Enter' })
    await waitFor(() => expect(api.transactions.list).toHaveBeenCalledWith(expect.objectContaining({
      category_ids: [marketId], from: '2026-09-12', to: '2026-10-03', type: 'debit', status: 'pending',
    })))
  })

  it('keeps income and investment category types when only posted transactions are selected', async () => {
    const base = report('weekly')
    api.reports.incomeExpenses.mockResolvedValue({
      ...base,
      composition: [
        ...base.composition,
        { key: salaryId, label: 'Salary', value: 200, color: '#10B981', group: 'income' },
        { key: investmentId, label: 'Investments', value: 25, color: '#0EA5E9', group: 'investments' },
      ],
    })
    const { user } = renderWithProviders(<ReportsPage />, { route: '/reports?statuses=posted' })
    await user.click(screen.getByRole('button', { name: 'Money Map' }))
    await waitFor(() => expect(api.reports.incomeExpenses.mock.calls.at(-1)?.[5]).toEqual(['posted']))
    const income = await waitFor(() => {
      const node = document.querySelector<SVGGElement>('g[role="button"][aria-label="View Transactions · Salary"]')
      expect(node).not.toBeNull()
      return node!
    })
    fireEvent.click(income)
    await waitFor(() => expect(api.transactions.list).toHaveBeenCalledWith(expect.objectContaining({
      category_ids: [salaryId], type: 'credit', status: 'posted',
    })))
    await user.keyboard('{Escape}')
    const investment = document.querySelector<SVGGElement>('g[role="button"][aria-label="View Transactions · Investments"]')
    expect(investment).not.toBeNull()
    fireEvent.click(investment!)
    await waitFor(() => expect(api.transactions.list).toHaveBeenCalledWith(expect.objectContaining({
      category_ids: [investmentId], type: 'debit', status: 'posted',
    })))
  })

  it('lets users choose a real category folded into the synthetic Other node', async () => {
    const base = report('weekly')
    const extras = Array.from({ length: 8 }, (_, index) => ({
      key: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      label: `Extra ${index}`,
      value: 8 - index,
      color: '#F43F5E',
      group: 'expenses',
    }))
    api.reports.incomeExpenses.mockResolvedValue({ ...base, composition: [...base.composition, ...extras] })
    const { user } = renderWithProviders(<ReportsPage />)
    await user.click(screen.getByRole('button', { name: 'Money Map' }))
    const folded = await waitFor(() => {
      const node = document.querySelector<SVGGElement>('g[role="button"][aria-label="View Category · Other"]')
      expect(node).not.toBeNull()
      return node!
    })
    fireEvent.click(folded)
    await user.click(screen.getByRole('button', { name: 'Extra 7' }))
    await waitFor(() => expect(api.transactions.list).toHaveBeenCalledWith(expect.objectContaining({
      category_ids: [extras[7].key], from: '2026-09-12', to: '2026-10-03', type: 'debit',
    })))
  })
})
