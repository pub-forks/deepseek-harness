import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-session-query'
import type {} from '@deepseek-ai/dsh-schedule'
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { ScheduleCatalogEntry, ScheduleDeliveryRecord } from '@deepseek-ai/dsh-schedule'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type {
  ScheduledModelUsage, ScheduledRunUsage, ScheduledTaskUsage, ScheduleTaskOption, ScheduleUsageDashboard, ScheduleUsageQuery,
} from './types.ts'

interface Rate {
  prompt: number
  completion: number
  cacheRead?: number
  cacheWrite?: number
}

interface PriceCatalog {
  /** Rates by lower-case OpenRouter model id. */
  rates: ReadonlyMap<string, Rate>
  /** Rates by lower-case id segment after the vendor prefix; `null` marks an ambiguous name with differing prices. */
  bySuffix: ReadonlyMap<string, Rate | null>
  updatedAt: number
}

/** Provider-reported token counts for one model in one delivery turn, before pricing. */
interface ModelTokens {
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

const PRICE_URL = 'https://openrouter.ai/api/v1/models'
const PRICE_TTL_MS = 6 * 60 * 60 * 1000
const MAX_PRICE_BYTES = 12 * 1024 * 1024
const TASK_LIMIT = 50
const TASK_OPTION_LIMIT = 500
const MAX_FILTER_TASKS = 50
const HISTORY_PAGE_SIZE = 100
const HISTORY_PAGE_LIMIT = 10
const DELIVERY_LIMIT = 250
const SESSION_READ_CONCURRENCY = 8
const USAGE_CACHE_LIMIT = 2000

type DeliveryReceipt = Pick<ScheduleDeliveryRecord, 'messageId' | 'targetSessionId' | 'scheduledAt' | 'deliveredAt'>
type TaskDisplay = Pick<ScheduleCatalogEntry, 'id' | 'title' | 'status'>

interface TaskHistory {
  task: TaskDisplay
  records: DeliveryReceipt[]
  earlierRunsAvailable: boolean
  earlierRunsPruned: boolean
  truncated: boolean
}

interface Delivery {
  key: string
  messageId: string
  targetSessionId: SessionId
  scheduledAt: string
  deliveredAt: string
  tasks: Array<{ id: string; title: string }>
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function priceNumber(value: unknown): number | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined
  if (typeof value === 'string' && value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

function sameRate(left: Rate, right: Rate): boolean {
  return left.prompt === right.prompt && left.completion === right.completion
    && left.cacheRead === right.cacheRead && left.cacheWrite === right.cacheWrite
}

/** Index rates by full id and by the model segment after the vendor prefix. */
function indexRates(rates: ReadonlyMap<string, Rate>): Map<string, Rate | null> {
  const bySuffix = new Map<string, Rate | null>()
  for (const [id, rate] of rates) {
    const slash = id.indexOf('/')
    if (slash < 0) continue
    const suffix = id.slice(slash + 1)
    const existing = bySuffix.get(suffix)
    if (existing === undefined) bySuffix.set(suffix, rate)
    else if (existing !== null && !sameRate(existing, rate)) bySuffix.set(suffix, null)
  }
  return bySuffix
}

/** Read and validate OpenRouter's bounded, public pricing catalog. */
async function readPriceCatalog(previous: PriceCatalog | undefined, now: number, signal: AbortSignal): Promise<PriceCatalog> {
  if (previous !== undefined && now - previous.updatedAt < PRICE_TTL_MS) return previous
  const response = await fetch(PRICE_URL, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
  })
  if (!response.ok) throw new Error(`OpenRouter pricing returned HTTP ${response.status}`)
  const length = Number(response.headers.get('content-length'))
  if (Number.isFinite(length) && length > MAX_PRICE_BYTES) throw new Error('OpenRouter pricing response is too large')
  const reader = response.body?.getReader()
  if (reader === undefined) throw new Error('OpenRouter pricing response has no body')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_PRICE_BYTES) throw new Error('OpenRouter pricing response is too large')
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  const body: unknown = JSON.parse(new TextDecoder().decode(bytes))
  if (!isObject(body) || !Array.isArray(body.data)) throw new Error('OpenRouter pricing response is invalid')
  const rates = new Map<string, Rate>()
  for (const item of body.data) {
    if (!isObject(item) || typeof item.id !== 'string' || !isObject(item.pricing)) continue
    const prompt = priceNumber(item.pricing.prompt)
    const completion = priceNumber(item.pricing.completion)
    if (prompt === undefined || completion === undefined) continue
    const cacheRead = priceNumber(item.pricing.input_cache_read)
    const cacheWrite = priceNumber(item.pricing.input_cache_write)
    rates.set(item.id.toLowerCase(), {
      prompt, completion,
      ...(cacheRead === undefined ? {} : { cacheRead }),
      ...(cacheWrite === undefined ? {} : { cacheWrite }),
    })
  }
  if (rates.size === 0) throw new Error('OpenRouter pricing response contained no usable models')
  return { rates, bySuffix: indexRates(rates), updatedAt: now }
}

/**
 * Resolve an OpenRouter rate: exact model id, then `provider/model`, then, for a bare model name, the unique
 * vendor-prefixed id whose model segment matches (ambiguous names with differing prices stay unpriced).
 */
function rateFor(catalog: PriceCatalog | undefined, provider: string, model: string): Rate | undefined {
  if (catalog === undefined) return undefined
  const id = model.toLowerCase()
  const exact = catalog.rates.get(id) ?? catalog.rates.get(`${provider.toLowerCase()}/${id}`)
  // A vendor-prefixed model id names its vendor; only a bare model name may match another vendor's id.
  if (exact !== undefined || id.includes('/')) return exact
  return catalog.bySuffix.get(id) ?? undefined
}

/** Sum provider-reported assistant usage for one model turn. Token counts are disjoint (uncached input, output, cache). */
function summarizeTurn(events: readonly SessionEvent[], turn: number): ModelTokens[] {
  const byModel = new Map<string, ModelTokens>()
  for (const event of events) {
    if (event.type !== 'assistant/message' || event.data.turn !== turn || event.data.usage === undefined) continue
    const source = event.data.message.source
    if (!('provider' in source) || !('model' in source)) continue
    const provider = source.provider
    const model = source.model
    if (typeof provider !== 'string' || typeof model !== 'string') continue
    const usage = event.data.usage
    const key = `${provider}/${model}`
    const row = byModel.get(key) ?? { provider, model, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }
    row.inputTokens += usage.inputTokens
    row.outputTokens += usage.outputTokens
    row.cacheReadTokens += usage.cacheReadTokens ?? 0
    row.cacheWriteTokens += usage.cacheWriteTokens ?? 0
    byModel.set(key, row)
  }
  return [...byModel.values()]
}

/** Estimate one model's cost; cache tokens fall back to the prompt rate when OpenRouter lists no cache price. */
function priceTokens(tokens: ModelTokens, catalog: PriceCatalog | undefined): ScheduledModelUsage {
  const rate = rateFor(catalog, tokens.provider, tokens.model)
  const costUsd = rate === undefined
    ? null
    : tokens.inputTokens * rate.prompt + tokens.outputTokens * rate.completion
      + tokens.cacheReadTokens * (rate.cacheRead ?? rate.prompt)
      + tokens.cacheWriteTokens * (rate.cacheWrite ?? rate.prompt)
  return { ...tokens, costUsd }
}

function totalsFor(usage: readonly ScheduledModelUsage[]): ScheduledRunUsage['totals'] {
  const start: ScheduledRunUsage['totals'] = {
    inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: usage.length === 0 ? null : 0,
  }
  return usage.reduce((totals, item) => ({
    inputTokens: totals.inputTokens + item.inputTokens,
    outputTokens: totals.outputTokens + item.outputTokens,
    cacheReadTokens: totals.cacheReadTokens + item.cacheReadTokens,
    cacheWriteTokens: totals.cacheWriteTokens + item.cacheWriteTokens,
    costUsd: totals.costUsd === null || item.costUsd === null ? null : totals.costUsd + item.costUsd,
  }), start)
}

function deliveryKey(record: DeliveryReceipt): string {
  return `${record.targetSessionId}\u0000${record.messageId}`
}

function mergeDeliveries(taskRecords: readonly TaskHistory[]): Delivery[] {
  const grouped = new Map<string, Omit<Delivery, 'tasks'> & { tasks: Map<string, { id: string; title: string }> }>()
  for (const { task, records } of taskRecords) {
    for (const record of records) {
      const key = deliveryKey(record)
      let delivery = grouped.get(key)
      if (delivery === undefined) {
        delivery = {
          key, messageId: record.messageId, targetSessionId: record.targetSessionId,
          scheduledAt: record.scheduledAt, deliveredAt: record.deliveredAt, tasks: new Map(),
        }
        grouped.set(key, delivery)
      }
      delivery.tasks.set(String(task.id), { id: String(task.id), title: task.title })
    }
  }
  return [...grouped.values()].map(delivery => ({
    ...delivery, tasks: [...delivery.tasks.values()].sort((a, b) => a.title.localeCompare(b.title)),
  }))
}

/** Find the turn holding a delivered message and whether that turn has ended (its usage is then final). */
function findTurnForMessage(events: readonly SessionEvent[], messageId: string): { turn: number; ended: boolean } | undefined {
  let currentTurn: number | undefined
  let found: number | undefined
  for (const event of events) {
    if (found === undefined) {
      if (event.type === 'turn/start') currentTurn = event.data.turn
      else if (event.type === 'user/message' && String(event.data.id) === messageId) {
        if (currentTurn === undefined) return undefined
        found = currentTurn
      }
    } else if (event.type === 'turn/end' && event.data.turn === found) {
      return { turn: found, ended: true }
    }
  }
  return found === undefined ? undefined : { turn: found, ended: false }
}

function invalidQuery(reason: string): RemoteError<'gaia-schedule-usage/invalid-query'> {
  return new RemoteError('gaia-schedule-usage/invalid-query', `Invalid automation usage filter: ${reason}`, { reason })
}

/** Validate the dashboard filter and convert its bounds to epoch milliseconds. */
function parseQuery(query: ScheduleUsageQuery): { taskIds: ReadonlySet<string> | undefined; from: number; to: number } {
  const from = Date.parse(query.from)
  const to = Date.parse(query.to)
  if (!Number.isFinite(from) || !Number.isFinite(to)) throw invalidQuery('start and end must be valid dates')
  if (from > to) throw invalidQuery('start must not be after end')
  const ids = query.taskIds ?? []
  if (ids.length > MAX_FILTER_TASKS) throw invalidQuery(`at most ${MAX_FILTER_TASKS} tasks can be selected`)
  return { taskIds: ids.length === 0 ? undefined : new Set(ids), from, to }
}

/** Read Schedule delivery pages and their target turns without exposing saved prompts. */
class GaiaScheduleUsage extends TypertRemoteService {
  static inject = ['schedule', 'sessionQuery']
  private priceCatalog?: PriceCatalog
  /** Final token counts of ended delivery turns, keyed by Session and message; least recently used first. */
  private readonly usageCache = new Map<string, ModelTokens[]>()

  /** @param ctx - Host context providing Scheduler history and Session log reads. */
  constructor(ctx: Context) {
    super(ctx, 'gaiaScheduleUsage')
  }

  private cachedUsage(key: string): ModelTokens[] | undefined {
    const value = this.usageCache.get(key)
    if (value !== undefined) { this.usageCache.delete(key); this.usageCache.set(key, value) }
    return value
  }

  private cacheUsage(key: string, value: ModelTokens[]): void {
    this.usageCache.delete(key)
    this.usageCache.set(key, value)
    while (this.usageCache.size > USAGE_CACHE_LIMIT) {
      const oldest = this.usageCache.keys().next().value
      if (oldest === undefined) break
      this.usageCache.delete(oldest)
    }
  }

  /** Page one task's retained deliveries newest first, keeping those delivered within the range. */
  private async taskHistory(task: TaskDisplay, from: number, to: number): Promise<TaskHistory> {
    const records: DeliveryReceipt[] = []
    let before: ScheduleDeliveryRecord['messageId'] | undefined
    let pruned = false
    let unavailable = false
    for (let page = 0; ; page++) {
      const request = { id: task.id, limit: HISTORY_PAGE_SIZE, ...(before === undefined ? {} : { before }) }
      const history = await this.ctx.schedule.history(request)
      if ('code' in history) return { task, records, earlierRunsAvailable: false, earlierRunsPruned: pruned, truncated: false }
      pruned = history.earlierRecordsPruned
      unavailable = history.earlierRecordsUnavailable
      let reachedStart = false
      for (const record of history.records) {
        const delivered = Date.parse(record.deliveredAt)
        if (delivered < from) { reachedStart = true; continue }
        if (delivered > to) continue
        records.push({
          messageId: record.messageId, targetSessionId: record.targetSessionId,
          scheduledAt: record.scheduledAt, deliveredAt: record.deliveredAt,
        })
      }
      if (reachedStart || history.nextBefore === undefined) {
        // Range fully covered, or retention ended inside it.
        return { task, records, earlierRunsAvailable: !reachedStart && unavailable, earlierRunsPruned: pruned, truncated: false }
      }
      if (page + 1 >= HISTORY_PAGE_LIMIT) {
        return { task, records, earlierRunsAvailable: true, earlierRunsPruned: pruned, truncated: true }
      }
      before = history.nextBefore
    }
  }

  /** Build the read-only dashboard from retained Scheduler receipts and their Session usage.
   * @param query - Selected task ids (empty for all) and the inclusive delivery-time range.
   * @param signal - Remote cancellation signal.
   * @returns Task and shared-batch summaries, task options, model rates, and history bounds.
   */
  @Remote
  async dashboard(query: ScheduleUsageQuery, signal: AbortSignal): Promise<ScheduleUsageDashboard> {
    const filter = parseQuery(query)
    const [catalog, prices] = await Promise.all([
      this.ctx.schedule.catalog(),
      readPriceCatalog(this.priceCatalog, Date.now(), signal).catch((error: unknown) => {
        console.error('OpenRouter pricing unavailable:', error)
        return undefined
      }),
    ])
    signal.throwIfAborted()
    if (prices !== undefined) this.priceCatalog = prices
    const taskOptions: ScheduleTaskOption[] = catalog.slice(0, TASK_OPTION_LIMIT)
      .map(task => ({ id: String(task.id), title: task.title, status: task.status }))
    // All tasks' receipts are read (Scheduler only, no Session reads) so shared batches are recognized under a task filter.
    const scanned = catalog.slice(0, TASK_LIMIT)
    let truncated = catalog.length > scanned.length
    const histories = await Promise.all(scanned.map(task => this.taskHistory(
      { id: task.id, title: task.title, status: task.status }, filter.from, filter.to,
    )))
    signal.throwIfAborted()
    truncated ||= histories.some(history => history.truncated)
    const selected = (id: string) => filter.taskIds === undefined || filter.taskIds.has(id)
    const shown = histories.filter(history => selected(String(history.task.id)))
    const all = mergeDeliveries(histories)
      .filter(delivery => delivery.tasks.some(task => selected(task.id)))
      .sort((a, b) => b.deliveredAt.localeCompare(a.deliveredAt))
    if (all.length > DELIVERY_LIMIT) truncated = true
    const deliveries = all.slice(0, DELIVERY_LIMIT)

    const tokensByDelivery = new Map<string, ModelTokens[] | undefined>()
    const pending = new Map<SessionId, Delivery[]>()
    for (const delivery of deliveries) {
      const cached = this.cachedUsage(delivery.key)
      if (cached !== undefined) { tokensByDelivery.set(delivery.key, cached); continue }
      const list = pending.get(delivery.targetSessionId) ?? []
      list.push(delivery)
      pending.set(delivery.targetSessionId, list)
    }
    const sessionRows = [...pending.entries()]
    for (let index = 0; index < sessionRows.length; index += SESSION_READ_CONCURRENCY) {
      signal.throwIfAborted()
      await Promise.all(sessionRows.slice(index, index + SESSION_READ_CONCURRENCY).map(async ([sessionId, list]) => {
        let events: readonly SessionEvent[]
        try {
          events = (await this.ctx.sessionQuery.readSession(sessionId)).events
        } catch (_error: unknown) {
          // Keep the Scheduler receipt visible when its target Session log cannot be read.
          for (const delivery of list) tokensByDelivery.set(delivery.key, undefined)
          return
        }
        for (const delivery of list) {
          const found = findTurnForMessage(events, delivery.messageId)
          if (found === undefined) { tokensByDelivery.set(delivery.key, undefined); continue }
          const tokens = summarizeTurn(events, found.turn)
          if (found.ended) this.cacheUsage(delivery.key, tokens)
          tokensByDelivery.set(delivery.key, tokens)
        }
      }))
    }

    const runs = new Map<string, ScheduledRunUsage>()
    for (const delivery of deliveries) {
      const tokens = tokensByDelivery.get(delivery.key)
      const usage = (tokens ?? []).map(row => priceTokens(row, prices))
      const totals = totalsFor(usage)
      if (tokens === undefined) totals.costUsd = null
      runs.set(delivery.key, {
        messageId: delivery.messageId, targetSessionId: delivery.targetSessionId,
        scheduledAt: delivery.scheduledAt, deliveredAt: delivery.deliveredAt,
        tasks: delivery.tasks, usageAvailable: tokens !== undefined, usage, totals,
      })
    }
    const tasks: ScheduledTaskUsage[] = shown.map(({ task, records, earlierRunsAvailable, earlierRunsPruned }) => {
      const taskRuns = records.map(record => runs.get(deliveryKey(record))).filter((run): run is ScheduledRunUsage => run !== undefined)
      const privateRuns = taskRuns.filter(run => run.tasks.length < 2)
      return {
        id: String(task.id), title: task.title, status: task.status,
        runs: privateRuns, sharedRunCount: taskRuns.length - privateRuns.length,
        earlierRunsAvailable, earlierRunsPruned,
      }
    })
    const sharedBatches = deliveries
      .filter(delivery => delivery.tasks.length > 1)
      .map(delivery => runs.get(delivery.key))
      .filter((run): run is ScheduledRunUsage => run !== undefined)
    return {
      totalTaskCount: catalog.length,
      taskOptions,
      tasks,
      sharedBatches,
      pricingUpdatedAt: prices?.updatedAt ?? null,
      pricingAvailable: prices !== undefined,
      truncated,
    }
  }
}

export default GaiaScheduleUsage
