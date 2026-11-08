import { afterEach, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { createAssistantMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import { SessionId, SessionSeq } from '@deepseek-ai/dsh-session'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { ScheduleId } from '@deepseek-ai/dsh-schedule'
import type { ScheduleCatalogEntry, ScheduleDeliveryRecord, ScheduleDeliveryHistoryResult } from '@deepseek-ai/dsh-schedule'
import type { SessionId as SessionIdType } from '@deepseek-ai/dsh-session'
import type { ScheduleUsageDashboard, ScheduleUsageQuery } from '../src/types.ts'
import GaiaScheduleUsage from '../src/index.ts'

const target = SessionId('usage-session')
const scheduledAt = '2026-11-07T08:00:00.000Z'
const deliveredAt = '2026-11-07T08:01:00.000Z'
const allTime: ScheduleUsageQuery = { from: '2026-01-01T00:00:00.000Z', to: '2026-12-31T23:59:59.999Z' }

function task(id: string, title: string): ScheduleCatalogEntry {
  return {
    id: ScheduleId(id), kind: 'after', title, prompt: 'PRIVATE PROMPT', afterSeconds: 60,
    scheduledAt, target: { kind: 'session', sessionId: target }, involvedSessionIds: [target], status: 'active',
  }
}

function assistant(turn: number, seq: number, inputTokens: number, outputTokens: number, model = 'vendor/model') {
  return {
    type: 'assistant/message', seq: SessionSeq(seq), time: 12, surfaceOp: 'append',
    data: {
      turn, step: 1,
      message: createAssistantMessage({ content: [], source: { provider: 'router', model } }),
      stream: [],
      usage: { inputTokens, outputTokens, cacheReadTokens: 10, cacheWriteTokens: 5 },
    },
  } satisfies SessionEvent
}

function history(id: ScheduleCatalogEntry['id'], records: readonly ScheduleDeliveryRecord[]): ScheduleDeliveryHistoryResult {
  return {
    id, records: [...records], earlierRecordsUnavailable: false, earlierRecordsPruned: false,
    retention: { days: 365, records: 100 },
  }
}

function receipt(messageId: ReturnType<typeof createUserMessage>['id'], at = deliveredAt): ScheduleDeliveryRecord {
  return { messageId, targetSessionId: target, scheduledAt, deliveredAt: at, prompt: 'PRIVATE PROMPT' }
}

function catalogResponse(data: unknown[]) {
  return vi.fn(async () => new Response(JSON.stringify({ data }), { status: 200, headers: { 'content-type': 'application/json' } }))
}

const sessions = new Set<Context>()
afterEach(async () => {
  for (const context of sessions) await context.fiber.dispose()
  sessions.clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function dashboard(options: {
  tasks: ScheduleCatalogEntry[]
  records: Map<string, ScheduleDeliveryRecord[]>
  events?: readonly SessionEvent[]
  rejectSession?: boolean
  readSession?: () => void
}) {
  const context = new Context()
  sessions.add(context)
  context.provide('schedule', {
    catalog: async () => options.tasks,
    history: async ({ id }: { id: ScheduleCatalogEntry['id'] }) => history(id, options.records.get(id) ?? []),
  } as never)
  context.provide('sessionQuery', {
    readSession: async (_id: SessionIdType) => {
      options.readSession?.()
      if (options.rejectSession) throw new Error('session unavailable')
      return { events: options.events ?? [] }
    },
  } as never)
  await context.plugin(GaiaScheduleUsage)
  const service = context.get('gaiaScheduleUsage') as GaiaScheduleUsage
  return { context, service }
}

it('groups shared deliveries once and prices provider-reported usage', async () => {
  const scheduledMessage = createUserMessage({ content: [{ type: 'text', text: 'private scheduled prompt' }], source: { kind: 'user' } })
  const otherMessage = createUserMessage({ content: [{ type: 'text', text: 'private scheduled prompt' }], source: { kind: 'user' } })
  const rows = [task('first', 'First'), task('second', 'Second'), task('third', 'Third')]
  const records = new Map([
    [rows[0]!.id, [receipt(scheduledMessage.id)]],
    [rows[1]!.id, [receipt(scheduledMessage.id)]],
    [rows[2]!.id, [receipt(otherMessage.id)]],
  ])
  const events: SessionEvent[] = [
    { type: 'turn/start', seq: SessionSeq(0), time: 10, data: { turn: 1 } },
    { type: 'user/message', seq: SessionSeq(1), time: 11, data: scheduledMessage, surfaceOp: 'append' },
    assistant(1, 2, 100, 5),
    { type: 'turn/start', seq: SessionSeq(3), time: 20, data: { turn: 2 } },
    { type: 'user/message', seq: SessionSeq(4), time: 21, data: otherMessage, surfaceOp: 'append' },
    assistant(2, 5, 20, 2, 'unknown/model'),
  ]
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [
    { id: 'vendor/model', pricing: { prompt: '0.000001', completion: 0.000002, input_cache_read: '0.0000005', input_cache_write: '0.0000015' } },
    { id: 'incomplete', pricing: { prompt: 'invalid', completion: 0 } },
    null,
  ] }), { status: 200, headers: { 'content-type': 'application/json' } })))
  const test = await dashboard({ tasks: rows, records, events })
  const result: ScheduleUsageDashboard = await test.service.dashboard(allTime, new AbortController().signal)
  expect(result.totalTaskCount).toBe(3)
  expect(result.sharedBatches).toHaveLength(1)
  expect(result.sharedBatches[0]).toMatchObject({
    messageId: scheduledMessage.id, tasks: [{ id: 'first' }, { id: 'second' }],
    usage: [{ provider: 'router', model: 'vendor/model', inputTokens: 100, outputTokens: 5, costUsd: 0.0001225 }],
  })
  expect(result.tasks.map(row => [row.id, row.runs.length, row.sharedRunCount])).toEqual([
    ['first', 0, 1], ['second', 0, 1], ['third', 1, 0],
  ])
  expect(result.tasks[2]?.runs[0]?.totals.costUsd).toBeNull()
  expect(JSON.stringify(result)).not.toContain('PRIVATE PROMPT')
})

it('keeps retained receipts visible when pricing and target Session reads fail', async () => {
  const message = createUserMessage({ content: [], source: { kind: 'user' } })
  const row = task('offline', 'Offline task')
  vi.stubGlobal('fetch', vi.fn(async () => new Response('offline', { status: 503 })))
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const test = await dashboard({ tasks: [row], records: new Map([[row.id, [receipt(message.id)]]]), rejectSession: true })
  const result: ScheduleUsageDashboard = await test.service.dashboard(allTime, new AbortController().signal)
  expect(result.pricingAvailable).toBe(false)
  expect(result.tasks[0]?.runs[0]).toMatchObject({ usageAvailable: false, usage: [], totals: { costUsd: null } })
})

function turn(index: number, message: ReturnType<typeof createUserMessage>, model = 'vendor/model', ended = true): SessionEvent[] {
  const base = index * 10
  return [
    { type: 'turn/start', seq: SessionSeq(base), time: base, data: { turn: index } },
    { type: 'user/message', seq: SessionSeq(base + 1), time: base + 1, data: message, surfaceOp: 'append' },
    assistant(index, base + 2, 1000, 100, model),
    ...(ended ? [{ type: 'turn/end', seq: SessionSeq(base + 3), time: base + 3, data: { turn: index, reason: { kind: 'completed' } } } as SessionEvent] : []),
  ]
}

it('bills uncached input separately from cache tokens', async () => {
  const message = createUserMessage({ content: [], source: { kind: 'user' } })
  const row = task('cost', 'Cost')
  vi.stubGlobal('fetch', catalogResponse([{ id: 'vendor/model', pricing: { prompt: 1, completion: 10, input_cache_read: 0.1, input_cache_write: 2 } }]))
  const test = await dashboard({ tasks: [row], records: new Map([[row.id, [receipt(message.id)]]]), events: turn(1, message) })
  const result = await test.service.dashboard(allTime, new AbortController().signal)
  // 1000 uncached input × 1 + 100 output × 10 + 10 cache read × 0.1 + 5 cache write × 2
  expect(result.tasks[0]?.runs[0]?.totals).toEqual({
    inputTokens: 1000, outputTokens: 100, cacheReadTokens: 10, cacheWriteTokens: 5, costUsd: 2011,
  })
})

it('prices a provider model by its unique OpenRouter model name and leaves ambiguous names unpriced', async () => {
  const first = createUserMessage({ content: [], source: { kind: 'user' } })
  const second = createUserMessage({ content: [], source: { kind: 'user' } })
  const row = task('match', 'Match')
  vi.stubGlobal('fetch', catalogResponse([
    { id: 'openai/gpt-x', pricing: { prompt: 1, completion: 1 } },
    { id: 'a/shared', pricing: { prompt: 1, completion: 1 } },
    { id: 'b/shared', pricing: { prompt: 2, completion: 2 } },
  ]))
  const records = new Map([[row.id, [receipt(second.id), receipt(first.id)]]])
  const test = await dashboard({ tasks: [row], records, events: [...turn(1, first, 'GPT-X'), ...turn(2, second, 'shared')] })
  const result = await test.service.dashboard(allTime, new AbortController().signal)
  const costs = Object.fromEntries(result.tasks[0]!.runs.map(run => [run.usage[0]!.model, run.totals.costUsd]))
  expect(costs['GPT-X']).toBe(1115)
  expect(costs.shared).toBeNull()
})

it('filters deliveries by date range and selected tasks while keeping all task options', async () => {
  const inRange = createUserMessage({ content: [], source: { kind: 'user' } })
  const early = createUserMessage({ content: [], source: { kind: 'user' } })
  const other = createUserMessage({ content: [], source: { kind: 'user' } })
  const rows = [task('kept', 'Kept'), task('hidden', 'Hidden')]
  const records = new Map([
    [rows[0]!.id, [receipt(inRange.id, '2026-11-05T10:00:00.000Z'), receipt(early.id, '2026-10-01T10:00:00.000Z')]],
    [rows[1]!.id, [receipt(other.id, '2026-11-05T11:00:00.000Z')]],
  ])
  vi.stubGlobal('fetch', catalogResponse([{ id: 'vendor/model', pricing: { prompt: 0, completion: 0 } }]))
  const test = await dashboard({ tasks: rows, records, events: [...turn(1, early), ...turn(2, inRange), ...turn(3, other)] })
  const result = await test.service.dashboard(
    { taskIds: ['kept'], from: '2026-11-01T00:00:00.000Z', to: '2026-11-30T23:59:59.999Z' }, new AbortController().signal,
  )
  expect(result.taskOptions.map(option => option.id)).toEqual(['kept', 'hidden'])
  expect(result.tasks.map(row => row.id)).toEqual(['kept'])
  expect(result.tasks[0]?.runs.map(run => run.messageId)).toEqual([inRange.id])
})

it('keeps a batch shared when the filter selects only one of its tasks', async () => {
  const message = createUserMessage({ content: [], source: { kind: 'user' } })
  const rows = [task('first', 'First'), task('second', 'Second')]
  const records = new Map([[rows[0]!.id, [receipt(message.id)]], [rows[1]!.id, [receipt(message.id)]]])
  vi.stubGlobal('fetch', catalogResponse([{ id: 'vendor/model', pricing: { prompt: 0, completion: 0 } }]))
  const test = await dashboard({ tasks: rows, records, events: turn(1, message) })
  const result = await test.service.dashboard({ ...allTime, taskIds: ['first'] }, new AbortController().signal)
  expect(result.tasks.map(row => [row.id, row.runs.length, row.sharedRunCount])).toEqual([['first', 0, 1]])
  expect(result.sharedBatches.map(batch => batch.tasks.map(item => item.id))).toEqual([['first', 'second']])
})

it('rejects an inverted date range', async () => {
  vi.stubGlobal('fetch', catalogResponse([{ id: 'vendor/model', pricing: { prompt: 0, completion: 0 } }]))
  const test = await dashboard({ tasks: [], records: new Map() })
  await expect(test.service.dashboard({ from: allTime.to, to: allTime.from }, new AbortController().signal))
    .rejects.toMatchObject({ code: 'gaia-schedule-usage/invalid-query' })
})

it('reuses usage of ended turns without rereading the Session, but rereads turns still running', async () => {
  const ended = createUserMessage({ content: [], source: { kind: 'user' } })
  const running = createUserMessage({ content: [], source: { kind: 'user' } })
  const rows = [task('ended', 'Ended'), task('running', 'Running')]
  vi.stubGlobal('fetch', catalogResponse([{ id: 'vendor/model', pricing: { prompt: 0, completion: 0 } }]))
  let reads = 0
  const onlyEnded = await dashboard({
    tasks: [rows[0]!], records: new Map([[rows[0]!.id, [receipt(ended.id)]]]), events: turn(1, ended), readSession: () => { reads++ },
  })
  await onlyEnded.service.dashboard(allTime, new AbortController().signal)
  await onlyEnded.service.dashboard(allTime, new AbortController().signal)
  expect(reads).toBe(1)
  reads = 0
  const withRunning = await dashboard({
    tasks: [rows[1]!], records: new Map([[rows[1]!.id, [receipt(running.id)]]]), events: turn(1, running, 'vendor/model', false),
    readSession: () => { reads++ },
  })
  await withRunning.service.dashboard(allTime, new AbortController().signal)
  await withRunning.service.dashboard(allTime, new AbortController().signal)
  expect(reads).toBe(2)
})
