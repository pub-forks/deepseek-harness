import { useCallback, useEffect, useMemo, useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ScheduleTaskOption, ScheduleUsageDashboard, ScheduleUsageQuery, ScheduledRunUsage, ScheduledTaskUsage } from '../types.ts'
import { NS, type ScheduleUsageKey } from './locales.ts'
import css from './ScheduleUsagePanel.module.css'

type Totals = ScheduledRunUsage['totals']

/** Host callback injected by the panel registration. */
export interface ScheduleUsageInjected {
  readonly load: (query: ScheduleUsageQuery) => Promise<ScheduleUsageDashboard>
}

/** Main-panel props derived from the registered Slot and its injection face. */
export type ScheduleUsagePanelProps = PropsRuntime<'main'>
  & InjectFace<ScheduleUsageInjected>
  & PropsLocale<typeof NS>

function emptyTotals(): Totals {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0 }
}

function addTotals(left: Totals, right: Totals): Totals {
  return {
    inputTokens: left.inputTokens + right.inputTokens,
    outputTokens: left.outputTokens + right.outputTokens,
    cacheReadTokens: left.cacheReadTokens + right.cacheReadTokens,
    cacheWriteTokens: left.cacheWriteTokens + right.cacheWriteTokens,
    costUsd: left.costUsd === null || right.costUsd === null ? null : left.costUsd + right.costUsd,
  }
}

function taskTotals(task: ScheduledTaskUsage): Totals {
  return task.runs.reduce((total, run) => addTotals(total, run.totals), emptyTotals())
}

function allTotals(data: ScheduleUsageDashboard): Totals {
  const runs = [...data.tasks.flatMap(task => task.runs), ...data.sharedBatches]
  const totals = runs.reduce((total, run) => addTotals(total, run.totals), emptyTotals())
  return runs.length === 0 ? { ...totals, costUsd: null } : totals
}

/** Every provider-reported token, including cache reads and writes (the counts are disjoint). */
function tokenTotal(totals: Totals): number {
  return totals.inputTokens + totals.outputTokens + totals.cacheReadTokens + totals.cacheWriteTokens
}

const DEFAULT_RANGE_DAYS = 30

/** Local calendar date as `YYYY-MM-DD`, the value format of a date input. */
function dateInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function defaultRange(): { start: string; end: string } {
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - (DEFAULT_RANGE_DAYS - 1))
  return { start: dateInputValue(start), end: dateInputValue(end) }
}

/** Convert local start/end days to an inclusive ISO instant range, or undefined when incomplete or inverted. */
function rangeQuery(start: string, end: string): Pick<ScheduleUsageQuery, 'from' | 'to'> | undefined {
  const from = new Date(`${start}T00:00:00`)
  const to = new Date(`${end}T23:59:59.999`)
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from > to) return undefined
  return { from: from.toISOString(), to: to.toISOString() }
}

function formatTokens(value: number): string {
  return new Intl.NumberFormat().format(value)
}

function formatCost(value: number | null): string {
  return value === null ? '—' : new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 6 }).format(value)
}

function formatDate(value: string): string {
  const time = Date.parse(value)
  return Number.isFinite(time) ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(time) : '—'
}

function RefreshGlyph() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" className={css.refreshGlyph}><path d="M16.2 8A6.4 6.4 0 0 0 5.3 4.6L3.7 6.2M3.7 6.2V2.9M3.7 6.2H7m-3.2 5.8a6.4 6.4 0 0 0 10.9 3.4l1.6-1.6m0 0v3.3m0-3.3H13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

/** Render scheduled task totals, delivery details, and shared Scheduler batches.
 * @param props - Dashboard loader and localized Slot props.
 * @returns The scheduled-task usage page.
 */
export function ScheduleUsagePanel(props: ScheduleUsagePanelProps) {
  const { load, t } = props
  const [data, setData] = useState<ScheduleUsageDashboard>()
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [range, setRange] = useState(defaultRange)
  const [taskIds, setTaskIds] = useState<readonly string[]>([])
  const refresh = useCallback(() => { setRevision(value => value + 1) }, [])
  const bounds = useMemo(() => rangeQuery(range.start, range.end), [range])

  useEffect(() => {
    if (bounds === undefined) { setLoading(false); return }
    let active = true
    setLoading(true)
    setError(false)
    void load({ ...bounds, ...(taskIds.length === 0 ? {} : { taskIds: [...taskIds] }) }).then((next) => {
      if (active) setData(next)
    }, () => {
      if (active) setError(true)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [load, revision, bounds, taskIds])

  const totals = useMemo(() => data === undefined ? emptyTotals() : allTotals(data), [data])
  const deliveryCount = data === undefined ? 0 : data.tasks.reduce((count, task) => count + task.runs.length, 0) + data.sharedBatches.length
  const hasRows = deliveryCount > 0

  return (
    <div className={css.page}>
      <header className={css.header}>
        <div>
          <h1 className={css.title}>{t('title')}</h1>
          <p className={css.subtitle}>{t('subtitle')}</p>
        </div>
        <button className={css.refresh} type="button" title={t('refresh')} aria-label={t('refresh')} onClick={refresh} disabled={loading || bounds === undefined}>
          <RefreshGlyph />
        </button>
      </header>

      <section className={css.filters} aria-label={t('filters')}>
        <TaskFilter options={data?.taskOptions ?? []} selected={taskIds} onChange={setTaskIds} t={t} />
        <label className={css.dateField}>
          <span>{t('startDate')}</span>
          <input type="date" required value={range.start} max={range.end || undefined}
            onChange={(event) => { const start = event.currentTarget.value; setRange(value => ({ ...value, start })) }} />
        </label>
        <label className={css.dateField}>
          <span>{t('endDate')}</span>
          <input type="date" required value={range.end} min={range.start || undefined}
            onChange={(event) => { const end = event.currentTarget.value; setRange(value => ({ ...value, end })) }} />
        </label>
      </section>
      {bounds === undefined && <p className={css.error} role="alert">{t('invalidRange')}</p>}

      {data !== undefined && <section className={css.metrics} aria-label={t('title')}>
        <Metric label={t('totalTasks')} value={formatTokens(data.totalTaskCount)} />
        <Metric label={t('totalRuns')} value={formatTokens(deliveryCount)} />
        <Metric label={t('totalTokens')} value={formatTokens(tokenTotal(totals))} />
        <Metric label={t('totalCost')} value={formatCost(totals.costUsd)} />
      </section>}

      {data !== undefined && !data.pricingAvailable && <p className={css.notice} role="status">{t('pricingUnavailable')}</p>}
      {data?.pricingUpdatedAt !== null && data?.pricingUpdatedAt !== undefined && <p className={css.freshness}>{t('pricingAt')}: {formatDate(new Date(data.pricingUpdatedAt).toISOString())}</p>}
      {data?.truncated === true && <p className={css.notice} role="status">{t('truncated')}</p>}
      {loading && data === undefined && <p className={css.empty}>{t('loading')}</p>}
      {error && <p className={css.error} role="alert">{t('loadError')}</p>}
      {!loading && !error && bounds !== undefined && data !== undefined && !hasRows && <p className={css.empty}>{t('empty')}</p>}

      {data !== undefined && <>
        <section className={css.taskList} aria-label={t('totalTasks')}>
          {data.tasks.map(task => <TaskRow key={task.id} task={task} t={t} />)}
        </section>
        {data.sharedBatches.length > 0 && <section className={css.sharedSection}>
          <h2 className={css.sectionTitle}>{t('sharedBatches')}</h2>
          <p className={css.notice}>{t('sharedNote')}</p>
          <div className={css.taskList}>
            {data.sharedBatches.map(run => <RunRow key={`${run.targetSessionId}/${run.messageId}`} run={run} t={t} shared />)}
          </div>
        </section>}
      </>}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className={css.metric}>
      <span className={css.metricLabel}>{label}</span>
      <strong className={css.metricValue}>{value}</strong>
    </article>
  )
}

function statusText(task: ScheduledTaskUsage, t: (key: ScheduleUsageKey) => string): string {
  return t(task.status)
}

function TaskRow({ task, t }: { task: ScheduledTaskUsage; t: (key: ScheduleUsageKey) => string }) {
  const totals = task.runs.length === 0 ? { ...emptyTotals(), costUsd: null } : taskTotals(task)
  return (
    <details className={css.task}>
      <summary className={css.taskSummary}>
        <span className={css.taskName}>{task.title}</span>
        <span className={css.taskStat}>{statusText(task, t)}</span>
        <span className={css.taskStat}>{formatTokens(task.runs.length)} {t('runs')}</span>
        <strong className={css.taskCost}>{formatCost(totals.costUsd)}</strong>
      </summary>
      <div className={css.runList}>
        {task.runs.length === 0 && task.sharedRunCount === 0 && <p className={css.empty}>{t('noDeliveries')}</p>}
        {task.runs.map(run => <RunRow key={`${run.targetSessionId}/${run.messageId}`} run={run} t={t} />)}
        {task.sharedRunCount > 0 && <p className={css.notice}>{t('runsWithoutUsage')} · {formatTokens(task.sharedRunCount)} {t('runs')}</p>}
        {task.earlierRunsAvailable && <p className={css.freshness}>{t('moreHistory')}</p>}
        {task.earlierRunsPruned && <p className={css.freshness}>{t('historyPruned')}</p>}
      </div>
    </details>
  )
}

function RunRow({ run, t, shared = false }: { run: ScheduledRunUsage; t: (key: ScheduleUsageKey) => string; shared?: boolean }) {
  return (
    <details className={css.run}>
      <summary className={css.runSummary}>
        <span className={css.runName}>{t('run')} · {formatDate(run.deliveredAt)}</span>
        <span className={css.status}>{shared ? t('sharedRun') : t('delivered')}</span>
        <span className={css.runStat}>{formatTokens(tokenTotal(run.totals))} {t('totalTokens').toLowerCase()}</span>
        <strong className={css.runCost}>{formatCost(run.totals.costUsd)}</strong>
      </summary>
      <div className={css.detail}>
        {shared && <p className={css.freshness}>{t('sharedWith')}: {run.tasks.map(task => task.title).join(', ')}</p>}
        <div className={css.detailStats}>
          <Metric label={t('inputTokens')} value={formatTokens(run.totals.inputTokens)} />
          <Metric label={t('outputTokens')} value={formatTokens(run.totals.outputTokens)} />
          <Metric label={t('cacheRead')} value={formatTokens(run.totals.cacheReadTokens)} />
          <Metric label={t('cacheWrite')} value={formatTokens(run.totals.cacheWriteTokens)} />
        </div>
        {!run.usageAvailable && <p className={css.notice}>{t('usageUnavailable')}</p>}
        {run.usageAvailable && run.usage.length === 0 && <p className={css.empty}>{t('noUsage')}</p>}
        {run.usage.length > 0 && <div className={css.modelList}>
          {run.usage.map(model => <div className={css.model} key={`${model.provider}/${model.model}`}>
            <div className={css.modelTitle}><strong>{model.model}</strong><span>{model.provider}</span></div>
            <div className={css.modelStats}>
              <span>{t('inputTokens')}: {formatTokens(model.inputTokens)}</span>
              <span>{t('outputTokens')}: {formatTokens(model.outputTokens)}</span>
              <span>{t('cacheRead')}: {formatTokens(model.cacheReadTokens)}</span>
              <span>{t('cacheWrite')}: {formatTokens(model.cacheWriteTokens)}</span>
              <strong>{model.costUsd === null ? t('unpriced') : formatCost(model.costUsd)}</strong>
            </div>
          </div>)}
        </div>}
      </div>
    </details>
  )
}

function TaskFilter({ options, selected, onChange, t }: {
  options: readonly ScheduleTaskOption[]
  selected: readonly string[]
  onChange: (next: readonly string[]) => void
  t: (key: ScheduleUsageKey) => string
}) {
  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id])
  }
  const label = selected.length === 0 ? t('allTasks') : `${formatTokens(selected.length)} ${t('selected')}`
  return (
    <details className={css.taskFilter}>
      <summary className={css.taskFilterSummary}>
        <span className={css.taskFilterLabel}>{t('tasksFilter')}</span>
        <span>{label}</span>
      </summary>
      <div className={css.taskFilterMenu}>
        {options.length === 0 && <p className={css.empty}>{t('noTasks')}</p>}
        {options.map(option => <label key={option.id} className={css.taskOption}>
          <input type="checkbox" checked={selected.includes(option.id)} onChange={() => { toggle(option.id) }} />
          <span className={css.taskOptionTitle}>{option.title}</span>
          <span className={css.taskOptionStatus}>{t(option.status)}</span>
        </label>)}
        {selected.length > 0 && <button type="button" className={css.clearSelection} onClick={() => { onChange([]) }}>
          {t('clearSelection')}
        </button>}
      </div>
    </details>
  )
}
