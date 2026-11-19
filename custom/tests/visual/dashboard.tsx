import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { api } from '@/lib/api'
import { addDaysIso } from '@/lib/report-period'
import { AuthContext } from '@/contexts/auth-context'
import { WorkspaceContext } from '@/contexts/workspace-context'
import { CollectionFilterContext } from '@/contexts/collection-filter-context'
import { TooltipProvider } from '@/components/ui/tooltip'
import DashboardPage from '@/pages/dashboard'
import TransactionsPage from '@/pages/transactions'
import '@/index.css'

const input = new URLSearchParams(location.search)
const from = '2026-09-28'
const to = '2026-10-04'
const first = 'a0000000-0000-4000-8000-000000000000'
const second = 'b0000000-0000-4000-8000-000000000000'
const account = { id: first, name: 'Corrente fictícia', masked_number: '1234', type: 'checking', currency: 'BRL', current_balance: 6750 }
const accounts = [account, { ...account, id: second, masked_number: '5678', current_balance: 250 }]
const market = { id: 'market', name: 'Mercado', icon: 'shopping-cart', color: '#e76b51' }
const house = { id: 'house', name: 'Moradia', icon: 'house', color: '#7766ce' }
const rows = [
  { id: '1', description: 'Compra pendente', type: 'debit', status: 'pending', date: '2026-10-01', amount: 300, category: market },
  { id: '2', description: 'Compra no mercado', type: 'debit', status: 'posted', date: '2026-09-30', amount: 200, category: market },
  { id: '3', description: 'Aluguel de demonstração', type: 'debit', status: 'posted', date: '2026-09-29', amount: 750, category: house },
  { id: '4', description: 'Receita de demonstração', type: 'credit', status: 'posted', date: '2026-09-28', amount: 2400, category: null },
].map((row) => ({
  ...row, account_id: first, report_date: row.date, account_name: account.name,
  account_number: account.masked_number, source: 'manual', currency: 'BRL', notes: null,
  category_id: row.category?.id, report_amount: row.type === 'debit' ? -row.amount : row.amount,
}))
const spending = [[house, 750], [market, 500]].map(([category, value]) => {
  const { id, name, icon, color } = category as typeof house
  return { category_id: id, category_name: name, category_icon: icon, category_color: color, total: value, projected_total: value }
})
const current = [2400, 1650, 1450, 1450, 1450, null, null]
const previous = [220, 150, -80, -250, -390, -60, 80]
const series = (start: string, changes: Array<number | null>) => changes.map((change, i) => ({
  date: addDaysIso(start, i), change, balance: change === null ? null : 5300 + change,
}))

api.defaults.adapter = async (config) => {
  const { url, params = {} } = config
  let data: unknown = []
  switch (url) {
    case '/ui-layouts': data = { dashboard: ['overview', 'spending-by-category', 'balance-flow', 'transactions'].map((id) => ({ id })) }; break
    case '/accounts': data = accounts; break
    case '/categories': data = [market, house]; break
    case '/timezones': data = { default: 'America/Sao_Paulo', timezones: [] }; break
    case '/dashboard/summary':
      data = { total_balance: { BRL: 6750 }, total_balance_primary: 6750, projected_balance_primary: 6750, primary_currency: 'BRL', pending_shares_net: 0 }
      break
    case '/dashboard/period':
      data = {
        currency: 'BRL', posted_income: '2400.00', pending_income: '0.00',
        posted_expenses: '950.00', pending_expenses: '300.00', additional_projected_income: '0.00',
        additional_projected_expenses: '0.00', spending, missing_fx_count: 0,
        uncategorized_count: 0, uncategorized_amount: '0.00',
      }
      break
    case '/dashboard/balance-period':
      data = {
        currency: 'BRL', comparison_from: '2026-09-21', comparison_to: '2026-09-27',
        current: series(from, current), comparison: series('2026-09-21', previous),
      }
      break
    case '/transactions/calendar': {
      const month = params.month.slice(0, 7) as string
      const start = month === '2026-09' ? '2026-08-30' : '2026-09-27'
      const days = Array.from({ length: 35 }, (_, index) => {
        const date = addDaysIso(start, index)
        const inMonth = date.startsWith(month)
        const unavailable = !inMonth || date < from || date > '2026-10-02'
        const items = unavailable ? [] : rows.filter((row) => row.date === date).map((row) => ({ ...row, kind: 'actual', amount_primary: row.amount }))
        const income = items.filter((row) => row.type === 'credit').reduce((total, row) => total + row.amount, 0)
        const expense = items.filter((row) => row.type === 'debit').reduce((total, row) => total + row.amount, 0)
        return {
          date, in_month: inMonth, unavailable, items,
          ending_balance: series(from, current).find((point) => point.date === date)?.balance ?? 0,
          income, expense, actual_income: income, actual_expense: expense,
          transfer_net: 0, projected_income: 0, projected_expense: 0,
          actual_count: items.length, projected_count: 0, has_income: income > 0, has_expense: expense > 0, has_transfer: false,
        }
      })
      data = { month, days, currency: 'BRL' }
      break
    }
    case '/transactions': {
      const items = rows.filter((item) => !params.type || item.type === params.type)
      data = {
        items, total: items.length, page: 1, limit: 20,
        summary: { income: params.type === 'debit' ? 0 : 2400, expense: 1250, net: params.type === 'debit' ? -1250 : 1150, excluded: 0, currency: 'BRL' },
      }
      break
    }
    case '/reports/income-expenses/transactions': {
      const items = rows.filter((row) => row.type === 'debit').map((row) => ({ ...row, amount: row.report_amount }))
      data = { items, total: items.length, total_amount: -1250, currency: 'BRL' }
      break
    }
  }
  return { data, status: 200, statusText: 'OK', config, headers: {} }
}

localStorage.clear()
localStorage.setItem('privacyMode', input.get('privacy') === '1' ? 'true' : 'false')
if (input.get('dark') === '1') document.documentElement.classList.add('dark')
await i18n.changeLanguage('pt-BR')
const route = `/?from=${from}&to=${to}&account_id=${first}${input.get('view') === 'calendar' ? '&view=calendar' : ''}`
createRoot(document.getElementById('root')!).render(
  <I18nextProvider i18n={i18n}>
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthContext.Provider value={{ user: { id: 'fixture', preferences: { currency_display: 'BRL' } } } as React.ContextType<typeof AuthContext>}>
        <WorkspaceContext.Provider value={{ current: null, canWrite: true, hasModule: () => false } as unknown as React.ContextType<typeof WorkspaceContext>}>
          <CollectionFilterContext.Provider value={{ activeAccountIds: null, activeWalletIds: null, collections: [], activeCollectionId: null, activeCollection: null, setActiveCollectionId: () => {} }}>
            <TooltipProvider>
              <MemoryRouter initialEntries={[route]}>
              <main className="p-4 sm:p-6"><Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/transactions" element={<TransactionsPage />} />
              </Routes></main>
              </MemoryRouter>
            </TooltipProvider>
          </CollectionFilterContext.Provider>
        </WorkspaceContext.Provider>
      </AuthContext.Provider>
    </QueryClientProvider>
  </I18nextProvider>,
)
