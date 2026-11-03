import { afterEach, expect, it, vi } from 'vitest'
import { api, reports } from './api'

afterEach(() => vi.restoreAllMocks())

it('sends selected Income vs Expenses statuses and exact custom dates', async () => {
  const get = vi.spyOn(api, 'get').mockResolvedValue({ data: {} })
  await reports.incomeExpenses(1, 'monthly', undefined, undefined, undefined,
    ['posted', 'pending'], '2026-09-12', '2026-10-02')

  expect(get).toHaveBeenCalledWith('/reports/income-expenses', expect.objectContaining({
    params: expect.objectContaining({
      statuses: 'posted,pending', start_date: '2026-09-12', end_date: '2026-10-02',
    }),
  }))

  await reports.incomeExpenses()
  expect(get.mock.calls.at(-1)?.[1]?.params).not.toHaveProperty('statuses')
})
