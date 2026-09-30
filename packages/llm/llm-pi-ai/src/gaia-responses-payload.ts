/**
 * GAIA: request-body tuning for the OpenAI Responses protocols.
 *
 * pi-ai hard-codes `reasoning.summary: "auto"` on every Responses request and
 * `text.verbosity: "low"` on the Codex route only, and its `streamSimple`
 * exposes neither option. A profile may override both; the adapter applies
 * them through the request-level `onPayload` hook instead of patching pi-ai.
 * Both are opt-in: a live A/B on the Codex backend (gpt-6-luna, 2026-09-30)
 * showed `detailed` summaries no richer than `auto`, so pi-ai's request is
 * left untouched unless configured.
 *
 * @module dsh-llm-pi-ai/gaia-responses-payload
 */

import type { Api } from '@earendil-works/pi-ai'

/** Reasoning-summary detail the Responses APIs accept. */
export type ReasoningSummary = 'auto' | 'concise' | 'detailed'

/** Answer-length hint the Responses APIs accept. */
export type TextVerbosity = 'low' | 'medium' | 'high'

/** Accepted {@link ReasoningSummary} values, for the profile schema. */
export const REASONING_SUMMARIES = ['auto', 'concise', 'detailed'] as const

/** Accepted {@link TextVerbosity} values, for the profile schema. */
export const TEXT_VERBOSITIES = ['low', 'medium', 'high'] as const

const RESPONSES_APIS: ReadonlySet<string> = new Set([
  'openai-responses',
  'openai-codex-responses',
  'azure-openai-responses',
])

/** The profile fields this tuning reads. */
export interface ResponsesPayloadTuning {
  reasoningSummary?: ReasoningSummary
  textVerbosity?: TextVerbosity
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Build the `onPayload` hook for one request, or none when the protocol is not
 * a Responses API or the profile configures nothing.
 * @param api - the resolved model's pi-ai protocol.
 * @param tuning - the route profile's summary and verbosity settings.
 * @returns a hook returning a tuned copy of the body, or undefined.
 */
export function responsesPayloadHook(
  api: Api,
  tuning: ResponsesPayloadTuning,
): ((payload: unknown) => unknown) | undefined {
  const { reasoningSummary: summary, textVerbosity: verbosity } = tuning
  if (!RESPONSES_APIS.has(api) || (summary === undefined && verbosity === undefined)) return undefined
  return (payload: unknown): unknown => {
    if (!isRecord(payload)) return undefined
    const next: Record<string, unknown> = { ...payload }
    const reasoning = payload['reasoning']
    // Only a request that actually reasons carries a summary: `effort: "none"`
    // (reasoning off) rejects one, and a non-reasoning model has no block.
    if (summary !== undefined && isRecord(reasoning) && typeof reasoning['effort'] === 'string' && reasoning['effort'] !== 'none') {
      next['reasoning'] = { ...reasoning, summary }
    }
    if (verbosity !== undefined) {
      next['text'] = { ...isRecord(payload['text']) ? payload['text'] : {}, verbosity }
    }
    return next
  }
}
