/** Gaia's loopback-only, bearer-authenticated Host control API. */
import { createHash, timingSafeEqual } from 'node:crypto'
import { lstat, realpath, stat } from 'node:fs/promises'
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
import {
  MAX_PROFILE_FILE_BYTES, PROFILE_FILE_NAMES, profileFilePath, readProfileText, sha256, validateProfileText,
  writeProfileTextIfSha,
} from './profile-files.ts'
import { scheduleSeed } from './seed.ts'

const PREFIX = '/gaia/control'
const MAX_BODY = 16 * 1024
const MAX_DOCUMENT_BODY = 1_310_720

/** Cordis plugin identity. */
export const name = 'gaia-bridge'
/** The Host services used by the bridge. */
export const inject = ['webServer', 'workspaceRegistry', 'sessionController', 'sessions', 'agents', 'sessionTitle']

/**
 * Compare a submitted token with the activation-time secret in constant time.
 * @param header - Authorization header supplied by the caller.
 * @param secret - activation-time control secret.
 * @returns whether the header contains the matching bearer token.
 */
export function validBearer(header: string | undefined, secret: string): boolean {
  if (header === undefined || !header.startsWith('Bearer ')) return false
  const supplied = header.slice(7)
  const left = createHash('sha256').update(supplied).digest()
  const right = createHash('sha256').update(secret).digest()
  return timingSafeEqual(left, right)
}

/**
 * Accept only an IP loopback peer, including IPv4-mapped IPv6.
 * @param address - socket peer address.
 * @returns whether the peer address is loopback.
 */
export function isLoopbackPeer(address: string | undefined): boolean {
  if (address === undefined) return false
  const value = address.startsWith('::ffff:') ? address.slice(7) : address
  return value === '::1' || (isIP(value) === 4 && value.startsWith('127.'))
}

class RequestError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code) }
}

class StructuredRequestError extends Error {
  constructor(readonly status: number, readonly value: object) { super('control request failed') }
}

function answer(res: ServerResponse, status: number, value: object): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(value))
}

async function body(req: IncomingMessage, limit = MAX_BODY): Promise<Record<string, unknown>> {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')) {
    throw new RequestError(400, 'invalid_content_type')
  }
  const declared = Number(req.headers['content-length'])
  if (Number.isFinite(declared) && declared > limit) throw new RequestError(413, 'body_too_large')
  let size = 0
  const parts: Uint8Array[] = []
  for await (const chunk of req) {
    const bytes = chunk as Uint8Array
    size += bytes.byteLength
    if (size > limit) throw new RequestError(413, 'body_too_large')
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

/** Match client-connection's assertTrustedAuthority without a runtime package dependency. */
function isOperatorAuthority(entry: string): boolean {
  if (entry.includes('*')) return false
  let url: URL
  try { url = new URL(`http://${entry}`) }
  catch (error) { return false /* Invalid authorities are warned about by apply. */ }
  const port = url.port !== '' ? url.port : new URL(`https://${entry}`).port
  const canonical = port === '' ? url.hostname : `${url.hostname}:${port}`
  return canonical === entry.toLowerCase()
}

/** Register the control API for the life of the plugin.
 * @param ctx - Host context providing the web server.
 * @returns no value; route resources are disposed with the plugin.
 */
export function apply(ctx: Context): void {
  scheduleSeed(ctx)
  const hosts: string[] = []
  for (const value of (process.env.GAIA_OPERATOR_HOSTS ?? '').split(',')) {
    const entry = value.trim()
    if (!entry) continue
    if (isOperatorAuthority(entry)) hosts.push(entry)
    else ctx.logger('gaia-bridge').warn(`Dropping invalid GAIA_OPERATOR_HOSTS entry ${JSON.stringify(entry)}`)
  }
  if (hosts.length > 0) {
    ctx.on('webserver/index-inject', (table) => {
      table.push({ kind: 'global', name: '__DSH_OPERATOR_HOSTS__', value: hosts })
    })
  }
  const secret = process.env.GAIA_CONTROL_SECRET
  // GAIA: configEditor is optional here (seed.ts injects it the same way), and
  // Cordis refuses undeclared `ctx.configEditor` property access, so read it
  // through `ctx.get` and answer 503 while it is not mounted.
  const documentPath = (): string => {
    const editor = ctx.get('configEditor')
    if (editor === undefined) throw new StructuredRequestError(503, { error: { code: 'config_editor_unavailable' } })
    return editor.documentPath
  }
  if (secret === undefined || secret.length < 32) {
    ctx.logger('gaia-bridge').warn('GAIA_CONTROL_SECRET is missing or too short; control API unavailable')
  }
  ctx.effect(() => {
    const disposeRoutes = ctx.webServer.register({
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
          } else if (method === 'GET' && path === `${PREFIX}/config-document`) {
            const docPath = documentPath()
            const text = await readProfileText(docPath)
            answer(res, 200, { path: docPath, text, sha256: sha256(text) })
          } else if (method === 'PUT' && path === `${PREFIX}/config-document`) {
            const request = await body(req, MAX_DOCUMENT_BODY)
            exactFields(request, ['text', 'expectedSha256'])
            if (typeof request.text !== 'string' || typeof request.expectedSha256 !== 'string') {
              throw new StructuredRequestError(400, { error: { code: 'invalid_body' } })
            }
            if (Buffer.byteLength(request.text) > MAX_PROFILE_FILE_BYTES) {
              throw new StructuredRequestError(413, { error: { code: 'file_too_large' } })
            }
            const current = await readProfileText(documentPath())
            const currentHash = sha256(current)
            if (currentHash !== request.expectedSha256) {
              throw new StructuredRequestError(409, { error: { code: 'conflict' }, sha256: currentHash })
            }
            try { validateProfileText('cordis.patch.yml', request.text) }
            catch (error) {
              throw new StructuredRequestError(422, {
                error: { code: 'invalid_yaml', message: error instanceof Error ? error.message : 'Invalid YAML' },
              })
            }
            const saved = await writeProfileTextIfSha(documentPath(), request.expectedSha256, request.text)
            if (!saved.written) throw new StructuredRequestError(409, { error: { code: 'conflict' }, sha256: saved.sha256 })
            answer(res, 200, { sha256: saved.sha256 })
          } else if (method === 'GET' && path === `${PREFIX}/profile-files`) {
            const files = []
            for (const name of PROFILE_FILE_NAMES) {
              const filePath = profileFilePath(documentPath(), name)
              try {
                const fileStat = await lstat(filePath)
                if (fileStat.isSymbolicLink() || !fileStat.isFile()) continue
                const text = await readProfileText(filePath)
                files.push({ name, size: fileStat.size, sha256: sha256(text) })
              } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
              }
            }
            answer(res, 200, { files })
          } else if (/^\/gaia\/control\/profile-files\/[^/]+$/.test(path)) {
            const rawName = path.slice(`${PREFIX}/profile-files/`.length)
            let name: string
            try { name = decodeURIComponent(rawName) }
            catch { throw new RequestError(404, 'not_found') }
            if (!(PROFILE_FILE_NAMES as readonly string[]).includes(name)) throw new RequestError(404, 'not_found')
            const filePath = profileFilePath(documentPath(), name)
            if (method === 'GET') {
              const text = await readProfileText(filePath)
              answer(res, 200, { name, text, sha256: sha256(text) })
            } else if (method === 'PUT') {
              const request = await body(req, MAX_DOCUMENT_BODY)
              exactFields(request, ['text', 'expectedSha256'])
              if (typeof request.text !== 'string' || typeof request.expectedSha256 !== 'string') {
                throw new StructuredRequestError(400, { error: { code: 'invalid_body' } })
              }
              if (Buffer.byteLength(request.text) > MAX_PROFILE_FILE_BYTES) {
                throw new StructuredRequestError(413, { error: { code: 'file_too_large' } })
              }
              const current = await readProfileText(filePath)
              const currentHash = sha256(current)
              if (currentHash !== request.expectedSha256) {
                throw new StructuredRequestError(409, { error: { code: 'conflict' }, sha256: currentHash })
              }
              try { validateProfileText(name, request.text) }
              catch (error) {
                const yaml = name.endsWith('.yml') || name.endsWith('.yaml')
                throw new StructuredRequestError(422, {
                  error: {
                    code: yaml ? 'invalid_yaml' : 'invalid_json',
                    message: error instanceof Error ? error.message : 'Invalid document',
                  },
                })
              }
              const saved = await writeProfileTextIfSha(filePath, request.expectedSha256, request.text)
              if (!saved.written) throw new StructuredRequestError(409, { error: { code: 'conflict' }, sha256: saved.sha256 })
              answer(res, 200, { sha256: saved.sha256 })
            } else {
              throw new RequestError(404, 'not_found')
            }
          } else if (method === 'POST' && path === `${PREFIX}/workspaces/ensure`) {
            const request = await body(req)
            exactFields(request, ['path', 'title'])
            const requested = stringField(request, 'path')
            if (!isAbsolute(requested)) throw new RequestError(400, 'invalid_path')
            let canonical: string
            try {
              canonical = await realpath(requested)
              if (!(await stat(canonical)).isDirectory()) throw new RequestError(400, 'invalid_path')
            } catch {
              throw new RequestError(400, 'invalid_path')
            }
            const title = request.title === undefined ? undefined : stringField(request, 'title').trim()
            if (title !== undefined && title.length > 120) throw new RequestError(400, 'invalid_title')
            const workspace = await ctx.workspaceRegistry.create(canonical, title)
            answer(res, 200, { workspaceId: workspace.id })
          } else if (method === 'GET' && path === `${PREFIX}/workspaces`) {
            if ([...url.searchParams.keys()].length > 0) throw new RequestError(400, 'invalid_query')
            const workspaces = await Promise.all(ctx.workspaceRegistry.list().map(async workspace => ({
              id: workspace.id, path: workspace.path, title: workspace.title,
              createdAt: workspace.createdAt, status: await workspace.status(),
            })))
            answer(res, 200, { workspaces })
          } else if (method === 'POST' && path === `${PREFIX}/workspaces/rename`) {
            const request = await body(req)
            exactFields(request, ['workspaceId', 'title'])
            const workspaceId = WorkspaceId(stringField(request, 'workspaceId'))
            const title = stringField(request, 'title').trim()
            if (title.length > 120) throw new RequestError(400, 'invalid_title')
            const workspace = ctx.workspaceRegistry.get(workspaceId)
            if (workspace === undefined) throw new RequestError(404, 'workspace_not_found')
            await workspace.setTitle(title)
            answer(res, 200, { ok: true })
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
          if (error instanceof StructuredRequestError) answer(res, error.status, error.value)
          else if (error instanceof RequestError) answer(res, error.status, { error: error.code })
          else answer(res, 500, { error: 'internal' })
        }
      },
    })
    return () => {
      disposeRoutes()
    }
  }, 'gaia control routes')
}
