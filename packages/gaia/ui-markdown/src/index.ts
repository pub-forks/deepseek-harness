/** Host entry for the Gaia Markdown document preview plugin. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-fs'
import { FsVersion } from '@deepseek-ai/dsh-fs'
import type { WorkspaceFileScope } from '@deepseek-ai/dsh-api-workspace-files'
import type {} from '@deepseek-ai/dsh-sandbox-policy'
import type {} from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-session-persistence'
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type {} from './types.ts'
import type { GaiaTasksWriteResult } from './types.ts'

/** Host Remote for edits to existing `.tasks` files inside the Session workspace. */
export class GaiaTasks extends TypertRemoteService {
  static inject = ['fs', 'sandboxPolicy', 'sessions']

  /** @param ctx - Host context providing filesystem and session sandbox policy. */
  constructor(ctx: Context) { super(ctx, 'gaiaTasks') }

  /** Replace an existing valid task document with a version-guarded write.
   * @param workspaceFileScope - Session workspace resolved by `workspaceFiles`.
   * @param path - absolute or workspace-relative `.tasks` path.
   * @param content - complete UTF-8 JSON text.
   * @param expectedVersion - version returned by the preview read.
   * @param signal - caller cancellation.
   * @returns the new opaque file version.
   */
  @Remote
  async write(
    workspaceFileScope: WorkspaceFileScope,
    path: string,
    content: string,
    expectedVersion: string,
    signal: AbortSignal,
  ): Promise<GaiaTasksWriteResult> {
    if (!path.endsWith('.tasks')) {
      throw new RemoteError('gaia-tasks/invalid-extension', 'Task files must use the .tasks extension', { path })
    }
    if (Buffer.byteLength(content, 'utf8') > 20 * 1024 * 1024) {
      throw new RemoteError('gaia-tasks/too-large', 'Task file exceeds the 20 MiB limit', { path, limit: 20 * 1024 * 1024 })
    }
    let parsed: unknown
    try { parsed = JSON.parse(content) }
    catch (cause) { throw new RemoteError('gaia-tasks/invalid-content', 'Task file must be a JSON object with a tasks array', {}, { cause }) }
    if (!isRecord(parsed) || !Array.isArray(parsed.tasks)) {
      throw new RemoteError('gaia-tasks/invalid-content', 'Task file must be a JSON object with a tasks array', {})
    }

    const { workspaceRoot } = workspaceFileScope
    const root = await this.ctx.fs.resolve(workspaceRoot, { signal })
    const entry = await this.ctx.fs.lstat(path, { cwd: workspaceRoot }, signal)
    if (entry === undefined) throw new RemoteError('gaia-tasks/not-found', 'Task file does not exist', { path })
    if (entry.type !== 'file') throw new RemoteError('gaia-tasks/not-regular-file', 'Task target must be a regular file', { path })
    const target = await this.ctx.fs.resolve(path, { cwd: workspaceRoot, signal })
    if (!this.ctx.fs.contains(root, target)) {
      throw new RemoteError('gaia-tasks/outside-workspace', 'Task file must be inside the Session workspace', { path })
    }
    const info = await this.ctx.fs.stat(target, signal)
    if (info === undefined) throw new RemoteError('gaia-tasks/not-found', 'Task file does not exist', { path })
    if (info.type !== 'file') throw new RemoteError('gaia-tasks/not-regular-file', 'Task target must be a regular file', { path })

    const session = this.ctx.sessions.get(workspaceFileScope.sessionId)
    const policy = this.ctx.sandboxPolicy.resolve(session === undefined ? {} : { session })
    const sandboxPolicy = session === undefined ? { ...policy, workspaceRoot } : policy
    try {
      const outcome = await this.ctx.fs.writeText(
        target,
        content,
        { kind: 'replaceIfVersion', version: FsVersion(expectedVersion) },
        signal,
        sandboxPolicy,
      )
      return { version: outcome.version }
    } catch (error: unknown) {
      if (isFsCode(error, 'FS_STALE_VERSION')) {
        throw new RemoteError('gaia-tasks/stale', 'Task file changed since it was read', { path }, { cause: error })
      }
      throw error
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFsCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code
}

/** Register the Host Remote with plugin lifetime. */
export function apply(ctx: Context): void {
  ctx.inject(['fs', 'sandboxPolicy', 'sessions'], (host) => { new GaiaTasks(host) })
}
