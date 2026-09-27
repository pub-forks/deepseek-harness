import { describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { apply, isLoopbackPeer, validBearer } from '../src/index.ts'
import { sha256 } from '../src/profile-files.ts'

const secret = 'a'.repeat(64)

type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void>

function fixture(value: string | undefined = secret, documentPath = '/tmp/cordis.patch.yml') {
  vi.stubEnv('GAIA_CONTROL_SECRET', value ?? '')
  let handler: Handler | undefined
  const workspaces = new Map<string, { id: string; path: string; sessionIds: string[] }>()
  const sessions: { sessionId: string; running: boolean; updatedAt: number; projections: { values: { title: string } } }[] = []
  const archivedSessions = new Set<string>()
  const gateway = {
    invoke: vi.fn(async (_request: { namespace: string; method: string; args: Record<string, unknown> }): Promise<unknown> => 'ok'),
    stream: vi.fn(async (_request: { namespace: string; method: string; args: Record<string, unknown>; signal?: AbortSignal }) =>
      (async function* () {})() as AsyncIterable<unknown>),
  }
  const ctx = {
    logger: () => ({ warn: vi.fn() }),
    effect: (register: () => () => void) => { register() },
    // The default-route seed runs through ctx.inject; it has its own tests.
    inject: () => {},
    webServer: { register: (route: { handler: Handler }) => { handler = route.handler; return () => {} } },
    workspaceRegistry: {
      create: async (path: string) => {
        let workspace = workspaces.get(path)
        if (!workspace) { workspace = { id: `workspace-${workspaces.size + 1}`, path, sessionIds: [] }; workspaces.set(path, workspace) }
        return workspace
      },
      get: (id: string) => [...workspaces.values()].find(workspace => workspace.id === id),
      list: () => [...workspaces.values()],
      get archivedSessionIds() { return [...archivedSessions] },
      archiveSession: vi.fn(async (sessionId: string) => { archivedSessions.add(sessionId) }),
      unarchiveSession: vi.fn(async (sessionId: string) => { archivedSessions.delete(sessionId) }),
    },
    sessionController: {
      create: vi.fn(async ({ workspaceId }: { workspaceId: string }) => {
        const sessionId = `session-${sessions.length + 1}`
        sessions.push({ sessionId, running: false, updatedAt: 1, projections: { values: { title: '' } } })
        const workspace = [...workspaces.values()].find(item => item.id === workspaceId)
        workspace?.sessionIds.push(sessionId)
        return { sessionId }
      }),
      list: vi.fn(async () => ({ items: sessions })),
      rename: vi.fn(async ({ sessionId, title }: { sessionId: string; title: string }) => {
        const session = sessions.find(item => item.sessionId === sessionId)
        if (session) session.projections.values.title = title
      }),
    },
    agents: { list: () => [{ status: 'running' }] },
    typertGateway: gateway,
    configEditor: { documentPath },
  }
  apply(ctx as never as Context)
  async function call(
    method: string, path: string, data?: object,
    options: { token?: string; peer?: string; contentType?: string; bytes?: string } = {},
  ) {
    const source = options.bytes ?? (data === undefined ? '' : JSON.stringify(data))
    const req = {
      method, url: path,
      headers: { authorization: options.token ?? `Bearer ${secret}`, 'content-type': options.contentType ?? 'application/json' },
      socket: { remoteAddress: options.peer ?? '127.0.0.1' },
      async *[Symbol.asyncIterator]() { if (source) yield Buffer.from(source) },
    } as IncomingMessage
    let status = 0
    let payload = ''
    const res = {
      headersSent: false,
      writeHead(code: number) { status = code },
      end(value: string) { payload = value },
      destroy: vi.fn(),
    } as unknown as ServerResponse
    await handler?.(req, res)
    return { status, body: JSON.parse(payload) as Record<string, unknown> }
  }
  return { call, ctx }
}

describe('Gaia control bridge', () => {
  it('rejects a missing secret, bad bearer and remote peer; accepts a good bearer', async () => {
    expect((await fixture('').call('GET', '/gaia/control/health')).status).toBe(503)
    const f = fixture()
    expect((await f.call('GET', '/gaia/control/health', undefined, { token: 'Bearer wrong' })).status).toBe(401)
    expect((await f.call('GET', '/gaia/control/health', undefined, { peer: '192.0.2.1' })).status).toBe(403)
    expect((await f.call('GET', '/gaia/control/health')).body.ready).toBe(true)
    expect(validBearer(`Bearer ${secret}`, secret)).toBe(true)
    expect(validBearer('Bearer short', secret)).toBe(false)
    expect(isLoopbackPeer('::ffff:127.0.0.1')).toBe(true)
  })

  it('caps JSON bodies and validates input', async () => {
    const f = fixture()
    expect((await f.call('POST', '/gaia/control/sessions', {}, { bytes: 'x'.repeat(16385) })).status).toBe(413)
    expect((await f.call('POST', '/gaia/control/remote', {}, { bytes: 'x'.repeat(256 * 1024 + 1) })).status).toBe(413)
    expect((await f.call('PUT', '/gaia/control/config-document', {}, { bytes: 'x'.repeat(1_310_721) })).status).toBe(413)
    expect((await f.call('POST', '/gaia/control/workspaces/ensure', { path: 'relative' })).status).toBe(400)
    expect((await f.call('POST', '/gaia/control/sessions', { workspaceId: 'missing' })).status).toBe(404)
    expect((await f.call('POST', '/gaia/control/sessions', {}, { contentType: 'text/plain' })).status).toBe(400)
  })

  it('ensures a real directory once and creates, lists, renames and archives sessions', async () => {
    const f = fixture()
    const first = await f.call('POST', '/gaia/control/workspaces/ensure', { path: '/tmp' })
    const second = await f.call('POST', '/gaia/control/workspaces/ensure', { path: '/tmp' })
    expect(first.body.workspaceId).toBe(second.body.workspaceId)
    const created = await f.call('POST', '/gaia/control/sessions', { workspaceId: first.body.workspaceId, title: 'Initial' })
    expect(created.body.sessionId).toBe('session-1')
    const listed = await f.call('GET', `/gaia/control/sessions?workspaceId=${first.body.workspaceId}`)
    expect(listed.body.sessions).toEqual([{ sessionId: 'session-1', title: 'Initial', running: false, updatedAt: 1, archived: false }])
    expect((await f.call('POST', '/gaia/control/sessions/session-1/rename', { title: 'Next' })).body.ok).toBe(true)
    expect((await f.call('POST', '/gaia/control/sessions/session-1/archive', {})).body.ok).toBe(true)
    expect(f.ctx.workspaceRegistry.archiveSession).toHaveBeenCalled()

    // Without includeArchived, archived session is omitted
    const unarchivedOnly = await f.call('GET', `/gaia/control/sessions?workspaceId=${first.body.workspaceId}`)
    expect(unarchivedOnly.body.sessions).toEqual([])

    // With includeArchived=1, archived session is included with archived: true
    const withArchived = await f.call('GET', `/gaia/control/sessions?workspaceId=${first.body.workspaceId}&includeArchived=1`)
    expect(withArchived.body.sessions).toEqual([{ sessionId: 'session-1', title: 'Next', running: false, updatedAt: 1, archived: true }])

    // Query validation
    expect((await f.call('GET', `/gaia/control/sessions?workspaceId=${first.body.workspaceId}&includeArchived=0`)).status).toBe(400)
    expect((await f.call('GET', `/gaia/control/sessions?workspaceId=${first.body.workspaceId}&extra=true`)).status).toBe(400)

    // Unarchive unknown session -> 404
    expect((await f.call('POST', '/gaia/control/sessions/nonexistent/unarchive', {})).status).toBe(404)

    // Unarchive session-1
    const unarchiveRes = await f.call('POST', '/gaia/control/sessions/session-1/unarchive', {})
    expect(unarchiveRes.status).toBe(200)
    expect(unarchiveRes.body.ok).toBe(true)
    expect(f.ctx.workspaceRegistry.unarchiveSession).toHaveBeenCalledWith('session-1')

    // Session is now unarchived in list
    const afterUnarchive = await f.call('GET', `/gaia/control/sessions?workspaceId=${first.body.workspaceId}`)
    expect(afterUnarchive.body.sessions).toEqual([{ sessionId: 'session-1', title: 'Next', running: false, updatedAt: 1, archived: false }])
  })

  it('includes contentless sessions defaulting title and updatedAt', async () => {
    const f = fixture()
    const ws = await f.call('POST', '/gaia/control/workspaces/ensure', { path: '/tmp' })
    // Manually add a session id to workspace that is not in sessionController.list()
    const workspace = f.ctx.workspaceRegistry.get(ws.body.workspaceId as string)
    workspace?.sessionIds.push('fresh-session')
    const listed = await f.call('GET', `/gaia/control/sessions?workspaceId=${ws.body.workspaceId}`)
    expect(listed.body.sessions).toEqual([{ sessionId: 'fresh-session', title: '', running: false, updatedAt: null, archived: false }])
  })

  it('reports an explicit approximation for activity', async () => {
    expect((await fixture().call('GET', '/gaia/control/activity')).body).toEqual({ attachedClients: 0, runningTurns: 1, approximate: true })
  })

  it('allows only listed unary Remotes and maps their errors without stacks', async () => {
    const f = fixture()
    expect(await f.call('POST', '/gaia/control/remote', { namespace: 'settings', method: 'openSettingsDocument', args: {} }))
      .toMatchObject({ status: 404, body: { error: { code: 'not_allowed' } } })
    expect(f.ctx.typertGateway.invoke).not.toHaveBeenCalled()
    f.ctx.typertGateway.invoke.mockResolvedValueOnce({ currentRevision: 2 })
    expect(await f.call('POST', '/gaia/control/remote', { namespace: 'settings', method: 'describe', args: {} }))
      .toMatchObject({ status: 200, body: { result: { currentRevision: 2 } } })
    f.ctx.typertGateway.invoke.mockRejectedValueOnce({
      isDSHRemoteError: true, code: 'settings/refused', message: 'refused', stack: 'secret stack',
    })
    const failed = await f.call('POST', '/gaia/control/remote', { namespace: 'settings', method: 'describe', args: {} })
    expect(failed).toEqual({ status: 400, body: { error: { code: 'settings/refused', message: 'refused' } } })
    f.ctx.typertGateway.invoke.mockRejectedValueOnce({
      isDSHRemoteError: true, code: 'gateway/signature-invalid', message: 'method kind mismatch', stack: 'private stack',
    })
    expect(await f.call('POST', '/gaia/control/remote', { namespace: 'settings', method: 'describe', args: {} }))
      .toEqual({ status: 400, body: { error: { code: 'gateway/signature-invalid', message: 'method kind mismatch' } } })
  })

  it('rejects Remote call kind mismatches', async () => {
    const f = fixture()
    expect((await f.call('POST', '/gaia/control/remote', { namespace: 'gaiaAuthorization', method: 'start', args: {} })).status).toBe(400)
    expect((await f.call('POST', '/gaia/control/streams', { namespace: 'settings', method: 'describe', args: {} })).status).toBe(400)
  })

  it('buffers stream items for polling and cancels the in-process source', async () => {
    const f = fixture()
    f.ctx.typertGateway.stream.mockImplementationOnce(async () => (async function* () {
      yield { state: 'prompt' }
      yield { state: 'done' }
    })())
    const opened = await f.call('POST', '/gaia/control/streams', { namespace: 'gaiaAuthorization', method: 'start', args: {} })
    const id = opened.body.streamId as string
    expect(id).toMatch(/^[0-9a-f]{32}$/)
    expect(await f.call('GET', `/gaia/control/streams/${id}?after=0`)).toMatchObject({
      status: 200, body: { items: [{ state: 'prompt' }], next: 1 },
    })
    expect(await f.call('GET', `/gaia/control/streams/${id}?after=1`)).toMatchObject({
      status: 200, body: { items: [{ state: 'done' }], next: 2 },
    })
    expect(await f.call('GET', `/gaia/control/streams/${id}?after=2`)).toMatchObject({
      status: 200, body: { items: [], next: 2, done: true },
    })
    const pending = new Promise<void>(() => {})
    f.ctx.typertGateway.stream.mockImplementationOnce(async ({ signal }) => (async function* () {
      yield 'first'
      await pending
      if (signal?.aborted) return
    })())
    const second = await f.call('POST', '/gaia/control/streams', { namespace: 'gaiaAuthorization', method: 'start', args: {} })
    const secondId = second.body.streamId as string
    expect((await f.call('DELETE', `/gaia/control/streams/${secondId}`)).status).toBe(200)
    expect(f.ctx.typertGateway.stream.mock.calls[1]?.[0].signal?.aborted).toBe(true)
  })

  it('enforces stream count and buffer caps', async () => {
    const f = fixture()
    const forever = async function* () { await new Promise<void>(() => {}); yield null }
    f.ctx.typertGateway.stream.mockImplementation(async () => forever())
    const ids: string[] = []
    for (let index = 0; index < 8; index++) {
      const opened = await f.call('POST', '/gaia/control/streams', { namespace: 'gaiaAuthorization', method: 'start', args: {} })
      ids.push(opened.body.streamId as string)
    }
    expect((await f.call('POST', '/gaia/control/streams', { namespace: 'gaiaAuthorization', method: 'start', args: {} })))
      .toMatchObject({ status: 409, body: { error: { code: 'too_many_streams' } } })
    for (const id of ids) await f.call('DELETE', `/gaia/control/streams/${id}`)

    f.ctx.typertGateway.stream.mockImplementationOnce(async () => (async function* () { for (let i = 0; i < 501; i++) yield i })())
    const opened = await f.call('POST', '/gaia/control/streams', { namespace: 'gaiaAuthorization', method: 'start', args: {} })
    await new Promise<void>(resolve => setImmediate(resolve))
    const result = await f.call('GET', `/gaia/control/streams/${opened.body.streamId as string}?after=0`)
    expect(result.status).toBe(200)
    expect(result.body.items).toHaveLength(500)
    expect(result.body).toMatchObject({ done: true, error: { code: 'stream_overflow' } })
  })

  it('reads and atomically updates the config document with a sha256 precondition', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'gaia-bridge-'))
    try {
      const path = join(directory, 'cordis.patch.yml')
      await writeFile(path, '[]\n', { mode: 0o640 })
      const f = fixture(secret, path)
      const current = await f.call('GET', '/gaia/control/config-document')
      expect(current.body).toEqual({ path, text: '[]\n', sha256: sha256('[]\n') })
      expect(await f.call('PUT', '/gaia/control/config-document', { text: 'not: [valid', expectedSha256: sha256('[]\n') }))
        .toMatchObject({ status: 422, body: { error: { code: 'invalid_yaml' } } })
      expect(await f.call('PUT', '/gaia/control/config-document', { text: '[]\n', expectedSha256: 'wrong' }))
        .toMatchObject({ status: 409, body: { error: { code: 'conflict' }, sha256: sha256('[]\n') } })
      const saved = await f.call('PUT', '/gaia/control/config-document', { text: '- id: plugins\n', expectedSha256: sha256('[]\n') })
      expect(saved.body).toEqual({ sha256: sha256('- id: plugins\n') })
      expect(await readFile(path, 'utf8')).toBe('- id: plugins\n')
      expect(((await (await import('node:fs/promises')).stat(path)).mode & 0o777)).toBe(0o640)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('lists and guards profile files by fixed name and precondition', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'gaia-profile-'))
    try {
      const documentPath = join(directory, 'cordis.patch.yml')
      await writeFile(documentPath, '[]\n')
      await writeFile(join(directory, 'package.json'), '{"name":"profile"}\n')
      await writeFile(join(directory, '.credentials.yaml'), 'private: true\n')
      const f = fixture(secret, documentPath)
      expect((await f.call('GET', '/gaia/control/profile-files')).body.files).toEqual([
        { name: 'cordis.patch.yml', size: 3, sha256: sha256('[]\n') },
        { name: 'package.json', size: Buffer.byteLength('{"name":"profile"}\n'), sha256: sha256('{"name":"profile"}\n') },
      ])
      expect((await f.call('GET', '/gaia/control/profile-files/package.json')).body)
        .toEqual({ name: 'package.json', text: '{"name":"profile"}\n', sha256: sha256('{"name":"profile"}\n') })
      expect(await f.call('PUT', '/gaia/control/profile-files/package.json', {
        text: '{"name":"next"}\n', expectedSha256: sha256('{"name":"profile"}\n'),
      })).toMatchObject({ status: 200, body: { sha256: sha256('{"name":"next"}\n') } })
      const invalid = await f.call('PUT', '/gaia/control/profile-files/package.json', {
        text: '{bad', expectedSha256: sha256('{"name":"next"}\n'),
      })
      expect(invalid.status).toBe(422)
      expect((await f.call('GET', '/gaia/control/profile-files/.credentials.yaml')).status).toBe(404)
      expect((await f.call('GET', '/gaia/control/profile-files/sessions')).status).toBe(404)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
