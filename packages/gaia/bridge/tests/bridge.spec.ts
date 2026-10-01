import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { IndexInjection } from '@deepseek-ai/dsh-host-webserver'
import { apply, isLoopbackPeer, validBearer } from '../src/index.ts'
import { sha256 } from '../src/profile-files.ts'

const secret = 'a'.repeat(64)

afterEach(() => { vi.unstubAllEnvs() })

type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void>

function fixture(value: string | undefined = secret, documentPath: string | null = '/tmp/cordis.patch.yml') {
  vi.stubEnv('GAIA_CONTROL_SECRET', value ?? '')
  let handler: Handler | undefined
  type MockWorkspace = {
    id: string
    path: string
    title: string
    createdAt: string
    sessionIds: string[]
    setTitle(title: string): Promise<void>
    status(): Promise<string>
  }
  const workspaces = new Map<string, MockWorkspace>()
  const sessions: { sessionId: string; running: boolean; updatedAt: number; projections: { values: { title: string } } }[] = []
  const archivedSessions = new Set<string>()
  const indexInjectListeners: ((table: IndexInjection[]) => void)[] = []
  const warn = vi.fn()
  const ctx = {
    logger: () => ({ warn }),
    on: (event: string, listener: (table: IndexInjection[]) => void) => {
      if (event === 'webserver/index-inject') indexInjectListeners.push(listener)
    },
    effect: (register: () => () => void) => { register() },
    // The default-route seed runs through ctx.inject; it has its own tests.
    inject: () => {},
    webServer: { register: (route: { handler: Handler }) => { handler = route.handler; return () => {} } },
    workspaceRegistry: {
      create: async (path: string, title?: string) => {
        let workspace = workspaces.get(path)
        if (!workspace) { workspace = { id: `workspace-${workspaces.size + 1}`, path, title: title ?? 'tmp', createdAt: '2026-01-01T00:00:00Z', sessionIds: [], setTitle: async (next) => { workspace!.title = next }, status: async () => 'ok' }; workspaces.set(path, workspace) }
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
    // Optional service: reachable only through ctx.get, as in a real Cordis
    // context where undeclared `ctx.configEditor` access throws.
    get: (name: string) => (name === 'configEditor' && documentPath !== null ? { documentPath } : undefined),
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
  return { call, ctx, warn, indexInjectListeners }
}

describe('Gaia control bridge', () => {
  it('injects valid operator authorities as a dedicated page global', () => {
    vi.stubEnv('GAIA_OPERATOR_HOSTS', ' AI.RAYA.WORK, localhost:3002, [::1]:80, example.test:443, , ')
    const f = fixture()
    const table: IndexInjection[] = []
    for (const listener of f.indexInjectListeners) listener(table)
    expect(table).toEqual([{
      kind: 'global', name: '__DSH_OPERATOR_HOSTS__',
      value: ['AI.RAYA.WORK', 'localhost:3002', '[::1]:80', 'example.test:443'],
    }])
    expect(f.warn).not.toHaveBeenCalled()
  })

  it('drops invalid operator authorities with one warning per entry', () => {
    const invalid = [
      'https://ai.raya.work', 'ai.raya.work/path', 'user@ai.raya.work',
      'ai.raya.work?query', 'ai.raya.work#hash', '*.raya.work',
      'ai.raya.work:', 'ai.raya.work:080', 'ai.raya.work:99999',
      '0x7f.0.0.1', '%61i.raya.work', '::1', 'ai. raya.work',
    ]
    vi.stubEnv('GAIA_OPERATOR_HOSTS', ['ai.raya.work', ...invalid].join(','))
    const f = fixture()
    const table: IndexInjection[] = []
    for (const listener of f.indexInjectListeners) listener(table)
    expect(table).toEqual([{ kind: 'global', name: '__DSH_OPERATOR_HOSTS__', value: ['ai.raya.work'] }])
    expect(f.warn).toHaveBeenCalledTimes(invalid.length)
    for (const entry of invalid) {
      expect(f.warn).toHaveBeenCalledWith(`Dropping invalid GAIA_OPERATOR_HOSTS entry ${JSON.stringify(entry)}`)
    }
  })

  it.each([undefined, '', ' , , ', 'host/path'])('does not register injection without valid operator hosts: %j', (value) => {
    vi.stubEnv('GAIA_OPERATOR_HOSTS', value)
    expect(fixture().indexInjectListeners).toHaveLength(0)
  })

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

  it('lists workspaces and validates and applies workspace titles', async () => {
    const f = fixture()
    const created = await f.call('POST', '/gaia/control/workspaces/ensure', { path: '/tmp', title: '  Project  ' })
    expect(created.status).toBe(200)
    expect((await f.call('GET', '/gaia/control/workspaces')).body.workspaces).toEqual([{
      id: 'workspace-1', path: '/tmp', title: 'Project', createdAt: '2026-01-01T00:00:00Z', status: 'ok',
    }])
    expect((await f.call('POST', '/gaia/control/workspaces/rename', { workspaceId: 'workspace-1', title: ' Renamed ' })).status).toBe(200)
    expect((await f.call('GET', '/gaia/control/workspaces')).body.workspaces).toMatchObject([{ title: 'Renamed' }])
    expect((await f.call('POST', '/gaia/control/workspaces/rename', { workspaceId: 'missing', title: 'Name' })).status).toBe(404)
    expect((await f.call('POST', '/gaia/control/workspaces/rename', { workspaceId: 'workspace-1', title: '   ' })).status).toBe(400)
    expect((await f.call('POST', '/gaia/control/workspaces/rename', { workspaceId: 'workspace-1', title: 'x'.repeat(121) })).status).toBe(400)
    expect((await f.call('POST', '/gaia/control/workspaces/rename', { workspaceId: 'workspace-1', title: 'Title', extra: true })).status).toBe(400)
    expect((await f.call('GET', '/gaia/control/workspaces?extra=1')).status).toBe(400)
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

  it('does not serve removed remote and stream endpoints', async () => {
    const f = fixture()
    expect(await f.call('POST', '/gaia/control/remote', {})).toEqual({ status: 404, body: { error: 'not_found' } })
    expect(await f.call('POST', '/gaia/control/streams', {})).toEqual({ status: 404, body: { error: 'not_found' } })
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

  it('answers 503 for file routes while the config editor is not mounted', async () => {
    const f = fixture(secret, null)
    const document = await f.call('GET', '/gaia/control/config-document')
    expect(document.status).toBe(503)
    expect(document.body).toEqual({ error: { code: 'config_editor_unavailable' } })
    expect((await f.call('GET', '/gaia/control/profile-files')).status).toBe(503)
  })
})
