import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { SessionEvent, SessionId as SessionIdType } from '@deepseek-ai/dsh-session'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import { createToolResultMessage, createUserMessage, ToolCallId } from '@deepseek-ai/dsh-llm'
import type { ScheduleCatalogEntry, ScheduleDeliveryRecord } from '@deepseek-ai/dsh-schedule'
import { ScheduleId } from '@deepseek-ai/dsh-schedule'
import { ApprovalRequestId } from '@deepseek-ai/dsh-user-approval'
import type { SessionRequestId } from '@deepseek-ai/dsh-api-session-controller'
import { ScheduleArchiveController } from '../src/archive.ts'
import type { ArchiveContext } from '../src/archive.ts'
import { decision } from '../src/archive.ts'
import * as plugin from '../src/index.ts'

import type {} from '@deepseek-ai/dsh-schedule'

async function sessionEvents(options: {
  target?: 'schedule' | 'user'
  reason?: 'completed' | 'error' | 'aborted'
  takeover?: boolean
  approval?: boolean
  question?: boolean
  ended?: boolean
} = {}): Promise<readonly SessionEvent[]> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  const session = ctx.sessions.create(SessionId('schedule-archive-test'))
  session.append('turn/start', { turn: 1 })
  const source = options.target === 'user'
    ? { kind: 'user' as const, rpcId: 'test-request' as SessionRequestId }
    : { kind: 'schedule' as const }
  const message = createUserMessage({ content: [{ type: 'text', text: 'run' }], source })
  session.append('user/message', message, { surfaceOp: 'append' })
  if (options.approval === true) {
    session.append('approval/asked', { id: ApprovalRequestId('pending-approval'), toolName: 'bash' })
  }
  if (options.question === true) {
    const callId = ToolCallId('pending-question')
    session.append('tool/call', { turn: 1, step: 1, callId, name: 'ask_user_question', arguments: '{\"questions\":[]}' })
    session.append('tool/result', {
      turn: 1, step: 1,
      message: createToolResultMessage({ callId, content: [{ type: 'text', text: '{\"pending\":true}' }], isError: false }),
    }, { surfaceOp: 'append' })
  }
  if (options.takeover === true) {
    session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
    session.append('turn/start', { turn: 2 })
    session.append('user/message', createUserMessage({
      content: [{ type: 'text', text: 'continue' }],
      source: { kind: 'user', rpcId: 'takeover-request' as SessionRequestId },
    }), { surfaceOp: 'append' })
    session.append('turn/end', { turn: 2, reason: { kind: 'completed' } })
  } else if (options.ended !== false) {
    const reason = options.reason === 'error'
      ? { kind: 'error' as const, error: { message: 'failed', code: 'UNKNOWN' } }
      : options.reason === 'aborted'
        ? { kind: 'aborted' as const, reason: { kind: 'user' as const } }
        : { kind: 'completed' as const }
    session.append('turn/end', { turn: 1, reason })
  }
  return session.snapshotEvents()
}

function fixture(events: readonly SessionEvent[]) {
  const sessionId = SessionId('schedule-archive-test')
  const task: ScheduleCatalogEntry = {
    id: ScheduleId('task-1'), kind: 'at', title: 'Nightly', prompt: 'Run',
    scheduledAt: '2026-11-19T00:00:00.000Z',
    target: { kind: 'new', create: {} }, involvedSessionIds: [], status: 'ended',
  }
  const message = events.find((event): event is SessionEvent<'user/message'> => event.type === 'user/message')
  if (message === undefined) throw new Error('fixture requires a delivered message')
  const receipt: ScheduleDeliveryRecord = {
    messageId: message.data.id,
    targetSessionId: sessionId,
    scheduledAt: new Date().toISOString(),
    deliveredAt: new Date().toISOString(),
  }
  const catalog = vi.fn<ArchiveContext['schedule']['catalog']>(async () => [task])
  const history = vi.fn<ArchiveContext['schedule']['history']>(async () => ({
    id: task.id, records: [receipt], earlierRecordsUnavailable: false, earlierRecordsPruned: false,
    retention: { days: 30, records: 500 },
  }))
  const schedule: ArchiveContext['schedule'] = { catalog, history }
  const archiveSession = vi.fn(async (_id: SessionIdType) => undefined)
  const agents = new Map<SessionIdType, { session: { id: SessionIdType }; status: 'idle' | 'running' }>()
  const workspaceRegistry: ArchiveContext['workspaceRegistry'] = {
    archivedSessionIds: [],
    pinnedSessionIds: [],
    archiveSession,
  }
  const readSession = vi.fn(async () => ({ events }))
  let scheduleChanged: (() => void) | undefined
  let agentStatus: ((sessionId: SessionIdType, status: 'idle' | 'running') => void) | undefined
  const ctx: ArchiveContext = {
    agents: { get: sessionId => agents.get(sessionId) as Agent | undefined },
    logger: { warn: vi.fn() },
    schedule,
    sessionQuery: { readSession },
    workspaceRegistry,
    onScheduleChanged(listener) {
      scheduleChanged = listener
      return () => { scheduleChanged = undefined }
    },
    onAgentStatus(listener) {
      agentStatus = listener
      return () => { agentStatus = undefined }
    },
  }
  return {
    archiveSession, schedule, catalog, history, readSession, workspaceRegistry, task, receipt, ctx,
    controller: new ScheduleArchiveController(ctx, true),
    emitScheduleChanged() { scheduleChanged?.() },
    agents,
    emitIdle(id: SessionIdType) { agentStatus?.(id, 'idle') },
  }
}

async function settle(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0))
  await new Promise(resolve => setTimeout(resolve, 0))
}

describe('scheduled Session archival', () => {
  it('archives a completed new-target delivery after the Agent is idle without stopActivity', async () => {
    const state = fixture(await sessionEvents())
    const dispose = state.controller.start()
    await settle()
    expect(state.archiveSession).toHaveBeenCalledExactlyOnceWith(state.receipt.targetSessionId)
    dispose()
  })

  it('does nothing when disabled', async () => {
    const ctx = new Context()
    const fiber = await ctx.plugin(plugin, { enabled: false, keepFailed: true })
    await settle()
    await fiber.dispose()
  })

  it('keeps failed turns visible by default and archives them only when keepFailed is false', async () => {
    const events = await sessionEvents({ reason: 'error' })
    const id = String(events.find(event => event.type === 'user/message')?.data.id)
    expect(decision(events, id, true)).toBe('skip')
    expect(decision(events, id, false)).toBe('archive')
    const state = fixture(events)
    const dispose = state.controller.start()
    await settle()
    expect(state.archiveSession).not.toHaveBeenCalled()
    dispose()
  })

  it.each(['session', 'new_once'] as const)('never handles %s delivery targets', async (targetKind) => {
    const state = fixture(await sessionEvents())
    state.catalog.mockResolvedValueOnce([{
      ...state.task,
      target: targetKind === 'session'
        ? { kind: 'session', sessionId: state.receipt.targetSessionId }
        : { kind: 'new_once', sessionId: state.receipt.targetSessionId, create: {} },
    }])
    const dispose = state.controller.start()
    await settle()
    expect(state.archiveSession).not.toHaveBeenCalled()
    dispose()
  })

  it('skips Sessions awaiting questions or approvals, taken over by a user, or pinned', async () => {
    const base = await sessionEvents()
    const id = String(base.find(event => event.type === 'user/message')?.data.id)
    const approvalEvents = await sessionEvents({ approval: true })
    const approvalMessageId = String(approvalEvents.find(event => event.type === 'user/message')?.data.id)
    const questionEvents = await sessionEvents({ question: true })
    const questionMessageId = String(questionEvents.find(event => event.type === 'user/message')?.data.id)
    expect(decision(approvalEvents, approvalMessageId, true)).toBe('wait')
    expect(decision(questionEvents, questionMessageId, true)).toBe('wait')
    expect(decision(await sessionEvents({ takeover: true }), id, true)).toBe('skip')
    const nonScheduler = await sessionEvents({ target: 'user' })
    expect(decision(nonScheduler, String(nonScheduler.find(event => event.type === 'user/message')?.data.id), true)).toBe('skip')

    const pinned = fixture(base)
    ;(pinned.workspaceRegistry.pinnedSessionIds as SessionId[]).push(pinned.receipt.targetSessionId)
    const dispose = pinned.controller.start()
    await settle()
    expect(pinned.archiveSession).not.toHaveBeenCalled()
    dispose()
  })

  it('bounds restart receipt reads to one page of twenty per task', async () => {
    const state = fixture(await sessionEvents())
    const dispose = state.controller.start()
    await settle()
    expect(state.history.mock.calls).toContainEqual([{ id: ScheduleId('task-1'), limit: 20 }])
    dispose()
  })

  it('swallows archive failures so Schedule change dispatch continues', async () => {
    const state = fixture(await sessionEvents())
    state.archiveSession.mockRejectedValueOnce(new Error('archive failed'))
    const dispose = state.controller.start()
    await settle()
    expect(() => { state.emitScheduleChanged() }).not.toThrow()
    dispose()
  })

  it('does not archive incomplete or aborted turns', async () => {
    const events = await sessionEvents({ reason: 'aborted' })
    expect(decision(events, String(events.find(event => event.type === 'user/message')?.data.id), false)).toBe('skip')
  })

  it('checks only the Session whose Agent became idle', async () => {
    const events = await sessionEvents()
    const state = fixture(events)
    state.agents.set(state.receipt.targetSessionId, { session: { id: state.receipt.targetSessionId }, status: 'running' })
    const unrelatedId = SessionId('unrelated-agent')
    state.agents.set(unrelatedId, { session: { id: unrelatedId }, status: 'running' })
    const dispose = state.controller.start()
    await settle()
    const readSession = state.readSession
    expect(readSession).not.toHaveBeenCalled()

    state.emitIdle(unrelatedId)
    await settle()
    expect(readSession).not.toHaveBeenCalled()

    state.agents.get(state.receipt.targetSessionId)!.status = 'idle'
    state.emitIdle(state.receipt.targetSessionId)
    await settle()
    expect(readSession).toHaveBeenCalledExactlyOnceWith(state.receipt.targetSessionId)
    expect(state.archiveSession).toHaveBeenCalledExactlyOnceWith(state.receipt.targetSessionId)
    dispose()
  })

  it.each(['error', 'aborted'] as const)('forgets a failed or %s turn after one read', async (reason) => {
    const state = fixture(await sessionEvents({ reason }))
    const dispose = state.controller.start()
    await settle()
    const readSession = state.readSession
    expect(readSession).toHaveBeenCalledTimes(1)

    state.emitIdle(state.receipt.targetSessionId)
    state.emitScheduleChanged()
    await settle()
    expect(readSession).toHaveBeenCalledTimes(1)
    expect(state.archiveSession).not.toHaveBeenCalled()
    dispose()
  })

  it('drops an unresolved candidate after its receipt expires on a later sweep', async () => {
    const state = fixture(await sessionEvents({ ended: false }))
    const dispose = state.controller.start()
    await settle()
    const readSession = state.readSession
    expect(readSession).toHaveBeenCalledTimes(1)

    Object.assign(state.receipt, { deliveredAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() })
    state.emitScheduleChanged()
    await settle()
    state.emitIdle(state.receipt.targetSessionId)
    await settle()
    expect(readSession).toHaveBeenCalledTimes(1)
    expect(state.archiveSession).not.toHaveBeenCalled()
    dispose()
  })
})
