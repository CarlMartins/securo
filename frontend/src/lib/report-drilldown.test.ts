import { describe, expect, it } from 'vitest'
import {
  reportBarWindow,
  historicalReportWindow,
  reportTransactionFilters,
  reportTransactionsLink,
  visibleReportWindow,
} from './report-drilldown'

const reportWindow = { from: '2026-09-12', to: '2026-10-03' }

describe('Income vs Expenses transaction drilldown', () => {
  it('uses the visible custom window, including a navigated window', () => {
    expect(visibleReportWindow({ kind: 'custom' }, '2026-11-03', reportWindow)).toEqual(reportWindow)
    expect(visibleReportWindow({ kind: 'days', days: 30 }, '2026-11-03', null))
      .toEqual({ from: '2026-10-05', to: '2026-11-03' })
    expect(visibleReportWindow({ kind: 'ytd', fyStartMonth: 4 }, '2026-11-03', null))
      .toEqual({ from: '2026-04-01', to: '2026-11-03' })
  })

  it('limits a future custom range to today for transaction drilldowns', () => {
    expect(historicalReportWindow({ from: '2026-09-01', to: '2026-09-20' }, '2026-09-12'))
      .toEqual({ from: '2026-09-01', to: '2026-09-12' })
    expect(historicalReportWindow({ from: '2026-09-13', to: '2026-09-20' }, '2026-09-12'))
      .toBeNull()
  })

  it('clips ISO week, day, month, and year bars to the report window', () => {
    expect(reportBarWindow('2026-W37', 'weekly', reportWindow))
      .toEqual({ from: '2026-09-12', to: '2026-09-13' })
    expect(reportBarWindow('2026-W40', 'weekly', reportWindow))
      .toEqual({ from: '2026-09-28', to: '2026-10-03' })
    expect(reportBarWindow('2026-09-14', 'daily', reportWindow))
      .toEqual({ from: '2026-09-14', to: '2026-09-14' })
    expect(reportBarWindow('2026-09', 'monthly', reportWindow))
      .toEqual({ from: '2026-09-12', to: '2026-09-30' })
    expect(reportBarWindow('2026', 'yearly', reportWindow)).toEqual(reportWindow)
    expect(reportBarWindow('2026-W36', 'weekly', reportWindow)).toBeNull()
  })

  it('maps a real Outros category, statuses, accounts and type to the existing transaction API', () => {
    const selection = {
      ...reportWindow, type: 'debit' as const, label: 'Outros',
      categoryId: '64aac812-a06e-4589-b8c3-e0875eef46cf',
    }
    const both = reportTransactionFilters(selection, ['posted', 'pending'], ['account-1'])
    expect(both).toMatchObject({
      page: 1, limit: 20, from: '2026-09-12', to: '2026-10-03', type: 'debit',
      category_ids: ['64aac812-a06e-4589-b8c3-e0875eef46cf'],
      account_ids: ['account-1'], sort_by: 'date', sort_dir: 'desc',
    })
    expect(both).not.toHaveProperty('status')
    expect(reportTransactionFilters(selection, ['posted'], null)).toHaveProperty('status', 'posted')
    expect(reportTransactionFilters(selection, ['pending'], null)).toHaveProperty('status', 'pending')
    expect(reportTransactionsLink(selection, ['pending'], ['account-1']))
      .toContain('category_id=64aac812-a06e-4589-b8c3-e0875eef46cf')
  })

  it('filters uncategorized rows without inventing a category ID', () => {
    const params = reportTransactionFilters({ ...reportWindow, type: 'credit', label: 'Uncategorized', uncategorized: true }, ['posted', 'pending'], null)
    expect(params).toHaveProperty('uncategorized', true)
    expect(params).not.toHaveProperty('category_ids')
  })
})
