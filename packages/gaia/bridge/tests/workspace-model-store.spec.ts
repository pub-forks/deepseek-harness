import { chmod, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceModelStore } from '../src/workspace-model-store.ts'

const directories: string[] = []
afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})
async function file() {
  const directory = await mkdtemp(join(tmpdir(), 'gaia-workspace-model-'))
  directories.push(directory)
  return join(directory, 'models.json')
}
const selected = { provider: 'provider', model: 'model', reasoningEffort: 'high' }

describe('workspace model store', () => {
  it('persists only ids and reloads optional effort with 0600 permissions and no temporary residue', async () => {
    const path = await file()
    const store = new WorkspaceModelStore(path)
    expect(await store.get('/project')).toBeUndefined()
    await store.record('/project', { ...selected, token: 'must-not-persist' } as typeof selected)
    expect(await new WorkspaceModelStore(path).get('/project')).toEqual(selected)
    expect((await stat(path)).mode & 0o777).toBe(0o600)
    const raw = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>
    expect(raw['/project']).toEqual({ ...selected, updatedAt: expect.any(Number) as number })
    expect(await readdir(directories[0]!)).toEqual(['models.json'])
    await chmod(path, 0o644)
    await store.record('/project', { provider: 'other', model: 'plain' })
    expect((await stat(path)).mode & 0o777).toBe(0o600)
    expect(await new WorkspaceModelStore(path).get('/project')).toEqual({ provider: 'other', model: 'plain' })
  })

  it.each(['{broken', 'null', '[]', '42', '{"/p":{"provider":"p","model":"m","updatedAt":"bad"}}'])('treats corrupt/invalid file %s as empty', async (text) => {
    const path = await file()
    await writeFile(path, text)
    const store = new WorkspaceModelStore(path)
    expect(await store.get('/p')).toBeUndefined()
    await store.record('/p', selected)
    expect(await new WorkspaceModelStore(path).get('/p')).toEqual(selected)
  })

  it('serializes simultaneous records and retains the 500 latest entries, including timestamp ties', async () => {
    const path = await file()
    const store = new WorkspaceModelStore(path)
    vi.spyOn(Date, 'now').mockReturnValue(1234)
    await Promise.all(Array.from({ length: 502 }, (_, i) => store.record(`/p${i}`, selected)))
    expect(Object.keys(JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>)).toHaveLength(500)
    expect(await store.get('/p0')).toBeUndefined()
    expect(await new WorkspaceModelStore(path).get('/p501')).toEqual(selected)
    await store.record('/p2', { provider: 'p', model: 'latest' })
    await store.record('/new', selected)
    expect(await store.get('/p3')).toBeUndefined()
    expect(await store.get('/p2')).toEqual({ provider: 'p', model: 'latest' })
  })

  it('bounds a loaded file and strips unknown fields', async () => {
    const path = await file()
    await writeFile(path, JSON.stringify(Object.fromEntries(Array.from({ length: 501 }, (_, i) => [
      `/p${i}`, { ...selected, updatedAt: i, apiKey: 'discard' },
    ]))))
    const store = new WorkspaceModelStore(path)
    expect(await store.get('/p0')).toBeUndefined()
    expect(await store.get('/p500')).toEqual(selected)
  })

  it('keeps in-memory choices and later writes usable after a failed write', async () => {
    const path = await file()
    await writeFile(path, '{}')
    const store = new WorkspaceModelStore(join(path, 'blocked.json'))
    await expect(store.record('/p', selected)).rejects.toThrow()
    expect(await store.get('/p')).toEqual(selected)
    await expect(store.record('/q', selected)).rejects.toThrow()
    await store.flush()
  })
})
