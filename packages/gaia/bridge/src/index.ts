/** Gaia's loopback-only, bearer-authenticated Host control API. */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { lstat, realpath, stat } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { isIP } from 'node:net'
import { isAbsolute } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { getDshRuntimeVersion } from '@deepseek-ai/dsh-app-boot'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import type {} from '@deepseek-ai/dsh-api-gateway'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-api-session-controller'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-session-title'
import type {} from '@deepseek-ai/dsh-config-editor'
import { allowedRemoteKind } from './allowlist.ts'
import {
  MAX_PROFILE_FILE_BYTES, PROFILE_FILE_NAMES, profileFilePath, readProfileText, sha256, validateProfileText,
  writeProfileTextIfSha,
} from './profile-files.ts'
import { scheduleSeed } from './seed.ts'

const PREFIX = '/gaia/control'
const MAX_BODY = 16 * 1024
const MAX_REMOTE_BODY = 256 * 1024
const MAX_DOCUMENT_BODY = 1_310_720
const MAX_STREAMS = 8
const MAX_STREAM_ITEMS = 500
const MAX_STREAM_BYTES = 1024 * 1024
const STREAM_IDLE_MS = 5 * 60 * 1000
const STREAM_POLL_MS = 25_000

/** Cordis plugin identity. */
export const name = 'gaia-bridge'
/** The Host services used by the bridge. */
export const inject = ['webServer', 'workspaceRegistry', 'sessionController', 'sessions', 'agents', 'sessionTitle', 'typertGateway']

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

interface StreamFailure {
  readonly code: string
  readonly message: string
}

interface BufferedStream {
  readonly controller: AbortController
  readonly items: unknown[]
  readonly waiters: Set<() => void>
  bytes: number
  done: boolean
  error?: StreamFailure
  idleTimer: NodeJS.Timeout
}

function failureOf(error: unknown): StreamFailure {
  if (typeof error === 'object' && error !== null) {
    const value = error as { code?: unknown; message?: unknown; isDSHRemoteError?: unknown }
    if (typeof value.code === 'string') {
      return { code: value.code, message: typeof value.message === 'string' ? value.message : 'Remote call failed' }
    }
  }
  return { code: 'internal', message: 'Remote call failed' }
}

function remoteFailureStatus(error: unknown, failure: StreamFailure): number {
  if (failure.code.startsWith('gateway/')) {
    if (['gateway/arguments-invalid', 'gateway/input-invalid', 'gateway/signature-invalid', 'gateway/protocol'].includes(failure.code)) {
      return 400
    }
    if (['gateway/context-not-found', 'gateway/lookup-not-found', 'gateway/method-unavailable'].includes(failure.code)) return 404
    if (failure.code === 'gateway/service-unavailable') return 503
    return 502
  }
  if (typeof error === 'object' && error !== null && (error as { isDSHRemoteError?: unknown }).isDSHRemoteError === true) {
    return 400
  }
  return 502
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function notifyStream(stream: BufferedStream): void {
  for (const wake of stream.waiters) wake()
  stream.waiters.clear()
}

function finishStream(stream: BufferedStream, error?: StreamFailure): void {
  if (stream.done) return
  stream.done = true
  if (error !== undefined) stream.error = error
  notifyStream(stream)
}

function resetIdleTimer(id: string, stream: BufferedStream, streams: Map<string, BufferedStream>): void {
  clearTimeout(stream.idleTimer)
  stream.idleTimer = setTimeout(() => {
    stream.controller.abort()
    streams.delete(id)
    notifyStream(stream)
  }, STREAM_IDLE_MS)
  stream.idleTimer.unref()
}

async function pollStream(stream: BufferedStream, after: number): Promise<void> {
  if (stream.items.length > after || stream.done) return
  await new Promise<void>((resolve) => {
    let settled = false
    const finish = (): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      stream.waiters.delete(finish)
      resolve()
    }
    const timer = setTimeout(finish, STREAM_POLL_MS)
    timer.unref()
    stream.waiters.add(finish)
  })
}

async function consumeStream(
  source: AsyncIterable<unknown>,
  stream: BufferedStream,
): Promise<void> {
  try {
    for await (const item of source) {
      if (stream.controller.signal.aborted) break
      let serialized: string
      try { serialized = item === undefined ? 'null' : JSON.stringify(item) }
      catch { finishStream(stream, { code: 'stream_overflow', message: 'Stream item is not serializable' }); break }
      const bytes = Buffer.byteLength(serialized) + (stream.items.length === 0 ? 0 : 1)
      if (stream.items.length >= MAX_STREAM_ITEMS || stream.bytes + bytes > MAX_STREAM_BYTES) {
        stream.controller.abort()
        finishStream(stream, { code: 'stream_overflow', message: 'Stream buffer limit exceeded' })
        break
      }
      stream.items.push(item)
      stream.bytes += bytes
      notifyStream(stream)
    }
    finishStream(stream)
  } catch (error) {
    if (!stream.controller.signal.aborted) finishStream(stream, failureOf(error))
    else finishStream(stream)
  }
}

/** Register the control API for the life of the plugin.
 * @param ctx - Host context providing the web server and Remote gateway.
 * @returns no value; route and stream resources are disposed with the plugin.
 */
export function apply(ctx: Context): void {
  scheduleSeed(ctx)
  const secret = process.env.GAIA_CONTROL_SECRET
  const streams = new Map<string, BufferedStream>()
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
          } else if (method === 'POST' && (path === `${PREFIX}/remote` || path === `${PREFIX}/streams`)) {
            const request = await body(req, MAX_REMOTE_BODY)
            exactFields(request, ['namespace', 'method', 'args'])
            const namespace = stringField(request, 'namespace')
            const remoteMethod = stringField(request, 'method')
            const kind = allowedRemoteKind(namespace, remoteMethod)
            if (kind === undefined) throw new StructuredRequestError(404, { error: { code: 'not_allowed' } })
            const streamRequest = path === `${PREFIX}/streams`
            if ((streamRequest && kind !== 'stream') || (!streamRequest && kind !== 'unary')) {
              throw new StructuredRequestError(400, { error: { code: 'kind_mismatch', message: `Remote method is ${kind}` } })
            }
            if (!isRecord(request.args)) {
              throw new StructuredRequestError(400, { error: { code: 'invalid_args', message: 'args must be an object' } })
            }
            if (!streamRequest) {
              try {
                const result = await ctx.typertGateway.invoke({ namespace, method: remoteMethod, args: request.args })
                answer(res, 200, { result })
              } catch (error) {
                const failure = failureOf(error)
                throw new StructuredRequestError(remoteFailureStatus(error, failure), { error: failure })
              }
            } else {
              if (streams.size >= MAX_STREAMS) throw new StructuredRequestError(409, { error: { code: 'too_many_streams' } })
              const controller = new AbortController()
              try {
                const source = await ctx.typertGateway.stream({
                  namespace, method: remoteMethod, args: request.args, signal: controller.signal,
                })
                const id = randomBytes(16).toString('hex')
                const stream: BufferedStream = {
                  controller, items: [], waiters: new Set(), bytes: 2, done: false,
                  idleTimer: setTimeout(() => {}, STREAM_IDLE_MS),
                }
                stream.idleTimer.unref()
                streams.set(id, stream)
                resetIdleTimer(id, stream, streams)
                void consumeStream(source, stream)
                answer(res, 200, { streamId: id })
              } catch (error) {
                controller.abort()
                const failure = failureOf(error)
                throw new StructuredRequestError(remoteFailureStatus(error, failure), { error: failure })
              }
            }
          } else if (method === 'GET' && path === `${PREFIX}/config-document`) {
            const docPath = ctx.configEditor.documentPath
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
            const current = await readProfileText(ctx.configEditor.documentPath)
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
            const saved = await writeProfileTextIfSha(ctx.configEditor.documentPath, request.expectedSha256, request.text)
            if (!saved.written) throw new StructuredRequestError(409, { error: { code: 'conflict' }, sha256: saved.sha256 })
            answer(res, 200, { sha256: saved.sha256 })
          } else if (method === 'GET' && path === `${PREFIX}/profile-files`) {
            const files = []
            for (const name of PROFILE_FILE_NAMES) {
              const filePath = profileFilePath(ctx.configEditor.documentPath, name)
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
            const filePath = profileFilePath(ctx.configEditor.documentPath, name)
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
          } else if (method === 'GET' && /^\/gaia\/control\/streams\/[0-9a-f]{32}$/.test(path)) {
            for (const key of url.searchParams.keys()) if (key !== 'after') throw new RequestError(400, `invalid_${key}`)
            const rawAfter = url.searchParams.get('after') ?? '0'
            const after = Number(rawAfter)
            if (!Number.isSafeInteger(after) || after < 0) throw new RequestError(400, 'invalid_after')
            const id = path.slice(`${PREFIX}/streams/`.length)
            const stream = streams.get(id)
            if (stream === undefined) throw new RequestError(404, 'stream_not_found')
            resetIdleTimer(id, stream, streams)
            await pollStream(stream, after)
            const items = stream.items.slice(after)
            const response: { items: unknown[]; next: number; done: boolean; error?: StreamFailure } = {
              items, next: after + items.length, done: stream.done,
            }
            if (stream.error !== undefined) response.error = stream.error
            answer(res, 200, response)
          } else if (method === 'DELETE' && /^\/gaia\/control\/streams\/[0-9a-f]{32}$/.test(path)) {
            const id = path.slice(`${PREFIX}/streams/`.length)
            const stream = streams.get(id)
            if (stream === undefined) throw new RequestError(404, 'stream_not_found')
            stream.controller.abort()
            clearTimeout(stream.idleTimer)
            streams.delete(id)
            finishStream(stream)
            answer(res, 200, { ok: true })
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
          if (error instanceof StructuredRequestError) answer(res, error.status, error.value)
          else if (error instanceof RequestError) answer(res, error.status, { error: error.code })
          else answer(res, 500, { error: 'internal' })
        }
      },
    })
    return () => {
      disposeRoutes()
      for (const [id, stream] of streams) {
        clearTimeout(stream.idleTimer)
        stream.controller.abort()
        finishStream(stream)
        streams.delete(id)
      }
    }
  }, 'gaia control routes')
}
