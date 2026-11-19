import { useQuery } from '@tanstack/react-query'
import { budgets } from '@/lib/api'

export function useDashboardBudget(month: string, range: { from: string } | null, enabled: boolean) {
  const budgetMonth = range?.from.slice(0, 7) ?? month
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['budgets', 'comparison', budgetMonth],
    queryFn: () => budgets.comparison(budgetMonth + '-01'),
    enabled,
  })
  return { budgetMonth, rows: enabled ? data ?? [] : [], loading: isLoading, error: enabled && isError, refresh: refetch }
}
