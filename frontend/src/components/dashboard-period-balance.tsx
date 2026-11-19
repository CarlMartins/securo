import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, formatDateRange } from '@/lib/date-range-format'
import { formatCompactCurrency, formatCurrency } from '@/lib/format'
import type { DashboardPeriodBalance } from '@/types'

export function DashboardPeriodBalanceChart({ data, loading, error, locale, dateLocale, mask }: {
  data?: DashboardPeriodBalance
  loading: boolean
  error: boolean
  locale: string
  dateLocale: string
  mask: (value: string) => string
}) {
  const { t } = useTranslation()
  const rows = useMemo(() => data?.current.map((point, index) => ({
    date: point.date,
    comparisonDate: data.comparison[index]?.date,
    current: point.change,
    comparison: data.comparison[index]?.change,
  })) ?? [], [data])
  const lastObserved = [...rows].reverse().find((row) => row.current !== null)
  const currentLabel = t('dashboard.selectedPeriod')
  const previousLabel = t('dashboard.previousPeriod')
  const money = (value: number) => mask(formatCurrency(value, data?.currency ?? 'USD', locale))

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-4 shadow-sm sm:px-5">
      <h2 className="text-base font-bold">{t('dashboard.balanceFlow')}</h2>
      <p className="text-xs text-muted-foreground">{t('dashboard.settledBalanceCaption')}</p>
      {data && (
        <p className="mt-1 text-xs text-muted-foreground">
          {previousLabel} · {formatDateRange(data.comparison_from, data.comparison_to, dateLocale)}
        </p>
      )}
      {loading ? (
        <Skeleton className="mt-4 h-60 w-full" />
      ) : error ? (
        <p className="py-12 text-center text-sm text-destructive" role="alert">{t('common.error')}</p>
      ) : !rows.some((row) => row.current !== null || row.comparison != null) ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{t('dashboard.noData')}</p>
      ) : (
        <>
          {lastObserved?.current != null && (
            <p className="mt-3 text-sm font-semibold tabular-nums">
              {t('dashboard.balancePeriodVariation')} · {money(lastObserved.current)}
            </p>
          )}
          <div className="mt-3 h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ left: 2, right: 12, top: 8 }}>
                <XAxis dataKey="date" minTickGap={26} tickFormatter={(date) => formatDate(date, dateLocale, { compact: true })} tick={{ fontSize: 10 }} />
                <YAxis width={56} tickFormatter={(value) => mask(formatCompactCurrency(value, data?.currency ?? 'USD', locale))} tick={{ fontSize: 10 }} />
                <Tooltip
                  labelFormatter={(date, entries) => {
                    const previousDate = entries[0]?.payload?.comparisonDate
                    return [formatDate(String(date), dateLocale), previousDate && formatDate(previousDate, dateLocale)].filter(Boolean).join(' · ')
                  }}
                  formatter={(value) => money(Number(value))}
                />
                <Legend />
                <Line type="linear" dataKey="current" name={currentLabel} stroke="var(--chart-income)" strokeWidth={2} dot={rows.length === 1} isAnimationActive={false} />
                <Line type="linear" dataKey="comparison" name={previousLabel} stroke="var(--muted-foreground)" strokeDasharray="5 4" dot={rows.length === 1} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}
