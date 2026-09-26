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
async function fixture(run: (session: AuthorizationSession, ctx: Context) => Promise<void>) {
  const ctx = new Context()
  roots.push(ctx)
  await ctx.plugin(MemoryCredentials)
  await ctx.plugin(AuthorizationService)
  ctx.authorization.registerFlow({ key, label: 'Codex', methods: [{ id: 'oauth', label: 'OAuth' }], run: session => run(session, ctx) })
  return new GaiaAuthorizationController(ctx)
}

it('projects only allowlisted fields even if input objects contain tokens', () => {
  const entry = { key, label: 'Codex', methods: [{ id: 'oauth', label: 'OAuth', secret: 'method-secret' }], inFlight: false, token: 'entry-secret' }
  const record = { configured: true, kind: 'grant' as const, writable: true, accessToken: 'record-secret' }
  expect(projectFlow(entry, record)).toEqual({ key, label: 'Codex', methods: [{ id: 'oauth', label: 'OAuth' }], inFlight: false, signedIn: true })
})

it('streams notice and prompt, accepts an answer, then reports authorized', async () => {
  const controller = await fixture(async (session, ctx) => {
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
  const controller = await fixture(async (session) => { await session.prompt({ kind: 'secret', message: 'Secret' }) })
  const iterator = controller.start({ key, method: 'oauth' }, new AbortController().signal)[Symbol.asyncIterator]()
  const prompt = (await next(iterator))
  expect(controller.cancel({ attemptId: prompt.attemptId })).toBe(true)
  expect((await next(iterator))).toMatchObject({ type: 'done', outcome: 'cancelled' })
})

it('reports prompt withdrawal while the flow continues', async () => {
  const controller = await fixture(async (session, ctx) => {
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

it('returns busy on a second attempt and refuses an unknown sign-out key', async () => {
  const controller = await fixture(async (session) => { await session.prompt({ kind: 'text', message: 'Wait' }) })
  const lifetime = new AbortController()
  const first = controller.start({ key, method: 'oauth' }, lifetime.signal)[Symbol.asyncIterator]()
  const prompt = (await next(first))
  const second = controller.start({ key, method: 'oauth' }, new AbortController().signal)[Symbol.asyncIterator]()
  expect((await next(second))).toMatchObject({ type: 'error', message: 'busy' })
  await expect(controller.signOut({ key: credentialKey('missing', 'key') })).rejects.toThrow('Unknown')
  expect(controller.cancel({ attemptId: prompt.attemptId })).toBe(true)
  await first.next()
})
