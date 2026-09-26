import { describe, expect, it, vi } from 'vitest'
import { seedDefaultRoute, type SeedConfigEditor } from '../src/seed.ts'

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
