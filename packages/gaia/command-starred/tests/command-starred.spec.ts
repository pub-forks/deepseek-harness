import { copyFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import { AttachmentId } from '@deepseek-ai/dsh-attachment'
import AgentRegistry, { type Agent } from '@deepseek-ai/dsh-agent'
import { createInboxStub } from '@deepseek-ai/dsh-agent-loop-testkit'
import CommandRuntime, { CommandId } from '@deepseek-ai/dsh-commands'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import * as starred from '../src/index.ts'

const discovery = 'Find this project\'s tasks file: the `tasks.default` entry in `.gaia/settings.json`, or `.ai/ToDo.tasks` when that is missing. Deal with the important/starred tasks ONLY (`important: true`, not completed). Group related tasks for planning/implementation where it helps.'
const completion = 'Once a task\'s commit lands, mark it complete in the tasks file (`status: "done"`, `completed: true`, `completedAt` = now); re-read the file right before writing and keep every other field and task unchanged.'
const sequential = 'DO NOT RUN SUBAGENTS IN PARALLEL. WAIT FOR ONE TO FINISH -> REVIEW -> COMMIT -> NEXT TASK.'
const release = 'When every starred task is committed, create a release following this project\'s release rules.'

it.each([
  ['', { mode: 'subagent', model: '', release: false }],
  [' \n\t ', { mode: 'subagent', model: '', release: false }],
  ['inline', { mode: 'inline', model: '', release: false }],
  ['SuBaGeNt GPT-6 Luna', { mode: 'subagent', model: 'GPT-6 Luna', release: false }],
  ['--release INLINE ignored model --release', { mode: 'inline', model: 'ignored model', release: true }],
  ['GPT-6\t --release \n Luna', { mode: 'subagent', model: 'GPT-6 Luna', release: true }],
  ['--release', { mode: 'subagent', model: '', release: true }],
  ['model inline --RELEASE', { mode: 'subagent', model: 'model inline --RELEASE', release: false }],
])('parses %j', (raw, expected) => {
  expect(starred.parseArgs(raw)).toEqual(expected)
})

it.each([
  ['inline', [discovery, 'Implement each task or group yourself (do not delegate), then commit before dealing with the next one.', completion], 'starred: inline'],
  ['', [discovery, 'Delegate each task or group to a subagent with your subagent tool, then review its work and commit.', sequential, completion], 'starred: subagent · sequential'],
  ['subagent GPT-6 Luna --release', [discovery, 'Delegate each task or group to a subagent with your subagent tool on the model GPT-6 Luna, then review its work and commit.', sequential, completion, release], 'starred: subagent GPT-6 Luna · sequential · release after'],
  ['inline ignored --release', [discovery, 'Implement each task or group yourself (do not delegate), then commit before dealing with the next one.', completion, release], 'starred: inline · release after'],
])('pins the prompt and confirmation for %j', (raw, lines, confirmation) => {
  const args = starred.parseArgs(raw)
  expect(starred.buildPrompt(args)).toBe(lines.join('\n'))
  expect(starred.summary(args)).toBe(confirmation)
})

let directory: string | undefined
let ctx: Context | undefined
let agentContext: Context | undefined

afterEach(async () => {
  await agentContext?.fiber.dispose()
  await ctx?.fiber.dispose()
  agentContext = undefined
  ctx = undefined
  if (directory) await rm(directory, { recursive: true, force: true })
  directory = undefined
})

async function compose() {
  directory = await mkdtemp(join(tmpdir(), 'dsh-starred-'))
  const configPath = join(directory, 'cordis.yml')
  await copyFile(new URL('./cordis.yml', import.meta.url), configPath)
  ctx = new Context()
  const context = ctx
  await context.plugin(Loader)
  // The real plugins load from YAML; builtins keep resolution on the source plane.
  Object.assign(context.loader.builtins, {
    include: Include,
    sessions: SessionStore,
    projections: SessionProjectionRegistry,
    agents: AgentRegistry,
    commands: CommandRuntime,
    starred,
  })
  await context.loader.create({
    name: 'cordis:include',
    config: { path: pathToFileURL(configPath).href },
  })
  await context.loader.await()
  for (const entry of context.loader.entries()) await entry.fiber?.await()
  expect([...context.loader.entries()].filter(entry => !entry.disabled && !entry.fiber)).toEqual([])
  const session = context.sessions.create(SessionId('starred-test'))
  const followup = vi.fn<Agent['followup']>()
  agentContext = new Context()
  const agent: Agent = {
    id: session.id, options: {}, session, ctx: agentContext,
    inbox: createInboxStub(), status: 'idle',
    send() {}, followup, steer() {}, inject() {}, cancel() {},
    runMaintenance: task => task(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  }
  await context.agents.register(agent)
  return { context, agent, followup, session }
}

describe('Loader command composition', () => {
  it('advertises /starred, submits one user follow-up, records the result, and unregisters on disposal', async () => {
    const { context, agent, followup, session } = await compose()
    expect(starred.name).toBe('gaia-command-starred')
    expect(starred.inject).toEqual(['commands'])
    expect('default' in starred).toBe(false)
    expect(context.commands.list(agent)).toEqual([{
      definitionId: '@deepseek-ai/dsh-gaia-command-starred',
      name: 'starred',
      description: "Work through the starred tasks in this project's tasks file, one at a time",
      input: { hint: '[inline|subagent] [model] [--release]' },
    }])
    expect(context.commands.find(agent, 'starred')?.input?.attachments).not.toBe(true)
    const execution = await context.commands.execute(agent, '/starred subagent GPT-6 Luna --release', [], new AbortController().signal)
    expect(execution?.result).toEqual({ kind: 'success', text: 'starred: subagent GPT-6 Luna · sequential · release after' })
    expect(followup).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      role: 'user',
      content: [{ type: 'text', text: starred.buildPrompt(starred.parseArgs('subagent GPT-6 Luna --release')) }],
      source: { kind: 'user' },
    }))
    expect(session.snapshotEvents()).toContainEqual(expect.objectContaining({
      type: 'command/done', data: { commandId: execution?.commandId, kind: 'success', text: 'starred: subagent GPT-6 Luna · sequential · release after' },
    }))
    const entry = [...context.loader.entries()].find(item => item.options.name === 'cordis:starred')
    expect(entry?.fiber).toBeDefined()
    await entry!.fiber!.dispose()
    expect(context.commands.find(agent, 'starred')).toBeUndefined()
  })

  it('refuses attachments even when the handler is invoked directly', async () => {
    const { context, agent, followup } = await compose()
    const definition = context.commands.find(agent, 'starred')!
    const result = await definition.handler({
      commandId: CommandId('starred-attachments'), agent, rawInput: 'inline',
      attachments: [{ type: 'file', attachment: { attachmentId: AttachmentId('test-file'), name: 'notes.txt', bytes: 1 } }],
      signal: new AbortController().signal,
    })
    expect(result).toEqual({ kind: 'error', text: 'Attachments are not supported by /starred.' })
    expect(followup).not.toHaveBeenCalled()
  })
})
