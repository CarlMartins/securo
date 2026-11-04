import {
  addDaysIso,
  periodWindow,
  rollingStart,
  type PeriodPreset,
  type PeriodWindow,
} from './report-period'

export type ReportTransactionType = 'credit' | 'debit'
export type ReportTransactionStatus = 'posted' | 'pending'

export interface ReportTransactionSelection extends PeriodWindow {
  label: string
  type: ReportTransactionType
  categoryId?: string
  uncategorized?: boolean
}

/** The exact calendar window represented by the active Income vs Expenses preset. */
export function visibleReportWindow(
  preset: PeriodPreset,
  today: string,
  explicitWindow: PeriodWindow | null,
): PeriodWindow | null {
  if (explicitWindow) return explicitWindow
  if (preset.kind === 'custom') return null
  if (preset.kind === 'month') return periodWindow(preset, today, 0)
  if (preset.kind === 'days') {
    return { from: addDaysIso(today, 1 - preset.days), to: today }
  }
  if (preset.kind === 'rolling') {
    return { from: rollingStart(today, preset.months), to: today }
  }
  const fiscalStart = preset.fyStartMonth ?? 1
  const year = Number(today.slice(0, 4)) - (Number(today.slice(5, 7)) < fiscalStart ? 1 : 0)
  return { from: `${year}-${String(fiscalStart).padStart(2, '0')}-01`, to: today }
}

/** Keep transaction drilldowns inside the dates included in a historical report. */
export function historicalReportWindow(
  window: PeriodWindow | null, today: string,
): PeriodWindow | null {
  if (!window || window.from > today) return null
  return { ...window, to: window.to > today ? today : window.to }
}

/** Convert the chart's daily/ISO-week/month/year label into dates inside the report. */
export function reportBarWindow(
  label: string,
  interval: string,
  reportWindow: PeriodWindow,
): PeriodWindow | null {
  let from: string
  let to: string
  if (interval === 'daily' && /^\d{4}-\d{2}-\d{2}$/.test(label)) {
    from = to = label
  } else if (interval === 'weekly' && /^\d{4}-W\d{2}$/.test(label)) {
    const year = Number(label.slice(0, 4))
    const week = Number(label.slice(6))
    if (week < 1 || week > 53) return null
    const januaryFourth = new Date(Date.UTC(year, 0, 4))
    const monday = new Date(januaryFourth)
    monday.setUTCDate(januaryFourth.getUTCDate() - ((januaryFourth.getUTCDay() + 6) % 7) + (week - 1) * 7)
    from = monday.toISOString().slice(0, 10)
    to = addDaysIso(from, 6)
  } else if (interval === 'monthly' && /^\d{4}-(0[1-9]|1[0-2])$/.test(label)) {
    from = `${label}-01`
    const [year, month] = label.split('-').map(Number)
    const lastDay = new Date(year, month, 0).getDate()
    to = `${label}-${String(lastDay).padStart(2, '0')}`
  } else if (interval === 'yearly' && /^\d{4}$/.test(label)) {
    from = `${label}-01-01`
    to = `${label}-12-31`
  } else {
    return null
  }
  const clipped = {
    from: from > reportWindow.from ? from : reportWindow.from,
    to: to < reportWindow.to ? to : reportWindow.to,
  }
  return clipped.from <= clipped.to ? clipped : null
}

export function reportTransactionFilters(
  selection: ReportTransactionSelection,
  statuses: readonly ReportTransactionStatus[],
  accountIds: readonly string[] | null,
  page = 1,
) {
  return {
    page,
    limit: 20,
    from: selection.from,
    to: selection.to,
    type: selection.type,
    ...(selection.categoryId ? { category_ids: [selection.categoryId] } : {}),
    ...(selection.uncategorized ? { uncategorized: true } : {}),
    ...(accountIds?.length ? { account_ids: [...accountIds] } : {}),
    ...(statuses.length === 1 ? { status: statuses[0] } : {}),
    sort_by: 'date',
    sort_dir: 'desc' as const,
  }
}

/** The Transactions page uses singular URL keys, then sends list filters to its API. */
export function reportTransactionsLink(
  selection: ReportTransactionSelection,
  statuses: readonly ReportTransactionStatus[],
  accountIds: readonly string[] | null,
): string {
  const params = new URLSearchParams({
    from: selection.from,
    to: selection.to,
    type: selection.type,
  })
  if (selection.categoryId) params.set('category_id', selection.categoryId)
  if (selection.uncategorized) params.set('uncategorized', '1')
  if (accountIds?.length) params.set('account_id', accountIds.join(','))
  if (statuses.length === 1) params.set('status', statuses[0])
  return `/transactions?${params}`
}
