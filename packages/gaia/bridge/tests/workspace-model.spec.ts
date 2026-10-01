/** Composed Host coverage of the shared drawer/bridge creation path and durable routing. */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import AgentRegistry, { assembleContextFor } from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import LlmRuntime, { LlmAdapter, ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import Storage from '@deepseek-ai/dsh-storage'
import * as StorageJson from '@deepseek-ai/dsh-storage-json'
import * as StorageDomain from '@deepseek-ai/dsh-storage-domain'
import WorkspaceRegistry from '@deepseek-ai/dsh-workspace'
import JsonlPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import { createSessionTestController } from '../../../api/session-controller/tests/test-remote.ts'
import * as Bridge from '../src/index.ts'
import { WorkspaceModelStore } from '../src/workspace-model-store.ts'

let directory: string
let ctx: Context | undefined
let memoryFiber: Context['fiber'] | undefined
const defaultChoice = { provider: 'fixture', model: 'default' }
const remembered = { provider: 'fixture', model: 'chosen', reasoningEffort: 'high' }
const saveDefault = vi.fn()
let bridgeHandler: ((req: IncomingMessage, res: ServerResponse) => Promise<void>) | undefined

class Adapter extends LlmAdapter {
  override providerInfo(provider: string) { return { id: provider, name: provider } }
  override async listModels() {
    return ['default', 'chosen', 'other'].map(id => ({ provider: 'fixture', id, name: id }))
  }
  override async resolveModel(provider: string, model: string) {
    return { provider, id: model, name: model,
      reasoning: { efforts: ['low', 'high'].map(id => ({ id: ReasoningEffortId(id), name: id })) } }
  }
  override async *stream(_options: GenerateOptions): AsyncIterable<StreamChunk> {}
}

afterEach(async () => {
  await ctx?.fiber.dispose()
  ctx = undefined
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  saveDefault.mockClear()
  if (directory) await rm(directory, { recursive: true, force: true })
})

async function boot() {
  directory = await mkdtemp(join(tmpdir(), 'gaia-model-composition-'))
  vi.stubEnv('DSH_HOME', directory)
  vi.stubEnv('GAIA_CONTROL_SECRET', 'a'.repeat(48))
  ctx = new Context()
  const context = ctx
  await context.plugin(Loader)
  context.loader.builtins.include = Include
  // Only external provider and browser transport are substituted. Agent setup,
  // session creation, selection validation, projection and plugin loading are real.
  function environment() {
    const child = context
    child.llm.registerAdapter(['fixture'], new Adapter())
    createSessionTestController(child, {
      cwd: directory, defaultModelSelection: () => defaultChoice,
      saveDefaultModelSelection: saveDefault,
    })
    child.provide('sessionTitle', {} as never)
    child.provide('webServer', { register: (route: { handler: typeof bridgeHandler }) => {
      bridgeHandler = route.handler
      return () => {}
    } } as never)
  }
  const modules = new Map<string, unknown>([
    ['sessions', SessionStore], ['projections', SessionProjectionRegistry],
    ['agents', AgentRegistry], ['loop', AgentLoop], ['prompt', SystemPrompt],
    ['tools', ToolRuntime], ['llm', LlmRuntime], ['environment', { name: 'environment',
      inject: ['llm', 'sessions', 'agents', 'sessionProjections', 'workspaceRegistry', 'sessionPersistence'], apply: environment }],
    ['@deepseek-ai/dsh-gaia-bridge', Bridge],
    ['storage', Storage], ['storage-json', StorageJson], ['storage-domain', StorageDomain],
    ['workspaces', WorkspaceRegistry], ['persistence', JsonlPersistence],
  ])
  context.loader.internal = {
    version: 'v2', async import(specifier: string) {
      if (!modules.has(specifier)) throw new Error(`Unexpected plugin: ${specifier}`)
      return modules.get(specifier)
    },
  } as never
  const config = join(directory, 'cordis.yml')
  await writeFile(config, [
    '- name: sessions', '- name: projections', '- name: agents',
    '- name: llm', '- name: prompt', '- name: tools',
    '- name: storage', '- name: storage-json', '  config:', `    root: ${JSON.stringify(join(directory, 'data'))}`,
    '- name: storage-domain', '  config:', '    backend: json',
    '- name: persistence', '  config:', `    root: ${JSON.stringify(join(directory, 'sessions'))}`, '    compression: none',
    '- name: workspaces', '- name: environment', '- name: loop', '  config:', '    agents: []',
    "- name: '@deepseek-ai/dsh-gaia-bridge'", '',
  ].join('\n'))
  await context.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(config).href } })
  await context.loader.await()
  for (const entry of context.loader.entries()) await entry.fiber?.await()
  memoryFiber = [...context.loader.entries()].find(entry => entry.options.name === '@deepseek-ai/dsh-gaia-bridge')?.fiber
  expect(memoryFiber).toBeDefined()
  return context
}
function choice(context: Context, id: SessionId) {
  const session = context.sessions.get(id)!
  return context.sessionProjections.snapshot(session).values.modelSelection?.next ?? defaultChoice
}
async function create(context: Context, cwd = directory) {
  await mkdir(cwd, { recursive: true })
  const workspace = await context.workspaceRegistry.create(cwd)
  return (await context.sessionController.create({ workspaceId: workspace.id })).sessionId
}
async function bridgeCreate(workspaceId: string): Promise<SessionId> {
  const req = { method: 'POST', url: '/gaia/control/sessions',
    headers: { authorization: `Bearer ${'a'.repeat(48)}`, 'content-type': 'application/json' },
    socket: { remoteAddress: '127.0.0.1' },
    async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify({ workspaceId })) },
  } as IncomingMessage
  let status = 0
  let payload = ''
  const res = { headersSent: false, writeHead(code: number) { status = code },
    end(text: string) { payload = text },
  } as never as ServerResponse
  await bridgeHandler?.(req, res)
  expect(status).toBe(200)
  return SessionId((JSON.parse(payload) as { sessionId: string }).sessionId)
}
async function remember() {
  const context = await boot()
  const id = await create(context)
  await context.sessionController.selectModel({ sessionId: id, ...remembered })
  await context.sessions.flush(context.sessions.get(id)!)
  return { context, id }
}

describe('Gaia bridge workspace model memory through real Loader composition', () => {
  it('records successful selections and applies them before routing setup for new sessions only', async () => {
    const { context, id } = await remember()
    const file = join(directory, 'gaia-workspace-models.json')
    const raw = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>
    expect(raw[directory]).toEqual({ ...remembered, updatedAt: expect.any(Number) as number })
    const count = saveDefault.mock.calls.length
    const fresh = await bridgeCreate((await context.workspaceRegistry.create(directory)).id)
    expect(choice(context, fresh)).toEqual(remembered)
    expect(choice(context, id)).toEqual(remembered)
    expect(saveDefault).toHaveBeenCalledTimes(count)
    expect(choice(context, await create(context, join(directory, 'other-project')))).toEqual(defaultChoice)
    const agent = context.agents.get(fresh)!
    const assembly = await agent.ctx.systemPrompt.assemble(assembleContextFor(agent))
    expect(assembly.variables.provider).toBe(remembered.provider)
    expect(assembly.variables.model).toBe(remembered.model)
    expect(await readFile(file, 'utf8')).toBe(JSON.stringify(raw) + '\n')
  })

  it('records effort-only changes and does not record rejected selections', async () => {
    const { context, id } = await remember()
    await context.sessionController.selectModel({ sessionId: id, ...remembered, reasoningEffort: 'low' })
    expect(choice(context, await create(context))).toEqual({ ...remembered, reasoningEffort: 'low' })
    await context.sessionController.selectModel({ sessionId: id, provider: 'fixture', model: 'other' })
    await context.sessions.flush(context.sessions.get(id)!)
    expect(choice(context, await create(context))).toEqual({ provider: 'fixture', model: 'other' })
    await expect(context.sessionController.selectModel({ sessionId: id, provider: 'missing', model: 'bad' })).rejects.toThrow()
    expect(choice(context, await create(context))).toEqual({ provider: 'fixture', model: 'other' })
  })

  it.each([
    { provider: 'missing', model: 'chosen' },
    { provider: 'fixture', model: 'removed' },
    { provider: 'fixture', model: 'chosen', reasoningEffort: 'removed' },
  ])('silently uses normal default for an unavailable remembered choice %j', async (stale) => {
    const context = await boot()
    await new WorkspaceModelStore(join(directory, 'gaia-workspace-models.json')).record(directory, stale)
    // Reload the child store through normal plugin disposal/remount.
    await memoryFiber?.dispose()
    const mounted = context.plugin(Bridge)
    await mounted.await()
    expect(choice(context, await create(context))).toEqual(defaultChoice)
  })

  it('keeps explicit choices on idempotent adoption and forked sessions, and leaves subagents alone', async () => {
    const { context, id } = await remember()
    const old = await create(context)
    await context.sessionController.selectModel({ sessionId: id, provider: 'fixture', model: 'other' })
    await context.sessionController.create({ sessionId: old, cwd: directory })
    expect(choice(context, old)).toEqual(remembered)
    const source = context.sessions.get(old)!
    const fork = await context.sessionController.fork({ sessionId: old, atSeq: source.seq - 1 })
    expect(choice(context, fork.sessionId)).toEqual(remembered)
    const child = await context.agents.create({
      sessionId: SessionId('subagent-test'), parentAgent: context.agents.get(id)!,
      meta: { cwd: directory, origin: 'subagent', parentSession: id },
    })
    expect(child.agent.session.snapshotEvents().some(event => event.type === 'model/selection')).toBe(false)
    child.agent.session.append('model/selection', { provider: 'fixture', model: 'default' })
    expect(choice(context, await create(context))).toEqual({ provider: 'fixture', model: 'other' })
  })

  it('loads workspace choices after plugin restart without changing resumed sessions', async () => {
    const { context } = await remember()
    const storedSession = context.sessions.prepare(SessionId('stored-explicit'), { meta: { cwd: directory } })
    storedSession.append('model/selection', { provider: 'fixture', model: 'other' })
    const stored = await context.sessionPersistence.create(storedSession.header)
    await stored.append(storedSession.snapshotEvents())
    await stored.flush()
    await stored.close()
    await memoryFiber?.dispose()
    await context.plugin(Bridge)
    const resumed = await context.sessionController.create({ sessionId: storedSession.id, cwd: directory })
    expect(choice(context, resumed.sessionId)).toEqual({ provider: 'fixture', model: 'other' })
    expect(choice(context, await create(context))).toEqual(remembered)
  })

  it.each(['listModels', 'resolveCallConfig'] as const)('silently falls back when %s fails', async (method) => {
    const { context } = await remember()
    vi.spyOn(context.llm, method).mockRejectedValue(new Error('provider unavailable'))
    expect(choice(context, await create(context))).toEqual(defaultChoice)
  })

  it('restores public create methods and removes record observers on plugin disposal', async () => {
    const { context, id } = await remember()
    await memoryFiber?.dispose()
    expect(choice(context, await create(context))).toEqual(defaultChoice)
    await context.sessionController.selectModel({ sessionId: id, provider: 'fixture', model: 'other' })
    await context.sessions.flush(context.sessions.get(id)!)
    expect(await new WorkspaceModelStore(join(directory, 'gaia-workspace-models.json')).get(directory)).toEqual(remembered)
  })
})
