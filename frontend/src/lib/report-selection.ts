import { addDaysIso, addMonthsIso, type PeriodWindow } from '@/lib/report-period'

export type ReportStatus = 'posted' | 'pending'
export type ReportGroup = 'income' | 'expenses' | 'investments'

export type ReportLedgerGroup = ReportGroup | 'activity'

export const REPORT_STATUSES: ReportStatus[] = ['posted', 'pending']

export interface ReportSelection {
  source: PeriodWindow
  range: PeriodWindow
  group: ReportLedgerGroup
  category?: string
  label: string
  projected: number
  statuses: ReportStatus[]
  accountIds?: string[]
}

export function reportGroup(group: string): ReportGroup | undefined {
  if (group === 'income' || group === 'expenses' || group === 'investments') return group
}

function isIsoDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value + 'T00:00:00Z')
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value
}

export function reportPointRange(label: string, interval: string, source: PeriodWindow): PeriodWindow | null {
  let from: string
  let to: string
  if (interval === 'daily' && isIsoDay(label)) {
    from = to = label
  } else if (interval === 'monthly' && /^\d{4}-(0[1-9]|1[0-2])$/.test(label)) {
    from = label + '-01'
    to = addDaysIso(addMonthsIso(from, 1), -1)
  } else if (interval === 'yearly' && /^\d{4}$/.test(label)) {
    from = label + '-01-01'
    to = label + '-12-31'
  } else if (interval === 'weekly' && /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(label)) {
    const [year, week] = label.split('-W')
    const january4 = new Date(`${year}-01-04T00:00:00Z`)
    from = addDaysIso(`${year}-01-04`, (Number(week) - 1) * 7 - (january4.getUTCDay() + 6) % 7)
    // A week belongs to the year that contains its Thursday.
    if (!addDaysIso(from, 3).startsWith(year)) return null
    to = addDaysIso(from, 6)
  } else {
    return null
  }
  const range = { from: from < source.from ? source.from : from, to: to > source.to ? source.to : to }
  return range.from <= range.to ? range : null
}

export function reportTransactionsUrl(selection: ReportSelection): string {
  const params = new URLSearchParams({
    report_group: selection.group, report_from: selection.source.from, report_to: selection.source.to,
    from: selection.range.from, to: selection.range.to,
    hide_ignored: 'true',
  })
  if (selection.group !== 'activity') params.set('type', selection.group === 'income' ? 'credit' : 'debit')
  if (selection.statuses.length === 1) params.set('status', selection.statuses[0])
  if (selection.accountIds?.length) params.set('account_id', selection.accountIds.join(','))
  if (selection.category === 'uncategorized') params.set('uncategorized', '1')
  else if (selection.category) params.set('category_id', selection.category)
  return `/transactions?${params}`
}

export function reportChartAction(label: string, activate: () => void) {
  return {
    role: 'button',
    tabIndex: 0,
    'aria-label': label,
    className: 'cursor-pointer hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary',
    onClick: activate,
    onKeyDown: (event: import('react').KeyboardEvent<SVGElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        activate()
      }
    },
  }
}

export function readReportContext(params: URLSearchParams): {
  report_group: ReportLedgerGroup
  report_from: string
  report_to: string
} | null {
  const value = params.get('report_group') ?? ''
  const group = value === 'activity' ? value : reportGroup(value)
  const from = params.get('report_from') ?? ''
  const to = params.get('report_to') ?? ''
  if (!group || !isIsoDay(from) || !isIsoDay(to) || from > to) return null
  return { report_group: group, report_from: from, report_to: to }
}
