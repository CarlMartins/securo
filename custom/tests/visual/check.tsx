import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { api } from '@/lib/api'
import { AuthContext } from '@/contexts/auth-context'
import { WorkspaceContext } from '@/contexts/workspace-context'
import { CollectionFilterContext } from '@/contexts/collection-filter-context'
import { SidebarStateProvider } from '@/contexts/sidebar-state-provider'
import ReportsPage from '@/pages/reports'
import TransactionsPage from '@/pages/transactions'
import '@/index.css'

const input = new URLSearchParams(location.search)
const today = new Date().toISOString().slice(0, 10)
const month = today.slice(0, 7)
const rollingAnchor = new Date(month + '-01T12:00:00Z')
rollingAnchor.setUTCDate(rollingAnchor.getUTCDate() - 360)
const start = rollingAnchor.toISOString().slice(0, 7) + '-01'
const account = 'a0000000-0000-0000-0000-000000000000'
const account2 = 'b0000000-0000-0000-0000-000000000000'
const expense = { key: 'c0000000-0000-0000-0000-000000000000', group: 'expenses', label: 'Mercado sintético', color: '#bb413f', value: 90 }
const income = { key: 'd0000000-0000-0000-0000-000000000000', group: 'income', label: 'Salário sintético', color: '#0a906b', value: 140 }
const composition = [income, expense]
const breakdowns = [
  { key: 'income', label: 'Receitas', value: 140, color: income.color },
  { key: 'expenses', label: 'Despesas', value: 90, color: expense.color },
  { key: 'netIncome', label: 'Resultado', value: 50, color: '#3949ab' },
]
const series = { date: month, value: 50, breakdowns: { income: 140, expenses: 90, projectedIncome: 0, projectedExpenses: 0 }, composition }
const report = {
  summary: { primary_value: 50, change_amount: 0, change_percent: null, breakdowns },
  meta: { type: 'income_expenses', currency: 'BRL', interval: 'monthly', series_keys: ['income', 'expenses'], observed_from: start, observed_to: today },
  trend: [series], composition,
  category_trend: composition.map((category) => ({ ...category, total: category.value, series: [{ ...series, value: category.value }] })),
}
const accounts = [
  { id: account, name: 'Conta demonstração', display_name: 'Corrente fictícia', masked_number: '1234', type: 'checking', currency: 'BRL' },
  { id: account2, name: 'Conta demonstração B', display_name: 'Corrente fictícia', masked_number: '5678', type: 'checking', currency: 'BRL' },
]
const categories = composition.map((category) => ({ id: category.key, name: category.label, color: category.color }))
const transactions = [
  { id: 'ficticia-1', status: 'posted', description: 'Compra no mercado', notes: 'Cenário sintético', amount: 75, type: 'debit', category: categories[1] },
  { id: 'ficticia-2', status: 'pending', description: 'Feira de bairro', notes: 'Compra fictícia', amount: 15, type: 'debit', category: categories[1] },
  { id: 'ficticia-3', status: 'posted', description: 'Depósito de demonstração', notes: 'Receita fictícia', amount: 140, type: 'credit', category: categories[0] },
].map((tx) => ({ ...tx, account_id: account, date: today, user_id: 'sintetico', currency: 'BRL', category_id: tx.category.id, source: 'manual', splits: [] }))

api.defaults.adapter = async (config) => {
  const { url, params = {} } = config
  let data: unknown = []
  switch (url) {
    case '/reports/income-expenses': data = report; break
    case '/reports/net-worth': data = { ...report, meta: { ...report.meta, type: 'net_worth' } }; break
    case '/reports/data-range': data = { min_date: today, max_date: today }; break
    case '/accounts': data = accounts; break
    case '/categories': data = categories; break
    case '/timezones': data = { timezones: [], default: 'America/Sao_Paulo' }; break
    case '/ui-layouts': data = { dashboard: null, reports: null }; break
    case '/reports/income-expenses/transactions': {
      const rows = transactions.filter((row) => row.type === (params.group === 'income' ? 'credit' : 'debit'))
      const items = rows.map((item) => ({ ...item, account_name: accounts[0].display_name, account_number: accounts[0].masked_number, amount: item.type === 'debit' ? -item.amount : item.amount }))
      data = { items, total: items.length, total_amount: items.reduce((sum, item) => sum + item.amount, 0), currency: 'BRL' }
      break
    }
    case '/transactions': {
      const items = transactions.filter((row) => !params.type || row.type === params.type)
      data = { items: params.report_group ? items.map((item) => ({ ...item, report_amount: item.type === 'debit' ? -item.amount : item.amount })) : items,
        page: 1, limit: 20, total: items.length,
        summary: { income: params.type === 'debit' ? 0 : 140, expense: params.type === 'credit' ? 0 : 90, net: params.type === 'credit' ? 140 : -90, excluded: 0, currency: 'BRL' } }
      break
    }
  }
  return { data, status: 200, statusText: 'OK', config, headers: {} }
}

localStorage.clear()
localStorage.setItem('privacyMode', input.get('privacy') === '1' ? 'true' : 'false')
if (input.get('dark') === '1') document.documentElement.classList.add('dark')
await i18n.changeLanguage('pt-BR')
createRoot(document.getElementById('root')!).render(
  <I18nextProvider i18n={i18n}>
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthContext.Provider value={{ user: { id: 'sintetico', preferences: { currency_display: 'BRL' } } } as React.ContextType<typeof AuthContext>}>
        <WorkspaceContext.Provider value={{ current: null, canWrite: true, hasModule: () => false } as unknown as React.ContextType<typeof WorkspaceContext>}>
          <CollectionFilterContext.Provider value={{ activeAccountIds: null, activeWalletIds: null, collections: [], activeCollectionId: null, activeCollection: null, setActiveCollectionId: () => {} }}>
            <SidebarStateProvider>
              <MemoryRouter initialEntries={[`/reports?account_id=${account}`]}>
                <main className="p-4 sm:p-6"><Routes>
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/transactions" element={<TransactionsPage />} />
                </Routes></main>
              </MemoryRouter>
            </SidebarStateProvider>
          </CollectionFilterContext.Provider>
        </WorkspaceContext.Provider>
      </AuthContext.Provider>
    </QueryClientProvider>
  </I18nextProvider>,
)
