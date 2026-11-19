import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { api } from '@/lib/api'
import { reportPointRange } from '@/lib/report-selection'
import { saveReportsRange } from '@/lib/remembered-range'
import ReportsPage from '@/pages/reports'
import TransactionsPage from '@/pages/transactions'
import { renderWithProviders } from '@/test/utils'
import type { ReportResponse, Transaction } from '@/types'

const settings = vi.hoisted(() => ({ collection: null as string[] | null }))
vi.mock('@/contexts/collection-filter-context', () => ({
  useCollectionFilter: () => ({ activeAccountIds: settings.collection, activeWalletIds: null }),
}))
vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: { id: 'viewer', preferences: { currency_display: 'BRL' } } }),
}))
vi.mock('@/contexts/workspace-context', async (original) => ({
  ...await original<typeof import('@/contexts/workspace-context')>(),
  useWorkspace: () => ({ canWrite: true, hasModule: () => false }),
}))
vi.mock('@/hooks/use-display-locale', () => ({
  useDisplayLocale: () => 'en-US',
  useDateLocale: () => 'en-US',
}))

const account = '00000000-0000-0000-0000-00000000000a'
const another = '00000000-0000-0000-0000-00000000000b'
const category = '00000000-0000-0000-0000-00000000000c'
const from = '2026-09-01'
const to = '2026-09-12'
const month = '2026-09'
const grocery = { key: category, group: 'expenses', label: 'Groceries', value: 90, color: '#be123c' }
const salary = { key: another, group: 'income', label: 'Salary', value: 100, color: '#047857' }
const point = {
  date: month, value: 10, breakdowns: { income: 100, expenses: 90, projectedIncome: 0, projectedExpenses: 20 },
  change: null, composition: [grocery, salary],
}
const report: ReportResponse = {
  meta: { type: 'income_expenses', currency: 'BRL', interval: 'monthly', series_keys: [],
    observed_from: from, observed_to: to },
  summary: {
    primary_value: 10, change_amount: 0, change_percent: null,
    breakdowns: [
      { key: 'income', value: 100, label: 'Income', color: '#047857' },
      { key: 'expenses', value: 90, label: 'Expenses', color: '#be123c' },
    ],
  },
  trend: [point],
  composition: [grocery, salary],
  category_trend: [
    { ...grocery, total: 90, series: [{ ...point, value: 90 }] },
    { ...salary, total: 100, series: [{ ...point, value: 100 }] },
    { ...grocery, key: 'other', label: 'Other', total: 5, series: [{ ...point, value: 5 }] },
  ],
}
const fixtureAccounts = [
  { id: account, name: 'Checking', display_name: 'Current', masked_number: '1234', type: 'checking' },
  { id: another, name: 'Checking', display_name: 'Current', masked_number: '5678', type: 'checking' },
]
const baseTx = {
  id: 'movement-a', user_id: 'viewer', account_id: account, description: 'Market purchase',
  date: '2026-09-13', reporting_date_override: to, type: 'debit', status: 'posted',
  amount: 120, report_amount: '-75.00', currency: 'BRL', source: 'manual',
  category_id: category, notes: 'Synthetic description', splits: [],
} as unknown as Transaction

function RouteIndicator() {
  const { pathname, search } = useLocation()
  return <output data-testid="current-route">{pathname}{search}</output>
}
const routes = (
  <>
    <RouteIndicator />
    <Routes>
      <Route path="/reports" element={<ReportsPage />} />
      <Route path="/transactions" element={<TransactionsPage />} />
    </Routes>
  </>
)
const originalAdapter = api.defaults.adapter
let fixture: ReportResponse
let pageFixture: number | 'error' | null
let requests: { url: string | undefined; params: Record<string, unknown> }[]

beforeEach(() => {
  settings.collection = null
  fixture = report
  pageFixture = null
  requests = []
  const measure = HTMLElement.prototype.getBoundingClientRect
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('privacy-sensitive')
      ? DOMRect.fromRect({ width: 800, height: 360 })
      : measure.call(this)
  })
  api.defaults.adapter = async (config) => {
    const params = config.params ?? {}
    requests.push({ url: config.url, params })
    let data: unknown = []
    if (config.url === '/reports/income-expenses') data = fixture
    if (config.url === '/reports/net-worth') data = { ...report, meta: { ...report.meta, type: 'net_worth' } }
    if (config.url === '/reports/data-range') data = { min_date: null, max_date: null }
    if (config.url?.startsWith('/ui-layouts')) data = { reports: null, dashboard: null }
    if (config.url === '/accounts') data = fixtureAccounts
    if (config.url === '/categories') data = [{ id: category, name: 'Groceries', color: '#be123c' }]
    if (config.url === '/timezones') data = { timezones: [], default: null }
    if (config.url === '/reports/income-expenses/transactions') {
      const income = params.group === 'income'
      const items = [{
        id: 'movement-a', description: income ? 'Salary payment' : 'Market purchase', notes: null,
        account_name: 'Current', account_number: '1234', date: to, bank_date: '2026-09-13',
        status: 'posted', amount: income ? '100.00' : '-75.00',
      }, ...income ? [] : [{
        id: 'movement-b', description: 'Pending purchase', notes: 'Synthetic notes',
        account_name: 'Current', account_number: '1234', date: to, bank_date: to,
        status: 'pending', amount: '-15.00',
      }]]
      if (pageFixture === 'error') throw new Error('Synthetic request failure')
      if (pageFixture !== null) {
        const all = Array.from({ length: pageFixture }, (_, i) => ({
          ...items[0], id: `movement-${i + 1}`, description: `Synthetic item ${i + 1}`, amount: '-1.00',
        }))
        const offset = (params.page - 1) * params.limit
        data = { currency: 'BRL', total: all.length, total_amount: `-${all.length}.00`,
          items: all.slice(offset, offset + params.limit) }
      } else {
        data = { currency: 'BRL', total: items.length, total_amount: income ? '100.00' : '-90.00', items }
      }
    }
    if (config.url === '/transactions') {
      const selected = params.q === 'Pending' ? [] : [baseTx]
      data = { items: selected, total: selected.length, page: 1, limit: 20,
        summary: { income: 0, expense: 75, net: -75, excluded: 0, currency: 'BRL' } }
    }
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
})

afterEach(() => {
  api.defaults.adapter = originalAdapter
  vi.restoreAllMocks()
})

async function openReport(tab = 'Income vs Expenses', params = '') {
  const result = renderWithProviders(routes, { route: `/reports${params}` })
  await result.user.click(screen.getByRole('button', { name: tab }))
  return result
}

function lastRequest(url: string) {
  return requests.filter((request) => request.url === url).at(-1)?.params
}

async function detail(title: string) {
  const modal = await screen.findByRole('dialog', { name: title })
  await within(modal).findByRole('link', { name: 'View transactions' })
  return modal
}

describe('report drill-down acceptance', () => {
  it('UI-01/02 opens the same selection from the composition slice and legend', async () => {
    const { user } = await openReport()
    const slice = await waitFor(() => {
      const node = screen.getAllByRole('button', { name: 'Groceries' }).find((item) => item instanceof SVGElement)
      expect(node).toBeDefined()
      return node!
    })
    const legend = screen.getAllByRole('button', { name: 'Groceries' }).find((node) => node instanceof HTMLButtonElement)
    expect(legend).toBeDefined()
    fireEvent.click(slice)
    await detail('Transactions – Groceries')
    const selection = lastRequest('/reports/income-expenses/transactions')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await user.click(legend!)
    await detail('Transactions – Groceries')
    expect(lastRequest('/reports/income-expenses/transactions')).toEqual(selection)
  })

  it('UI-03/09/10/11/12/18 links the category trend to the native list, with real controls and amounts', async () => {
    const { user } = await openReport('Income vs Expenses', `?account_id=${account}`)
    const card = await screen.findByRole('button', { name: /^Groceries.*90/ })
    await user.click(card)
    const modal = await detail('Transactions – Groceries')
    expect(within(modal).getAllByRole('listitem')).toHaveLength(2)
    expect(modal).toHaveTextContent('2 transactions')
    expect(modal).toHaveTextContent(/−?\s*R\$\s*90\.00/)
    expect(screen.queryByRole('button', { name: /^Other.*5/ })).not.toBeInTheDocument()
    expect(lastRequest('/reports/income-expenses/transactions')).toMatchObject({
      account_ids: [account], statuses: 'posted,pending', start_date: from, end_date: to, category,
    })
    await user.click(within(modal).getByRole('link', { name: 'View transactions' }))
    expect(await screen.findByRole('heading', { name: 'Transactions' })).toBeInTheDocument()
    expect(screen.getByTestId('transactions-page-actions')).toBeInTheDocument()
    expect(await screen.findByText('Market purchase')).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByTestId('current-route')).toHaveTextContent('/transactions?')
    expect(screen.getByRole('button', { name: /Report contributions.*Posted.*Pending/ })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /Account.*Current.*1234/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Category.*Groceries/ })).toBeInTheDocument()
    expect(lastRequest('/transactions')).toMatchObject({
      account_ids: [account], category_ids: [category], type: 'debit', from, to,
      report_group: 'expenses', exclude_ignored: true,
    })
    expect(screen.getAllByText(/-R\$\s*75\.00/).length).toBeGreaterThan(0)
    await user.type(screen.getByPlaceholderText(/search/i), 'Pending')
    await waitFor(() => expect(lastRequest('/transactions')).toMatchObject({ q: 'Pending', report_group: 'expenses' }))
    expect(screen.queryByText('Market purchase')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Report contributions/ }))
    await waitFor(() => expect(lastRequest('/transactions')).not.toHaveProperty('report_group'))
  })

  it('UI-04/16 clips observed bars and keeps projected bars noninteractive', async () => {
    fixture = { ...report, meta: { ...report.meta, observed_from: '2026-08-12' } }
    const { user } = await openReport()
    const bar = await screen.findByRole('button', { name: 'Expenses · 2026-09' })
    expect(screen.queryByRole('button', { name: /Projected Expenses ·/i })).not.toBeInTheDocument()
    bar.focus()
    await user.keyboard('{Enter}')
    await detail('Transactions – Expenses')
    expect(lastRequest('/reports/income-expenses/transactions')).toMatchObject({
      start_date: '2026-08-12', end_date: to, selection_from: from, selection_to: to, group: 'expenses',
    })
  })

  it('UI-05/06 opens category, folds smaller nodes and keeps a real Other distinct', async () => {
    fixture = {
      ...report,
      composition: Array.from({ length: 11 }, (_, i) => ({
        ...grocery, key: i === 0 ? 'uncategorized' : `category-${i + 1}`,
        label: i === 10 ? 'Other' : `Expense ${i + 1}`, value: i + 1,
      })),
    }
    const { user } = await openReport('Money Map')
    const chart = await screen.findByRole('group', { name: /Cashflow diagram/ })
    const otherNodes = within(chart).getAllByRole('button', { name: 'Other' })
    expect(otherNodes).toHaveLength(2)
    otherNodes[1].focus()
    await user.keyboard(' ')
    const chooser = await screen.findByRole('dialog', { name: 'Other · Expenses' })
    expect(within(chooser).getAllByRole('listitem')).toHaveLength(3)
    await user.click(within(chooser).getByRole('button', { name: /Uncategorized/ }))
    await detail('Transactions – Uncategorized')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    otherNodes[0].focus()
    await user.keyboard('{Enter}')
    await detail('Transactions – Other')
    expect(lastRequest('/reports/income-expenses/transactions')).toMatchObject({ category: 'category-11' })
  })

  it.each([
    ['UI-07', 'Salary', 'text-emerald-700', false],
    ['UI-07', 'Salary', 'text-emerald-700', true],
    ['UI-08', 'Groceries', 'text-red-800', false],
    ['UI-08', 'Groceries', 'text-red-800', true],
  ])('%s %s keeps financial colour with privacy %s %s', async (_id, name, color, privacyOn) => {
    localStorage.setItem('privacyMode', String(privacyOn))
    await openReport()
    const legend = (await screen.findAllByRole('button', { name })).find((node) => node instanceof HTMLButtonElement)
    fireEvent.click(legend!)
    const modal = await detail(`Transactions – ${name}`)
    const values = modal.querySelectorAll(`.${color}`)
    expect(values.length).toBeGreaterThan(1)
    for (const value of values) {
      expect(value).toHaveTextContent(privacyOn ? '•••••' : /R\$/)
      if (_id === 'UI-08') expect(value).toHaveClass('dark:text-red-500')
    }
    if (privacyOn) expect(modal).not.toHaveTextContent(/R\$/)
  })

  it('UI-13/14/17 discards a keyboard draft, then applies shared filters and restores them from the URL', async () => {
    const { user } = await openReport('Income vs Expenses', '?example=kept')
    const filters = screen.getByRole('button', { name: 'Filters' })
    filters.focus()
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('checkbox', { name: /5678/ })).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Posted' }))
    await user.click(screen.getByRole('checkbox', { name: /5678/ }))
    expect(lastRequest('/reports/income-expenses')).toMatchObject({ statuses: 'posted,pending' })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(filters).toHaveFocus())
    await user.keyboard('{Enter}')
    expect(screen.getByRole('checkbox', { name: 'Posted' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /5678/ })).not.toBeChecked()
    await user.click(screen.getByRole('checkbox', { name: 'Posted' }))
    expect(screen.getByRole('checkbox', { name: 'Pending' })).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: /5678/ }))
    await user.click(screen.getByRole('button', { name: 'Apply' }))
    await waitFor(() => expect(lastRequest('/reports/income-expenses')).toMatchObject({
      statuses: 'pending', account_ids: [another],
    }))
    expect(screen.getByTestId('current-route')).toHaveTextContent('example=kept&statuses=pending&account_id=')
    expect(filters).toHaveAccessibleDescription(/Pending.*1 account/i)
    await user.click(screen.getByRole('button', { name: 'Money Map' }))
    const chart = await screen.findByRole('group', { name: /Cashflow diagram/ })
    await user.click(within(chart).getByRole('button', { name: 'Groceries' }))
    const modal = await detail('Transactions – Groceries')
    const link = within(modal).getByRole('link', { name: 'View transactions' })
    expect(link).toHaveAttribute('href', expect.stringContaining('status=pending'))
    expect(lastRequest('/reports/income-expenses/transactions')).toMatchObject({
      statuses: 'pending', account_ids: [another],
    })
  })

  it('UI-12 rebuilds the source selection from a direct native route load', async () => {
    const { user } = renderWithProviders(routes, { route: `/transactions?report_group=expenses&report_from=${from}&report_to=${to}&from=${from}&to=${to}&uncategorized=1&type=debit&status=pending&account_id=${account}` })
    expect(await screen.findByRole('heading', { name: 'Transactions' })).toBeInTheDocument()
    await waitFor(() => expect(lastRequest('/transactions')).toMatchObject({
      report_group: 'expenses', report_from: from, report_to: to, from, to,
      uncategorized: true, type: 'debit', status: 'pending', account_ids: [account],
    }))
    await user.click(screen.getByRole('button', { name: /Status.*Pending/ }))
    await waitFor(() => expect(lastRequest('/transactions')).toMatchObject({
      report_group: 'expenses', status: undefined,
    }))
    expect(await screen.findByRole('button', { name: /Report contributions.*Posted.*Pending/ })).toBeInTheDocument()
  })

  it('UI-16/U07 keeps the chosen dates and steps the picker with the query', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(new Date(2026, 8, 12, 12))
      saveReportsRange('income_expenses', {
        rangeKey: 'custom', from, to: '2026-09-20', interval: 'monthly', periodOffset: 0,
      })
      const { user } = await openReport()
      await waitFor(() => expect(lastRequest('/reports/income-expenses')).toMatchObject({
        start_date: from, end_date: '2026-09-20',
      }))
      expect(screen.getByRole('button', { name: 'Custom range' })).toHaveTextContent(/Sep.*20/)
      await user.click(screen.getByRole('button', { name: 'Previous period' }))
      await waitFor(() => expect(lastRequest('/reports/income-expenses')).toMatchObject({
        start_date: '2026-08-01', end_date: '2026-08-20',
      }))
      expect(screen.getByRole('button', { name: 'Custom range' })).toHaveTextContent(/Aug.*20/)
    } finally {
      vi.useRealTimers()
    }
  })

  it('U05 paginates distinct movements while retaining the full total', async () => {
    pageFixture = 21
    const { user } = await openReport()
    await user.click(await screen.findByRole('button', { name: /^Groceries.*90/ }))
    const modal = await detail('Transactions – Groceries')
    expect(within(modal).getAllByRole('listitem')).toHaveLength(20)
    await user.click(within(modal).getByRole('button', { name: 'Next' }))
    expect(await within(modal).findByText('Synthetic item 21')).toBeInTheDocument()
    expect(within(modal).getAllByRole('listitem')).toHaveLength(1)
    expect(modal).toHaveTextContent('21 transactions')
    expect(within(modal).getByText('Total').parentElement).toHaveTextContent(/21\.00/)
  })

  it.each([0, 'error'] as const)('U05 distinguishes empty and error states (%s)', async (state) => {
    pageFixture = state
    const { user } = await openReport()
    await user.click(await screen.findByRole('button', { name: /^Groceries.*90/ }))
    const modal = await screen.findByRole('dialog', { name: 'Transactions – Groceries' })
    if (state === 'error') {
      expect(await within(modal).findByRole('alert')).toBeInTheDocument()
      expect(within(modal).queryByRole('link', { name: 'View transactions' })).not.toBeInTheDocument()
    } else {
      await within(modal).findByRole('link', { name: 'View transactions' })
      expect(within(modal).queryByRole('alert')).not.toBeInTheDocument()
      expect(modal).toHaveTextContent('0 transactions')
    }
  })

  it('M05 marks the projected amount separately and reconciles the category total', async () => {
    fixture = {
      ...report,
      category_trend: report.category_trend.map((item) => item.key === category
        ? { ...item, total: 110, projected_value: 20 }
        : item),
    }
    const { user } = await openReport()
    await user.click(await screen.findByRole('button', { name: /^Groceries.*110/ }))
    const modal = await detail('Transactions – Groceries')
    expect(within(modal).getByText('Observed').parentElement).toHaveTextContent(/90\.00/)
    expect(within(modal).getByText('Projected').parentElement).toHaveTextContent(/20\.00/)
    expect(within(modal).getByText('Total').parentElement).toHaveTextContent(/110\.00/)
    expect(within(modal).getAllByRole('listitem')).toHaveLength(2)
  })

  it('UI-15 renders an empty state without broadening an empty intersection', async () => {
    settings.collection = [account]
    await openReport('Money Map', `?account_id=${another}`)
    expect((await screen.findAllByText('No data available for this period')).length).toBeGreaterThan(0)
    expect(lastRequest('/reports/income-expenses')).toBeUndefined()
  })
})

describe('U04 chart date labels', () => {
  const source = { from: '2026-09-12', to: '2026-10-02' }
  it.each([
    ['2026-W37', 'weekly', { from: '2026-09-12', to: '2026-09-13' }],
    ['2026-W40', 'weekly', { from: '2026-09-28', to: '2026-10-02' }],
    ['2026-09', 'monthly', { from: '2026-09-12', to: '2026-09-30' }],
    ['2026', 'yearly', source],
    ['2026-09-14', 'daily', { from: '2026-09-14', to: '2026-09-14' }],
    ['2026-09-11', 'daily', null],
    ['2026-02-30', 'daily', null],
  ] as const)('limits %s (%s) to the active range', (label, interval, expected) => {
    expect(reportPointRange(label, interval, source)).toEqual(expected)
  })
})
