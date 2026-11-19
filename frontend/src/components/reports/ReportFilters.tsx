import { useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ListFilter } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { accounts } from '@/lib/api'
import { getAccountName, sortAccountsByDisplayName } from '@/lib/account-utils'
import { REPORT_STATUSES, type ReportStatus } from '@/lib/report-selection'

interface ReportFiltersProps {
  statuses?: ReportStatus[]
  accountIds: string[]
  collectionIds: string[] | null
  onApply: (statuses: ReportStatus[], accountIds: string[]) => void
}

export function ReportFilters({ statuses, accountIds, collectionIds, onApply }: ReportFiltersProps) {
  const { t } = useTranslation()
  const descriptionId = useId()
  const [open, setOpen] = useState(false)
  const [draftStatuses, setDraftStatuses] = useState(statuses ?? REPORT_STATUSES)
  const [draftAccounts, setDraftAccounts] = useState(accountIds)
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ['accounts', 'include-closed'],
    queryFn: () => accounts.list(true),
    enabled: open,
  })
  const options = sortAccountsByDisplayName(data.filter((account) =>
    collectionIds === null || collectionIds.includes(account.id),
  ))
  const label = (status: ReportStatus) => t(status === 'posted' ? 'transactions.statusPosted' : 'transactions.statusPending')
  const count = Number(statuses?.length === 1) + Number(accountIds.length > 0)
  const description = [
    statuses?.length === 1 ? label(statuses[0]) : '',
    accountIds.length === 1 ? t('transactions.calendarOneAccount')
      : accountIds.length > 1 ? t('transactions.calendarAccountCount', { count: accountIds.length }) : '',
  ].filter(Boolean).join(' · ')

  return (
    <Popover open={open} onOpenChange={(next) => {
      if (next) {
        setDraftStatuses(statuses ?? REPORT_STATUSES)
        setDraftAccounts(accountIds)
      }
      setOpen(next)
    }}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-full text-xs"
          aria-describedby={count ? descriptionId : undefined}>
          <ListFilter aria-hidden="true" />
          {t('transactions.filtersBar.filters')}
          {count > 0 && <span className="rounded-full bg-primary px-1.5 text-primary-foreground" aria-hidden="true">{count}</span>}
        </Button>
      </PopoverTrigger>
      {count > 0 && <span id={descriptionId} className="sr-only">{description}</span>}
      <PopoverContent align="end" className="w-72 max-w-[calc(100vw-1.5rem)] p-0" aria-label={t('transactions.filtersBar.filters')}>
        <div className="grid gap-3 p-3">
          {statuses && <fieldset className="grid gap-1">
            <legend className="mb-1 text-xs font-semibold">{t('reports.customFilters.status')}</legend>
            {REPORT_STATUSES.map((status) => (
              <label key={status} className="flex items-start gap-2 rounded px-2 py-1 text-sm hover:bg-muted">
                <input type="checkbox" className="mt-0.5 shrink-0 accent-primary"
                  checked={draftStatuses.includes(status)}
                  disabled={draftStatuses.length === 1 && draftStatuses[0] === status}
                  onChange={({ target }) => setDraftStatuses((previous) => target.checked
                    ? [...previous, status]
                    : previous.filter((item) => item !== status))}
                />
                {label(status)}
              </label>
            ))}
          </fieldset>}
          <fieldset className={statuses ? "min-w-0 border-t border-border pt-2" : "min-w-0"}>
            <legend className="float-left mb-1 w-full text-xs font-semibold">{t('reports.accounts')}</legend>
            <div className="clear-both max-h-44 overflow-auto">
              {options.map((account) => (
                <label key={account.id} className="flex items-start gap-2 rounded px-2 py-1 text-sm hover:bg-muted">
                  <input type="checkbox" className="mt-0.5 shrink-0 accent-primary"
                    checked={draftAccounts.includes(account.id)}
                    onChange={({ target }) => setDraftAccounts((previous) => target.checked
                      ? [...previous, account.id]
                      : previous.filter((id) => id !== account.id))}
                  />
                  <span className="min-w-0 break-words">{getAccountName(account)}{account.masked_number ? ` · ••${account.masked_number}` : ''}</span>
                </label>
              ))}
              {options.length === 0 && (
                <p className="text-xs text-muted-foreground">{t(isLoading ? 'common.loading' : isError ? 'common.error' : 'transactions.filtersBar.noOptions')}</p>
              )}
            </div>
          </fieldset>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-border bg-muted/30 p-2">
          <Button variant="ghost" size="sm" onClick={() => {
            setDraftStatuses(REPORT_STATUSES)
            setDraftAccounts([])
          }}>{t('collections.clearFilter')}</Button>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>{t('transactions.filtersBar.cancel')}</Button>
          <Button size="sm" onClick={() => {
            onApply(draftStatuses, draftAccounts)
            setOpen(false)
          }}>{t('transactions.filtersBar.apply')}</Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
