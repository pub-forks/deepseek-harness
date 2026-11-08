import { afterEach, expect, it, vi } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import { SessionId, SessionSeq } from '@deepseek-ai/dsh-session'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { ScheduleId } from '@deepseek-ai/dsh-schedule'
import type { ScheduleRecord, ScheduleDeliveryRecord } from '@deepseek-ai/dsh-schedule'
import { createAssistantMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import type { ScheduleUsageDashboard } from '../src/types.ts'
import ScheduleUsage from '../src/index.ts'
import { harness, seededTask, taskTable } from '../../../schedule/schedule/tests/harness.ts'

type ScheduleHarness = Awaited<ReturnType<typeof harness>>
const instances: Array<{ ctx: Context; directory: string }> = []
afterEach(async () => {
  for (const instance of instances.splice(0)) {
    await instance.ctx.fiber.dispose()
    await rm(instance.directory, { recursive: true, force: true })
  }
  vi.unstubAllGlobals()
})

it('loads through a test cordis.yml and projects a real Scheduler delivery', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'gaia-schedule-usage-loader-'))
  const test: ScheduleHarness = await harness()
  instances.push({ ctx: test.ctx, directory })
  await test.ctx.plugin(Loader)
  test.ctx.loader.builtins.include = Include

  const sessionId = SessionId('loader-target')
  const userMessage = createUserMessage({ content: [{ type: 'text', text: 'private delivery text' }], source: { kind: 'user' } })
  const delivery: ScheduleDeliveryRecord = {
    messageId: userMessage.id, targetSessionId: sessionId,
    scheduledAt: '2026-11-07T08:00:00.000Z', deliveredAt: '2026-11-07T08:01:00.000Z',
    prompt: 'PRIVATE PROMPT',
  }
  const record: ScheduleRecord = {
    id: ScheduleId('loader-task'), kind: 'at', title: 'Loader report', prompt: 'PRIVATE PROMPT',
    scheduledAt: delivery.scheduledAt,
  }
  await taskTable(test.ctx).put(record.id, seededTask(record, { kind: 'session', sessionId }, {
    lastDelivery: {
      messageId: delivery.messageId, targetSessionId: sessionId, scheduledAt: delivery.scheduledAt, deliveredAt: delivery.deliveredAt,
    },
    deliveryHistory: { records: [delivery], earlierRecordsUnavailable: false, earlierRecordsPruned: false },
  }))

  const events: SessionEvent[] = [
    { type: 'turn/start', seq: SessionSeq(0), time: 1, data: { turn: 1 } },
    { type: 'user/message', seq: SessionSeq(1), time: 2, data: userMessage, surfaceOp: 'append' },
    {
      type: 'assistant/message', seq: SessionSeq(2), time: 3, surfaceOp: 'append',
      data: {
        turn: 1, step: 1,
        message: createAssistantMessage({ content: [], source: { provider: 'router', model: 'vendor/model' } }),
        stream: [],
        usage: { inputTokens: 20, outputTokens: 4, cacheReadTokens: 0, cacheWriteTokens: 0 },
      },
    },
  ]
  test.ctx.provide('sessionQuery', { readSession: async () => ({ events }) } as never)
  test.ctx.loader.internal = {
    version: 'v2',
    async import(specifier: string) {
      if (specifier !== '@deepseek-ai/dsh-gaia-schedule-usage') throw new Error(`Unexpected plugin: ${specifier}`)
      return ScheduleUsage
    },
  } as never
  const config = join(directory, 'cordis.yml')
  await writeFile(config, [
    '- id: schedule-usage',
    "  name: '@deepseek-ai/dsh-gaia-schedule-usage'",
    '  config: {}',
    '',
  ].join('\n'))
  await test.ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(config).href } })
  await test.ctx.loader.await()
  for (const entry of test.ctx.loader.entries()) await entry.fiber?.await()

  const entries = [...test.ctx.loader.entries()]
  const loaded = entries.find(entry => entry.options.id === 'schedule-usage')
  expect(loaded?.fiber).toBeDefined()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [
    { id: 'vendor/model', pricing: { prompt: 0.000001, completion: 0.000002 } },
  ] }), { status: 200, headers: { 'content-type': 'application/json' } })))
  const result: ScheduleUsageDashboard = await (test.ctx.get('gaiaScheduleUsage') as ScheduleUsage).dashboard({ from: '2026-01-01T00:00:00.000Z', to: '2026-12-31T23:59:59.999Z' }, new AbortController().signal)
  expect(result.tasks.map(task => task.title)).toEqual(['Loader report'])
  expect(result.tasks[0]?.runs[0]?.usage[0]).toMatchObject({
    provider: 'router', model: 'vendor/model', inputTokens: 20, outputTokens: 4,
  })
  expect(result.tasks[0]?.runs[0]?.usage[0]?.costUsd).toBeCloseTo(0.000028, 12)
  expect(JSON.stringify(result)).not.toContain('PRIVATE PROMPT')
})
