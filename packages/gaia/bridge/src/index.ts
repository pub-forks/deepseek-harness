/** Gaia's loopback-only, bearer-authenticated Host control API. */
import { createHash, timingSafeEqual } from 'node:crypto'
import { realpath, stat } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { isIP } from 'node:net'
import { isAbsolute } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { getDshRuntimeVersion } from '@deepseek-ai/dsh-app-boot'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-api-session-controller'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-session-title'
import type {} from '@deepseek-ai/dsh-config-editor'
import { scheduleSeed } from './seed.ts'

const PREFIX = '/gaia/control'
const MAX_BODY = 16 * 1024

/** Cordis plugin identity. */
export const name = 'gaia-bridge'
/** The Host services used by the bridge. */
export const inject = ['webServer', 'workspaceRegistry', 'sessionController', 'sessions', 'agents', 'sessionTitle']

/** Compare a submitted token with the activation-time secret in constant time. */
export function validBearer(header: string | undefined, secret: string): boolean {
  if (header === undefined || !header.startsWith('Bearer ')) return false
  const supplied = header.slice(7)
  const left = createHash('sha256').update(supplied).digest()
  const right = createHash('sha256').update(secret).digest()
  return timingSafeEqual(left, right)
}

/** Accept only an IP loopback peer, including IPv4-mapped IPv6. */
export function isLoopbackPeer(address: string | undefined): boolean {
  if (address === undefined) return false
  const value = address.startsWith('::ffff:') ? address.slice(7) : address
  return value === '::1' || (isIP(value) === 4 && value.startsWith('127.'))
}

class RequestError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code) }
}

function answer(res: ServerResponse, status: number, value: object): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(value))
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')) {
    throw new RequestError(400, 'invalid_content_type')
  }
  const declared = Number(req.headers['content-length'])
  if (Number.isFinite(declared) && declared > MAX_BODY) throw new RequestError(413, 'body_too_large')
  let size = 0
  const parts: Uint8Array[] = []
  for await (const chunk of req) {
    const bytes = chunk as Uint8Array
    size += bytes.byteLength
    if (size > MAX_BODY) throw new RequestError(413, 'body_too_large')
    parts.push(bytes)
  }
  try {
    const value: unknown = JSON.parse(Buffer.concat(parts).toString('utf8'))
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('object expected')
    return value as Record<string, unknown>
  } catch {
    throw new RequestError(400, 'invalid_body')
  }
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 4096) {
    throw new RequestError(400, `invalid_${key}`)
  }
  return value
}

function exactFields(record: Record<string, unknown>, keys: readonly string[]): void {
  if (Object.keys(record).some(key => !keys.includes(key))) throw new RequestError(400, 'invalid_body')
}

/** Register the control prefix for the life of this plugin. */
export function apply(ctx: Context): void {
  scheduleSeed(ctx)
  const secret = process.env.GAIA_CONTROL_SECRET
  if (secret === undefined || secret.length < 32) ctx.logger('gaia-bridge').warn('GAIA_CONTROL_SECRET is missing or too short; control API unavailable')
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix', path: PREFIX,
    handler: async (req, res) => {
      try {
        if (secret === undefined || secret.length < 32) throw new RequestError(503, 'unavailable')
        if (!isLoopbackPeer(req.socket.remoteAddress)) throw new RequestError(403, 'forbidden')
        if (!validBearer(req.headers.authorization, secret)) throw new RequestError(401, 'unauthorized')
        const url = new URL(req.url ?? '/', 'http://localhost')
        const path = url.pathname
        const method = req.method
        if (method === 'GET' && path === `${PREFIX}/health`) {
          answer(res, 200, { ready: true, dshVersion: getDshRuntimeVersion() })
        } else if (method === 'POST' && path === `${PREFIX}/workspaces/ensure`) {
          const request = await body(req)
          exactFields(request, ['path'])
          const requested = stringField(request, 'path')
          if (!isAbsolute(requested)) throw new RequestError(400, 'invalid_path')
          let canonical: string
          try {
            canonical = await realpath(requested)
            if (!(await stat(canonical)).isDirectory()) throw new RequestError(400, 'invalid_path')
          } catch {
            throw new RequestError(400, 'invalid_path')
          }
          const workspace = await ctx.workspaceRegistry.create(canonical)
          answer(res, 200, { workspaceId: workspace.id })
        } else if (method === 'POST' && path === `${PREFIX}/sessions`) {
          const request = await body(req)
          exactFields(request, ['workspaceId', 'title'])
          const workspaceId = WorkspaceId(stringField(request, 'workspaceId'))
          if (ctx.workspaceRegistry.get(workspaceId) === undefined) throw new RequestError(404, 'workspace_not_found')
          const title = request.title === undefined ? undefined : stringField(request, 'title')
          const created = await ctx.sessionController.create({ workspaceId })
          if (title !== undefined) await ctx.sessionController.rename({ sessionId: created.sessionId, title })
          answer(res, 200, { sessionId: created.sessionId })
        } else if (method === 'GET' && path === `${PREFIX}/sessions`) {
          const rawId = url.searchParams.get('workspaceId')
          if (rawId === null || !rawId) throw new RequestError(400, 'invalid_workspaceId')
          const rawIncludeArchived = url.searchParams.get('includeArchived')
          if (rawIncludeArchived !== null && rawIncludeArchived !== '1') throw new RequestError(400, 'invalid_includeArchived')
          for (const key of url.searchParams.keys()) {
            if (key !== 'workspaceId' && key !== 'includeArchived') {
              throw new RequestError(400, `invalid_${key}`)
            }
          }
          const includeArchived = rawIncludeArchived === '1'
          const workspace = ctx.workspaceRegistry.get(WorkspaceId(rawId))
          if (workspace === undefined) throw new RequestError(404, 'workspace_not_found')
          const archivedSet = new Set(ctx.workspaceRegistry.archivedSessionIds)
          const items = (await ctx.sessionController.list({}, new AbortController().signal)).items
          const itemMap = new Map(items.map(item => [item.sessionId, item]))
          const sessions = []
          for (const sessionId of workspace.sessionIds) {
            const isArchived = archivedSet.has(sessionId)
            if (!includeArchived && isArchived) continue
            const item = itemMap.get(sessionId)
            sessions.push({
              sessionId,
              title: item?.projections?.values.title ?? '',
              running: item?.running ?? false,
              updatedAt: item?.updatedAt ?? null,
              archived: isArchived,
            })
          }
          answer(res, 200, { sessions })
        } else if (method === 'GET' && path === `${PREFIX}/activity`) {
          answer(res, 200, {
            attachedClients: 0,
            runningTurns: ctx.agents.list().filter(agent => agent.status === 'running').length,
            approximate: true,
          })
        } else if (method === 'POST' && /^\/gaia\/control\/sessions\/[^/]+\/(rename|archive|unarchive)$/.test(path)) {
          const parts = path.split('/')
          const id = decodeURIComponent(parts[4] ?? '')
          const request = await body(req)
          // Membership comes from the workspace registry: a Session created
          // through this bridge stays out of sessionController.list() until it
          // has content, so the list alone 404s renames of fresh tabs.
          if (!id || !ctx.workspaceRegistry.list().some(workspace => workspace.sessionIds.includes(SessionId(id)))) {
            throw new RequestError(404, 'session_not_found')
          }
          const sessionId = SessionId(id)
          if (parts[5] === 'rename') {
            exactFields(request, ['title'])
            await ctx.sessionController.rename({ sessionId, title: stringField(request, 'title') })
          } else if (parts[5] === 'archive') {
            exactFields(request, [])
            await ctx.workspaceRegistry.archiveSession(sessionId, { stopActivity: true })
          } else {
            exactFields(request, [])
            await ctx.workspaceRegistry.unarchiveSession(sessionId)
          }
          answer(res, 200, { ok: true })
        } else {
          throw new RequestError(404, 'not_found')
        }
      } catch (error) {
        if (res.headersSent) { res.destroy(); return }
        if (error instanceof RequestError) answer(res, error.status, { error: error.code })
        else answer(res, 500, { error: 'internal' })
      }
    },
  }), 'gaia control routes')
}
