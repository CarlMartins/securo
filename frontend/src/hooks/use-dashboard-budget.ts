import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { budgets } from '@/lib/api'
import { monthRange, shiftMonth } from '@/lib/month-utils'
import type { BudgetVsActual } from '@/types'

export function useDashboardBudget(month: string, range: { from: string; to: string } | null, enabled: boolean) {
  const windows = useMemo(() => {
    if (!enabled) return []
    if (!range) return [{ month, fraction: 1 }]
    const windows = []
    for (let key = range.from.slice(0, 7); key <= range.to.slice(0, 7); key = shiftMonth(key, 1)) {
      const { to } = monthRange(key)
      const first = key === range.from.slice(0, 7) ? Number(range.from.slice(-2)) : 1
      const last = key === range.to.slice(0, 7) ? Number(range.to.slice(-2)) : Number(to.slice(-2))
      windows.push({ month: key, fraction: (last - first + 1) / Number(to.slice(-2)) })
    }
    return windows
  }, [enabled, month, range?.from, range?.to])
  return useQueries({
    queries: windows.map(({ month }) => ({
      queryKey: ['budgets', 'comparison', month],
      queryFn: () => budgets.comparison(month + '-01'),
    })),
    combine: (results) => {
      const loading = results.some((result) => result.isPending)
      const error = results.some((result) => result.isError)
      const byCategory = new Map<string, BudgetVsActual>()
      if (!loading && !error) {
        results.forEach(({ data }, index) => {
          for (const row of data ?? []) {
            if (row.budget_amount == null) {
              if (!byCategory.has(row.category_id)) byCategory.set(row.category_id, row)
              continue
            }
            const amount = Number(row.budget_amount) * windows[index].fraction
            byCategory.set(row.category_id, {
              ...row,
              budget_amount: Number(byCategory.get(row.category_id)?.budget_amount ?? 0) + amount,
            })
          }
        })
      }
      return { rows: Array.from(byCategory.values()), loading, error, refresh: () => results.forEach((result) => void result.refetch()) }
    },
  })
}
