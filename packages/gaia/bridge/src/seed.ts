/**
 * One-time seeding of Gaia's default model route into the user's own profile.
 *
 * The `openai-codex` route used to live in Gaia's `--patch` overlay, but an
 * overlay outranks the profile layer that Settings → Models writes, so the
 * whole `llm-pi-ai` row became read-only ("overridden by a home patch or
 * command-line overlay"). The route is now written once into the profile patch
 * through the same config editor the Models screen uses, after which it is the
 * user's to edit or remove.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { ConfigEditor } from '@deepseek-ai/dsh-config-editor'

/** The pi-ai adapter's profile row id. */
export const LLM_PI_AI_ROW = 'llm-pi-ai'
/** Route seeded when the user has configured no pi-ai providers yet. */
export const SEEDED_PROVIDERS = { 'openai-codex': {} } as const

/** The part of `ctx.configEditor` this module uses. */
export type SeedConfigEditor = Pick<ConfigEditor, 'configuration' | 'edit'>

/**
 * Seed the route unless the profile already declares any `providers` for the
 * row (an explicitly emptied map counts as declared, so a user who removed the
 * route does not get it back).
 * @param editor - the config editor service.
 * @returns whether a write happened.
 */
export async function seedDefaultRoute(editor: SeedConfigEditor): Promise<boolean> {
  const row = editor.configuration().find(item => item.entry.options.id === LLM_PI_AI_ROW)
  if (row === undefined) return false
  if (Object.prototype.hasOwnProperty.call(row.override, 'providers')) return false
  await editor.edit(row.entry, (current) => {
    if (Object.prototype.hasOwnProperty.call(current, 'providers')) return current
    return { ...current, providers: { ...SEEDED_PROVIDERS } }
  })
  return true
}

/**
 * Run the seed once the Loader tree has settled; failures only warn.
 * @param ctx - the bridge plugin context.
 */
export function scheduleSeed(ctx: Context): void {
  ctx.inject(['configEditor'], (seedCtx) => {
    const settled = seedCtx.get('loader')?.await() ?? Promise.resolve()
    void settled
      .then(() => seedDefaultRoute(seedCtx.configEditor))
      .catch((error: unknown) => {
        seedCtx.logger('gaia-bridge').warn('could not seed the default model route: %s',
          error instanceof Error ? error.message : String(error))
      })
  })
}
