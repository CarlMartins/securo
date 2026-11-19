import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useDateLocale, useDisplayLocale } from '@/hooks/use-display-locale'
import { usePrivacyMode } from '@/hooks/use-privacy-mode'
import { reports } from '@/lib/api'
import { extractApiError } from '@/lib/api-errors'
import { formatDate, formatDateRange } from '@/lib/date-range-format'
import { formatCurrency } from '@/lib/format'
import { reportTransactionsUrl, type ReportSelection } from '@/lib/report-selection'

const PAGE_SIZE = 20

export function ReportTransactionsDialog({ selection, onClose }: {
  selection: ReportSelection
  onClose: () => void
}) {
  const { t } = useTranslation()
  const dateLocale = useDateLocale()
  const locale = useDisplayLocale()
  const { mask } = usePrivacyMode()
  const [page, setPage] = useState(1)
  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: ['reports', 'transactions', selection, page],
    queryFn: () => reports.incomeExpenseTransactions(selection, page, PAGE_SIZE),
    placeholderData: keepPreviousData,
  })
  const statusLabel = (status: string) => t(status === 'posted' ? 'transactions.statusPosted' : 'transactions.statusPending')
  const context = [
    selection.range.from === selection.range.to
      ? formatDate(selection.range.from, dateLocale)
      : formatDateRange(selection.range.from, selection.range.to, dateLocale),
    t(`reports.${selection.group}`),
    selection.statuses.map(statusLabel).join(' + '),
  ].join(' · ')
  const color = selection.group === 'income'
    ? 'text-emerald-700 dark:text-emerald-400'
    : 'text-red-800 dark:text-red-500'
  const signedProjection = selection.projected * (selection.group === 'income' ? 1 : -1)
  const money = (value: number) => mask(`${value > 0 ? '+' : ''}${formatCurrency(value, data?.currency ?? 'USD', locale)}`)
  const pages = Math.ceil((data?.total ?? 0) / PAGE_SIZE)

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[90dvh] min-w-0 flex-col gap-3 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('transactions.title')} – {selection.label}</DialogTitle>
          <DialogDescription>{context}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto rounded-lg border border-border" aria-live="polite" aria-busy={isFetching}>
          {isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : error ? (
            <p className="p-4 text-sm text-destructive" role="alert">{extractApiError(error)}</p>
          ) : data?.items.length ? (
            <ul className="divide-y divide-border">
              {data.items.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-2 px-3 py-2.5 text-sm sm:gap-4 sm:px-4">
                  <div className="min-w-0">
                    <p className="break-words font-medium">{item.description}</p>
                    {item.notes && <p className="truncate text-xs text-muted-foreground" title={item.notes}>{item.notes}</p>}
                    <p className="break-words text-xs text-muted-foreground">
                      {[item.account_name, item.account_number ? `••${item.account_number}` : null,
                        formatDate(item.date, dateLocale)].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`font-semibold tabular-nums ${color}`}>{money(Number(item.amount))}</p>
                    <p className="text-xs text-muted-foreground">{statusLabel(item.status)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-4 text-sm text-muted-foreground">{t('transactions.noResults')}</p>
          )}
        </div>
        {data && (
          <div className="space-y-1 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
            {signedProjection !== 0 && (
              <>
                <div className="flex justify-between gap-3"><span>{t('reports.drilldown.observed')}</span><span className={color}>{money(Number(data.total_amount))}</span></div>
                <div className="flex justify-between gap-3"><span>{t('reports.drilldown.projected')}</span><span className={color}>{money(signedProjection)}</span></div>
              </>
            )}
            <div className="flex justify-between gap-3 font-semibold">
              <span>{t('reports.drilldown.total')}</span>
              <span className={`tabular-nums ${color}`}>{money(Number(data.total_amount) + signedProjection)}</span>
            </div>
          </div>
        )}
        <DialogFooter className="items-center gap-2 sm:justify-between">
          <p className="text-xs text-muted-foreground">{data ? t('transactions.summaryCount', { count: data.total }) : ''}</p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {pages > 1 && (
              <>
                <Button size="icon-sm" variant="outline" aria-label={t('common.previous')} disabled={page <= 1 || isFetching} onClick={() => setPage(page - 1)}><ChevronLeft /></Button>
                <span className="text-xs tabular-nums">{page}/{pages}</span>
                <Button size="icon-sm" variant="outline" aria-label={t('common.next')} disabled={page >= pages || isFetching} onClick={() => setPage(page + 1)}><ChevronRight /></Button>
              </>
            )}
            {data && <Button asChild size="sm"><Link to={reportTransactionsUrl(selection)}>{t('reports.statementViewTransactions')}</Link></Button>}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
