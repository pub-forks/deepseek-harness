import { afterEach, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AuthorizationService from '@deepseek-ai/dsh-authorization'
import type { AuthorizationSession } from '@deepseek-ai/dsh-authorization'
import { credentialKey } from '@deepseek-ai/dsh-credentials'
import { MemoryCredentials } from '../../../credentials/authorization/tests/memory.ts'
import { GaiaAuthorizationController } from '../src/index.ts'
import { projectFlow } from '../src/projection.ts'
import type { AttemptItem } from '../src/types.ts'

const key = credentialKey('llm-pi-ai', 'openai-codex')
const roots: Context[] = []
async function next(iterator: AsyncIterator<AttemptItem>): Promise<AttemptItem> {
  const result = await iterator.next()
  if (result.done) throw new Error('attempt stream ended early')
  return result.value
}
afterEach(async () => { await Promise.all(roots.splice(0).map(ctx => ctx.fiber.dispose())) })
async function fixture(run: (session: AuthorizationSession, ctx: Context) => Promise<void>, providers: Record<string, unknown> = {}) {
  const ctx = new Context()
  roots.push(ctx)
  await ctx.plugin(MemoryCredentials)
  await ctx.plugin(AuthorizationService)
  ctx.authorization.registerFlow({ key, label: 'Codex', methods: [{ id: 'oauth', label: 'OAuth' }], run: session => run(session, ctx) })
  let revision = 1
  const settings = {
    describe: () => [{ ns: 'llm-pi-ai', revision, value: { providers: structuredClone(providers) } }],
    mutate: async (_ns: string, ops: Array<{ op: string; path: string[]; value?: unknown }>) => {
      for (const op of ops) {
        if (op.path[0] !== 'providers' || !op.path[1]) continue
        if (op.op === 'set') providers[op.path[1]] = op.value
        else Reflect.deleteProperty(providers, op.path[1])
      }
      revision += 1
    },
  }
  Object.defineProperty(ctx, 'settings', { value: settings, configurable: true })
  Object.defineProperty(ctx, 'llm', {
    value: { listConfigurableProviders: () => [{ provider: 'openai-codex', declared: false }] },
    configurable: true,
  })
  return { controller: new GaiaAuthorizationController(ctx), ctx, providers }
}

it('projects only allowlisted fields even if input objects contain tokens', () => {
  const entry = { key, label: 'Codex', methods: [{ id: 'oauth', label: 'OAuth', secret: 'method-secret' }], inFlight: false, token: 'entry-secret' }
  const record = { configured: true, kind: 'grant' as const, writable: true, accessToken: 'record-secret' }
  expect(projectFlow(entry, record)).toEqual({ key, label: 'Codex', methods: [{ id: 'oauth', label: 'OAuth' }], inFlight: false, signedIn: true })
})

it('streams notice and prompt, accepts an answer, then reports authorized', async () => {
  const { controller } = await fixture(async (session, ctx) => {
    session.notify({ message: 'Open the page', url: 'https://example.test', code: 'ABCD' })
    if (await session.prompt({ kind: 'text', message: 'Paste callback' }) !== 'answer') throw new Error('wrong answer')
    await ctx.credentials.modifyRecord(key, async () => ({ kind: 'grant', payload: { accessToken: 'never-on-wire' } }))
  })
  const iterator = controller.start({ key, method: 'oauth' }, new AbortController().signal)[Symbol.asyncIterator]()
  const notice = (await next(iterator))
  expect(notice).toMatchObject({ type: 'notice', message: 'Open the page', code: 'ABCD' })
  const prompt = (await next(iterator))
  expect(prompt).toMatchObject({ type: 'prompt', kind: 'text' })
  if (prompt.type !== 'prompt') throw new Error('expected prompt')
  expect(controller.answer({ attemptId: prompt.attemptId, promptId: prompt.promptId, value: 'answer' })).toBe(true)
  expect((await next(iterator))).toMatchObject({ type: 'done', outcome: 'authorized' })
  expect((await controller.listFlows())[0]).toMatchObject({ signedIn: true, inFlight: false })
  expect(JSON.stringify(await controller.listFlows())).not.toContain('accessToken')
})

it('cancels an attempt waiting at a prompt', async () => {
  const { controller } = await fixture(async (session) => { await session.prompt({ kind: 'secret', message: 'Secret' }) })
  const iterator = controller.start({ key, method: 'oauth' }, new AbortController().signal)[Symbol.asyncIterator]()
  const prompt = (await next(iterator))
  expect(controller.cancel({ attemptId: prompt.attemptId })).toBe(true)
  expect((await next(iterator))).toMatchObject({ type: 'done', outcome: 'cancelled' })
})

it('reports prompt withdrawal while the flow continues', async () => {
  const { controller } = await fixture(async (session, ctx) => {
    const withdrawn = new AbortController()
    const pending = session.prompt({ kind: 'text', message: 'Pasted code', signal: withdrawn.signal }).catch(() => '')
    withdrawn.abort()
    await pending
    await ctx.credentials.modifyRecord(key, async () => ({ kind: 'grant', payload: {} }))
  })
  const iterator = controller.start({ key, method: 'oauth' }, new AbortController().signal)[Symbol.asyncIterator]()
  expect((await next(iterator)).type).toBe('prompt')
  expect((await next(iterator)).type).toBe('withdrawn')
  expect((await next(iterator))).toMatchObject({ type: 'done', outcome: 'authorized' })
})

it('reports the underlying reason when a flow fails', async () => {
  const { controller } = await fixture(async () => { throw new Error('token exchange failed:\n  400 invalid_grant') })
  const iterator = controller.start({ key, method: 'oauth' }, new AbortController().signal)[Symbol.asyncIterator]()
  expect(await next(iterator)).toMatchObject({ type: 'error', message: 'Sign-in failed.', detail: 'token exchange failed: 400 invalid_grant' })
})

it('names the reason for early refusals and non-Error failures', async () => {
  const { controller } = await fixture(async () => { throw { status: 500 } as unknown as Error })
  const unknownMethod = controller.start({ key, method: 'nope' }, new AbortController().signal)[Symbol.asyncIterator]()
  expect(await next(unknownMethod)).toMatchObject({ type: 'error', message: 'Sign-in failed.', detail: 'Unknown sign-in method nope.' })
  const plain = controller.start({ key, method: 'oauth' }, new AbortController().signal)[Symbol.asyncIterator]()
  expect(await next(plain)).toMatchObject({ type: 'error', message: 'Sign-in failed.', detail: '{"status":500}' })
})

it('returns busy on a second attempt and refuses an unknown sign-out key', async () => {
  const { controller } = await fixture(async (session) => { await session.prompt({ kind: 'text', message: 'Wait' }) })
  const lifetime = new AbortController()
  const first = controller.start({ key, method: 'oauth' }, lifetime.signal)[Symbol.asyncIterator]()
  const prompt = (await next(first))
  const second = controller.start({ key, method: 'oauth' }, new AbortController().signal)[Symbol.asyncIterator]()
  expect((await next(second))).toMatchObject({ type: 'error', message: 'busy' })
  await expect(controller.signOut({ key: credentialKey('missing', 'key') })).rejects.toThrow('Unknown')
  expect(controller.cancel({ attemptId: prompt.attemptId })).toBe(true)
  await first.next()
})

it('validates account creation at the Host boundary and persists alias metadata only', async () => {
  const { controller, ctx, providers } = await fixture(async () => {})
  await expect(controller.createAccount({ source: 'openai-codex', accountId: '../bad', label: 'Bad' })).rejects.toThrow(/Account id/)
  await expect(controller.createAccount({ source: 'missing', accountId: 'codex-work', label: 'Work' })).rejects.toThrow(/Unknown OAuth source/)
  await controller.createAccount({ source: 'openai-codex', accountId: 'codex-work', label: 'Work' })
  expect(providers['codex-work']).toEqual({ displayName: 'Work', catalogProvider: 'openai-codex' })
  ctx.authorization.registerFlow({
    key: credentialKey('llm-pi-ai', 'uninstalled'), label: 'Uninstalled',
    methods: [{ id: 'oauth', label: 'OAuth' }], run: async () => {},
  })
  await expect(controller.createAccount({ source: 'uninstalled', accountId: 'codex-other', label: 'Other' }))
    .rejects.toThrow(/installed OAuth provider/)
  Object.defineProperty(ctx, 'llm', {
    value: { listConfigurableProviders: () => [
      { provider: 'openai-codex', declared: false }, { provider: 'codex-other', declared: true },
    ] },
    configurable: true,
  })
  await expect(controller.createAccount({ source: 'openai-codex', accountId: 'codex-other', label: 'Other' }))
    .rejects.toThrow(/already in use/)
})

it('removes an alias and only that route credential, refusing active deletion', async () => {
  const aliasKey = credentialKey('llm-pi-ai', 'codex-work')
  const providers: Record<string, unknown> = { 'codex-work': { displayName: 'Work', catalogProvider: 'openai-codex' } }
  const { controller, ctx } = await fixture(async (_session, context) => {
    await context.credentials.modifyRecord(aliasKey, async () => ({ kind: 'grant', payload: { accessToken: 'fixture-token' } }))
  }, providers)
  ctx.authorization.registerFlow({ key: aliasKey, label: 'Work', methods: [{ id: 'oauth', label: 'OAuth' }], run: async () => {} })
  await ctx.credentials.modifyRecord(key, async () => ({ kind: 'grant', payload: { accessToken: 'other-fixture' } }))
  await controller.signOut({ key: aliasKey })
  expect(providers['codex-work']).toBeDefined()
  await ctx.credentials.modifyRecord(aliasKey, async () => ({ kind: 'grant', payload: { accessToken: 'fixture-token' } }))
  await controller.removeAccount({ key: aliasKey })
  expect(providers['codex-work']).toBeUndefined()
  await expect(ctx.credentials.readRecord(aliasKey)).resolves.toBeUndefined()
  await expect(ctx.credentials.readRecord(key)).resolves.toMatchObject({ kind: 'grant' })
})

it('refuses alias deletion while its authorization flow is active', async () => {
  const aliasKey = credentialKey('llm-pi-ai', 'codex-work')
  const { controller, ctx } = await fixture(async () => {}, { 'codex-work': { catalogProvider: 'openai-codex' } })
  ctx.authorization.registerFlow({
    key: aliasKey, label: 'Work', methods: [{ id: 'oauth', label: 'OAuth' }],
    run: session => new Promise<void>((resolve) => {
      session.signal.addEventListener('abort', () => { resolve() }, { once: true })
    }),
  })
  const lifetime = new AbortController()
  const stream = controller.start({ key: aliasKey, method: 'oauth' }, lifetime.signal)[Symbol.asyncIterator]()
  const nextItem = stream.next()
  await new Promise(resolve => setTimeout(resolve, 0))
  await expect(controller.removeAccount({ key: aliasKey })).rejects.toThrow(/in progress/)
  lifetime.abort()
  await nextItem
  await stream.return?.()
})
