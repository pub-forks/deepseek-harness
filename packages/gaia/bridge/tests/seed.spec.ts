import { describe, expect, it, vi } from 'vitest'
import { scheduleSeed, seedDefaultRoute, seedSessionLogDisabled, type SeedConfigEditor } from '../src/seed.ts'

type Change = (current: Record<string, unknown>, inherited: Record<string, unknown>) => Record<string, unknown>

function editor(override: Record<string, unknown>, id = 'llm-pi-ai') {
  let written: Record<string, unknown> | undefined
  const entry = { options: { id } }
  const edit = vi.fn((_entry: unknown, change: Change): Promise<void> => {
    written = change({ ...override }, {})
    return Promise.resolve()
  })
  // Loader entries are opaque here; the seed only reads options.id.
  const api = { configuration: () => [{ entry, inherited: {}, override }], edit } as never as SeedConfigEditor
  return { api, edit, written: () => written }
}

describe('seedDefaultRoute', () => {
  it('writes the openai-codex route when the profile declares no providers', async () => {
    const e = editor({ retryPolicy: { mode: 'normal' } })
    expect(await seedDefaultRoute(e.api)).toBe(true)
    expect(e.written()).toEqual({ retryPolicy: { mode: 'normal' }, providers: { 'openai-codex': {} } })
  })

  it('leaves user-configured providers alone, including an emptied map', async () => {
    for (const override of [{ providers: { opencode: { apiKeyEnv: 'X' } } }, { providers: {} }]) {
      const e = editor(override)
      expect(await seedDefaultRoute(e.api)).toBe(false)
      expect(e.edit).not.toHaveBeenCalled()
    }
  })

  it('does nothing when the pi-ai row is not mounted', async () => {
    const e = editor({}, 'something-else')
    expect(await seedDefaultRoute(e.api)).toBe(false)
    expect(e.edit).not.toHaveBeenCalled()
  })
})

describe('seedSessionLogDisabled', () => {
  it('seeds enabled false when unset', async () => {
    const e = editor({ retryPolicy: { mode: 'normal' } }, 'session-log-deepseek')
    expect(await seedSessionLogDisabled(e.api)).toBe(true)
    expect(e.written()).toEqual({ retryPolicy: { mode: 'normal' }, enabled: false })
  })

  it.each([true, false])('leaves explicit enabled %s alone', async (enabled) => {
    const e = editor({ enabled }, 'session-log-deepseek')
    expect(await seedSessionLogDisabled(e.api)).toBe(false)
    expect(e.edit).not.toHaveBeenCalled()
  })

  it('does nothing when the session-log row is not mounted', async () => {
    const e = editor({}, 'something-else')
    expect(await seedSessionLogDisabled(e.api)).toBe(false)
    expect(e.edit).not.toHaveBeenCalled()
  })

  it('writes only once when run twice', async () => {
    let current: Record<string, unknown> = {}
    const entry = { options: { id: 'session-log-deepseek' } }
    const edit = vi.fn((_entry: unknown, change: Change): Promise<void> => {
      current = change(current, {})
      return Promise.resolve()
    })
    const api = { configuration: () => [{ entry, inherited: {}, override: current }], edit } as never as SeedConfigEditor
    expect(await seedSessionLogDisabled(api)).toBe(true)
    expect(await seedSessionLogDisabled(api)).toBe(false)
    expect(edit).toHaveBeenCalledTimes(1)
  })
})

describe('scheduleSeed', () => {
  it('runs session-log seeding when the pi-ai seed fails', async () => {
    let current: Record<string, unknown> = {}
    const piEntry = { options: { id: 'llm-pi-ai' } }
    const logEntry = { options: { id: 'session-log-deepseek' } }
    const edit = vi.fn((entry: typeof piEntry, change: Change): Promise<void> => {
      if (entry === piEntry) return Promise.reject(new Error('pi-ai failure'))
      current = change(current, {})
      return Promise.resolve()
    })
    const warn = vi.fn()
    const configEditor = {
      configuration: () => [
        { entry: piEntry, inherited: {}, override: {} },
        { entry: logEntry, inherited: {}, override: current },
      ],
      edit,
    } as never as SeedConfigEditor
    const ctx = {
      inject: (_names: string[], callback: (value: never) => void) => {
        callback({
          configEditor,
          get: () => ({ await: () => Promise.resolve() }),
          logger: () => ({ warn }),
        } as never)
      },
    } as never
    scheduleSeed(ctx)
    await vi.waitFor(() => {
      expect(current).toEqual({ enabled: false })
    })
    expect(warn).toHaveBeenCalledWith('could not seed the default model route: %s', 'pi-ai failure')
  })
})
