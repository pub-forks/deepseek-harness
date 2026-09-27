import { describe, expect, it, vi } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import { apply, isLoopbackPeer, validBearer } from '../src/index.ts'

const secret = 'a'.repeat(64)

type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void>

function fixture(value: string | undefined = secret) {
  vi.stubEnv('GAIA_CONTROL_SECRET', value ?? '')
  let handler: Handler | undefined
  const workspaces = new Map<string, { id: string; path: string; sessionIds: string[] }>()
  const sessions: { sessionId: string; running: boolean; updatedAt: number; projections: { values: { title: string } } }[] = []
  const archivedSessions = new Set<string>()
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
})
