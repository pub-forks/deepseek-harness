import { describe, expect, it } from 'vitest'
import { fileAddressFor } from '@deepseek-ai/dsh-util-workspace-path'
import { lineParam, resolveFileAddress } from '../src/client/open-file.ts'

const cwdOf = (sessionId: string): string | undefined => (sessionId === 's1' ? '/home/u/project/' : undefined)

describe('Gaia embed file opens', () => {
  it('resolves session-relative, session-absolute and absolute file addresses', () => {
    expect(resolveFileAddress('dsh-resource://file/session/s1/src/app.ts', cwdOf)).toBe('/home/u/project/src/app.ts')
    expect(resolveFileAddress('dsh-resource://file/session/s1/%2Fetc%2Fhosts', cwdOf)).toBe('/etc/hosts')
    expect(resolveFileAddress('dsh-resource://file/absolute/home/u/notes.md', cwdOf)).toBe('/home/u/notes.md')
    expect(resolveFileAddress('dsh-resource://file/session/s1/a%20b.txt', cwdOf)).toBe('/home/u/project/a b.txt')
  })

  it('round-trips the addresses DSH builds for chat file links', () => {
    const cwd = '/home/u/project'
    expect(resolveFileAddress(fileAddressFor('s1', cwd, 'docs/readme.md'), cwdOf)).toBe('/home/u/project/docs/readme.md')
    expect(resolveFileAddress(fileAddressFor('s1', cwd, '/home/u/project/src/x.ts'), cwdOf)).toBe('/home/u/project/src/x.ts')
    expect(resolveFileAddress(fileAddressFor('s1', cwd, '/etc/hosts'), cwdOf)).toBe('/etc/hosts')
  })

  it('declines non-file addresses, unknown workspaces and the workspace root', () => {
    expect(resolveFileAddress('dsh-resource://plan/session/s1/x', cwdOf)).toBeUndefined()
    expect(resolveFileAddress('dsh-resource://file/session/other/a.txt', cwdOf)).toBeUndefined()
    expect(resolveFileAddress('dsh-resource://file/session/s1/', cwdOf)).toBeUndefined()
  })

  it('reads only a positive integer line', () => {
    expect(lineParam({ line: 42 })).toBe(42)
    expect(lineParam({ line: 0 })).toBeUndefined()
    expect(lineParam({ line: '3' })).toBeUndefined()
    expect(lineParam(undefined)).toBeUndefined()
  })
})
