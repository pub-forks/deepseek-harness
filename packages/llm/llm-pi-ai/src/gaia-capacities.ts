// GAIA: capacity table for GPT-6 models replacing catalog patch hunks.
// Codex backend caps requests at max_context_window 872,000 (verified via `codex debug models`
// in codex-cli 0.159.2). The openai (API-key) route also uses 872,000 per user decision to avoid
// higher billing tiers and premature compaction delay. Dropped when pi-ai ships 872,000 upstream.

import type { Api, Model } from '@earendil-works/pi-ai'

export const GAIA_MODEL_CAPACITIES: Readonly<Record<string, Readonly<Record<string, number>>>> = Object.freeze({
  'openai-codex': Object.freeze({
    'gpt-6-sol': 872_000,
    'gpt-6-luna': 872_000,
    'gpt-6-astra': 872_000,
    'gpt-6.1-sol': 872_000,
  }),
  'openai': Object.freeze({
    'gpt-6-sol': 872_000,
    'gpt-6-luna': 872_000,
    'gpt-6-astra': 872_000,
    'gpt-6.1-sol': 872_000,
  }),
})

/**
 * Apply Gaia capacity overrides to catalog models.
 * For a listed id present in the catalog, returns a shallow copy with overridden contextWindow.
 * Ids absent from the catalog are skipped silently. pi-ai's objects are never mutated.
 */
export function applyGaiaCapacities<T extends Model<Api>>(provider: string, models: readonly T[]): T[] {
  const overrides = GAIA_MODEL_CAPACITIES[provider]
  if (overrides === undefined) return [...models]
  return models.map((model) => {
    const contextWindow = overrides[model.id]
    if (contextWindow !== undefined) {
      return { ...model, contextWindow }
    }
    return model
  })
}
