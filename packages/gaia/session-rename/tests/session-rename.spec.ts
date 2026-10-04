import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import type { Agent, AgentStatus } from '@deepseek-ai/dsh-agent'
import { createInboxStub } from '@deepseek-ai/dsh-agent-loop-testkit'
import { GoalId } from '@deepseek-ai/dsh-goal'
import { AttachmentId } from '@deepseek-ai/dsh-attachment'
import { CommandId } from '@deepseek-ai/dsh-commands'
import { createUserMessage, ToolCallId } from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import { turnBoundaryProjectionDefinition } from '@deepseek-ai/dsh-agent-loop'
import SessionTitleService from '@deepseek-ai/dsh-session-title'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import type { ToolExecutionResult } from '@deepseek-ai/dsh-tools'
import CommandRuntime from '@deepseek-ai/dsh-commands'
import * as sessionRename from '../src/index.ts'

const signal = new AbortController().signal

async function setup() {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  ctx.sessionProjections.register(turnBoundaryProjectionDefinition)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(CommandRuntime)
  await ctx.plugin(SessionTitleService, { fallbackMaxWords: 5, fallbackMaxBytes: 80, maxTitleBytes: 80 })
  const fiber = await ctx.plugin(sessionRename)
  const session = ctx.sessions.create(SessionId(`rename-${Math.random()}`))
  let status: AgentStatus = 'running'
  const followup = vi.fn<Agent['followup']>()
  const agent: Agent = {
    id: session.id, options: {}, session, ctx: new Context(), inbox: createInboxStub(),
    get status() { return status },
    send() {}, followup, steer() { return { outcome: Promise.resolve({ status: 'rejected' as const }) } },
    inject() {}, cancel() {}, runMaintenance: task => task(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  }
  await ctx.agents.register(agent)
  function openTurn(source: 'user' | 'goal' = 'user'): void {
    const turn = session.snapshotEvents().filter(event => event.type === 'turn/start').length + 1
    session.append('turn/start', { turn })
    session.append('user/message', createUserMessage({
      content: [{ type: 'text', text: 'Please rename this session' }],
      source: source === 'user' ? { kind: 'user' } : { kind: 'goal', goalId: GoalId('goal-1'), revision: 1, round: 1 },
    }), { surfaceOp: 'append' })
  }
  async function execute(args: unknown, caller: Agent = agent): Promise<ToolExecutionResult> {
    return ctx.agents.withInitiator(caller, () => ctx.tools.execute({
      signal, callId: ToolCallId(`rename-call-${Math.random()}`), name: 'rename_session', arguments: args, agent: caller,
    }))
  }
  return { ctx, fiber, session, agent, followup, openTurn, execute, setStatus(value: AgentStatus) { status = value } }
}

describe('rename_session', () => {
  it('renames only the calling agent session and returns the accepted title', async () => {
    const state = await setup()
    state.openTurn()
    const result = await state.execute({ title: '  Build\tNotes ' })
    expect(result.isError).toBe(false)
    expect(result.value).toEqual({ title: 'Build Notes' })
    expect(state.ctx.sessionTitle.get(state.session)?.title).toBe('Build Notes')
    expect(state.ctx.tools.executionMode({ signal, callId: ToolCallId('rename-mode'), name: 'rename_session', arguments: {} }))
      .toEqual({ kind: 'exclusive' })
    await state.fiber.dispose()
  })

  it('rejects a turn without direct-human authority', async () => {
    const state = await setup()
    state.openTurn('goal')
    const result = await state.execute({ title: 'Not authorized' })
    expect(result.isError).toBe(true)
    expect(state.ctx.sessionTitle.get(state.session)).toBeUndefined()
    await state.fiber.dispose()
  })

  it('rejects a subagent even when the turn contains a user-source message', async () => {
    const state = await setup()
    state.openTurn()
    vi.spyOn(state.ctx.agents, 'roots').mockReturnValue([])
    const result = await state.execute({ title: 'Child title' })
    expect(result.isError).toBe(true)
    expect(state.ctx.sessionTitle.get(state.session)?.title).not.toBe('Child title')
    await state.fiber.dispose()
  })

  it('returns a structured error when the title normalizes to empty', async () => {
    const state = await setup()
    state.openTurn()
    const result = await state.execute({ title: '\u001b[31m\u001b[0m' })
    expect(result.isError).toBe(true)
    expect(result.error?.info?.code).toBe('SESSION_RENAME_INVALID_TITLE')
    await state.fiber.dispose()
  })

  it('declares only title as model input', async () => {
    const state = await setup()
    const schema = state.ctx.tools.schemas().find(tool => tool.name === 'rename_session')
    expect(schema?.parameters).toMatchObject({ properties: { title: { type: 'string' } }, additionalProperties: false })
    expect(Object.keys((schema?.parameters as { properties: Record<string, unknown> }).properties)).toEqual(['title'])
    state.openTurn()
    const rejected = await state.execute({ title: 'No ids', session_id: 'another-session' })
    expect(rejected.error?.info?.code).toBe('SESSION_RENAME_INVALID_ARGS')
    expect(state.ctx.sessionTitle.get(state.session)?.source.kind).not.toBe('user')
    await state.fiber.dispose()
  })
})

describe('/rename', () => {
  it('renames the invocation agent session directly and returns the normalized title', async () => {
    const state = await setup()
    const result = await state.ctx.commands.execute(state.agent, '/rename  Sprint\tPlan  ', [], signal)
    expect(result?.result).toEqual({ kind: 'success', text: 'renamed: Sprint Plan' })
    expect(state.ctx.sessionTitle.get(state.session)?.title).toBe('Sprint Plan')
    await state.fiber.dispose()
  })

  it('sends a follow-up asking the agent to propose and apply a title when empty', async () => {
    const state = await setup()
    const result = await state.ctx.commands.execute(state.agent, '/rename', [], signal)
    expect(result?.result).toEqual({ kind: 'success', text: 'asked the agent to suggest a title' })
    expect(state.followup).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      role: 'user',
      content: [{ type: 'text', text: 'Propose a concise title for this session based on our conversation, then apply it with rename_session.' }],
      source: { kind: 'user' },
    }))
    await state.fiber.dispose()
  })

  it('rejects attachments', async () => {
    const state = await setup()
    const definition = state.ctx.commands.find(state.agent, 'rename')!
    const result = await definition.handler({
      commandId: CommandId('rename-attachments'), agent: state.agent, rawInput: '',
      attachments: [{ type: 'file', attachment: { attachmentId: AttachmentId('test-file'), name: 'notes.txt', bytes: 1 } }],
      signal,
    })
    expect(result).toEqual({ kind: 'error', text: 'Attachments are not supported by /rename.' })
    expect(state.followup).not.toHaveBeenCalled()
    await state.fiber.dispose()
  })
})
