import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { accounts, transactions } from '@/lib/api'
import { extractApiError } from '@/lib/api-errors'
import { formatDate, formatDateRange } from '@/lib/date-range-format'
import { formatCurrency } from '@/lib/format'
import {
  reportTransactionFilters,
  reportTransactionsLink,
  type ReportTransactionSelection,
  type ReportTransactionStatus,
} from '@/lib/report-drilldown'
import { useDateLocale, useDisplayLocale } from '@/hooks/use-display-locale'
import { usePrivacyMode } from '@/hooks/use-privacy-mode'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface ReportTransactionsDialogProps {
  selection: ReportTransactionSelection
  statuses: readonly ReportTransactionStatus[]
  accountIds: readonly string[] | null
  onClose: () => void
}

const NOTES_PREVIEW_LENGTH = 48

export function ReportTransactionsDialog({ selection, statuses, accountIds, onClose }: ReportTransactionsDialogProps) {
  const { t } = useTranslation()
  const dateLocale = useDateLocale()
  const locale = useDisplayLocale()
  const { mask } = usePrivacyMode()
  const [page, setPage] = useState(1)
  const filters = reportTransactionFilters(selection, statuses, accountIds, page)
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['report-transactions', filters],
    queryFn: () => transactions.list(filters),
  })
  const { data: accountList } = useQuery({
    queryKey: ['accounts', 'all'],
    queryFn: () => accounts.list(true),
    staleTime: 60_000,
  })
  const accountNames = new Map(accountList?.map((account) => [account.id, account.name]) ?? [])
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / filters.limit))
  const statusLabel = statuses.length === 2
    ? t('reports.postedAndPending')
    : t(statuses[0] === 'posted' ? 'reports.postedTransactions' : 'reports.pendingTransactions')
  const signedTotal = data?.summary
    ? selection.type === 'credit'
      ? data.summary.income + data.summary.excluded
      : -(data.summary.expense + data.summary.excluded)
    : null

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-[calc(100%-2rem)] flex-col gap-3 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('transactions.title')} · {selection.label}</DialogTitle>
          <DialogDescription>
            {formatDateRange(selection.from, selection.to, dateLocale)} · {t(selection.type === 'credit' ? 'reports.income' : 'reports.expenses')} · {statusLabel}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border">
          {isLoading ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : isError ? (
            <p role="alert" className="px-4 py-8 text-center text-sm text-destructive">{extractApiError(error)}</p>
          ) : data?.items.length ? (
            <ul className="divide-y divide-border">
              {data.items.map((tx) => {
                const amount = tx.is_shared && tx.viewer_share != null ? tx.viewer_share : tx.amount
                const accountName = tx.account_id ? accountNames.get(tx.account_id) : null
                const notes = tx.notes?.trim()
                const notesPreview = notes && notes.length > NOTES_PREVIEW_LENGTH
                  ? `${notes.slice(0, NOTES_PREVIEW_LENGTH).trimEnd()}…`
                  : notes
                return (
                  <li key={tx.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-baseline gap-1">
                        <span className={`truncate font-medium text-foreground ${notes ? 'max-w-[45%] shrink-0' : 'min-w-0'}`} title={tx.description}>
                          {tx.description}
                        </span>
                        {notes && (
                          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={notes}>
                            · {notesPreview}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDate(tx.date, dateLocale)} · {tx.category?.name ?? t('transactions.noCategory')}
                        {(accountName || tx.parent_owner_name) && ` · ${accountName ?? tx.parent_owner_name}`}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`font-semibold tabular-nums ${tx.type === 'credit' ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {tx.type === 'credit' ? '+' : '−'}{mask(formatCurrency(Math.abs(amount), tx.currency, locale))}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t(tx.status === 'pending' ? 'transactions.statusPending' : 'transactions.statusPosted')}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t('transactions.noResults')}</p>
          )}
        </div>
        {signedTotal !== null && data?.summary && (
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-2 text-sm">
            <span className="text-muted-foreground">{t('transactions.summaryNet')}</span>
            <span className={`font-semibold tabular-nums ${signedTotal >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
              {mask(formatCurrency(signedTotal, data.summary.currency, locale))}
            </span>
          </div>
        )}
        <DialogFooter className="items-center justify-between gap-3 sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {data && `${data.total} ${t('transactions.title')}`}
          </p>
          <div className="flex items-center gap-2">
            {pages > 1 && (
              <>
                <Button type="button" size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>
                  {t('common.previous')}
                </Button>
                <span className="text-xs tabular-nums text-muted-foreground">{page}/{pages}</span>
                <Button type="button" size="sm" variant="outline" disabled={page === pages} onClick={() => setPage((value) => value + 1)}>
                  {t('common.next')}
                </Button>
              </>
            )}
            <Button size="sm" asChild>
              <Link to={reportTransactionsLink(selection, statuses, accountIds)} onClick={onClose}>
                {t('common.view')} {t('transactions.title')}
              </Link>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
