import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { LocalFileSystem } from '@deepseek-ai/dsh-fs-local'
import { FsVersion } from '@deepseek-ai/dsh-fs'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { remoteErrorOf } from '@deepseek-ai/dsh-typert-protocol'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GaiaTasks } from '../src/index.ts'

const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })

async function fixture() {
  const base = await mkdtemp(join(tmpdir(), 'gaia-tasks-'))
  roots.push(base)
  const workspace = join(base, 'workspace')
  const outside = join(base, 'outside')
  await mkdir(workspace); await mkdir(outside)
  const file = join(workspace, 'list.tasks')
  await writeFile(file, '{"tasks":[]}')
  const ctx = new Context()
  const filesystem = await ctx.plugin(LocalFileSystem, { cwd: workspace })
  const policy = { mode: 'workspace-write', workspaceRoot: workspace }
  const resolve = vi.fn(() => policy)
  ctx.provide('sandboxPolicy', { workspaceRoot: workspace, resolve } as never)
  ctx.provide('sessions', { get: () => undefined } as never)
  const remote = new GaiaTasks(ctx)
  return { ctx, remote, file, outside, workspace, resolve, dispose: async () => { await filesystem.dispose() } }
}

const scope = { sessionId: SessionId('task-session'), workspaceRoot: '' }
const signal = new AbortController().signal
const content = '{"version":1,"tasks":[]}'

async function failure(promise: Promise<unknown>): Promise<string> {
  try { await promise } catch (error: unknown) {
    const remote = remoteErrorOf(error)
    if (remote !== undefined) return remote.code
    throw error
  }
  throw new Error('expected rejection')
}

describe('Gaia Tasks Remote', () => {
  it('refuses non-task paths, outside targets, missing files, invalid JSON, and oversized content', async () => {
    const f = await fixture()
    const localScope = { ...scope, workspaceRoot: f.workspace }
    expect(await failure(f.remote.write(localScope, join(f.workspace, 'other.txt'), content, 'v', signal))).toBe('gaia-tasks/invalid-extension')
    await writeFile(join(f.outside, 'outside.tasks'), content)
    expect(await failure(f.remote.write(localScope, join(f.outside, 'outside.tasks'), content, 'v', signal))).toBe('gaia-tasks/outside-workspace')
    expect(await failure(f.remote.write(localScope, join(f.workspace, 'missing.tasks'), content, 'v', signal))).toBe('gaia-tasks/not-found')
    await mkdir(join(f.workspace, 'folder.tasks'))
    expect(await failure(f.remote.write(localScope, join(f.workspace, 'folder.tasks'), content, 'v', signal))).toBe('gaia-tasks/not-regular-file')
    expect(await failure(f.remote.write(localScope, f.file, '{bad', 'v', signal))).toBe('gaia-tasks/invalid-content')
    expect(await failure(f.remote.write(localScope, f.file, ' '.repeat(20 * 1024 * 1024 + 1), 'v', signal))).toBe('gaia-tasks/too-large')
    await f.dispose()
  })

  it('maps stale versions and passes the expected version and session sandbox policy', async () => {
    const f = await fixture()
    const localScope = { ...scope, workspaceRoot: f.workspace }
    const writeText = vi.spyOn(f.ctx.fs, 'writeText').mockRejectedValue(Object.assign(new Error('stale'), { code: 'FS_STALE_VERSION' }))
    expect(await failure(f.remote.write(localScope, f.file, content, 'expected-v', signal))).toBe('gaia-tasks/stale')
    expect(writeText).toHaveBeenCalledWith(
      expect.objectContaining({ displayPath: f.file }), content,
      { kind: 'replaceIfVersion', version: FsVersion('expected-v') }, signal, expect.objectContaining({ mode: 'workspace-write', workspaceRoot: f.workspace }),
    )
    expect(f.resolve).toHaveBeenCalledWith({})
    await f.dispose()
  })

  it('returns the new version after a successful guarded write', async () => {
    const f = await fixture()
    const target = await f.ctx.fs.resolve(f.file)
    const before = await f.ctx.fs.stat(target, signal)
    if (before === undefined) throw new Error('fixture task file is missing')
    const result = await f.remote.write({ ...scope, workspaceRoot: f.workspace }, f.file, content, before.version, signal)
    expect(result.version).not.toBe(before.version)
    await f.dispose()
  })
})
