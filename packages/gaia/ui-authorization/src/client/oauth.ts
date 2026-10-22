/**
 * GAIA: OAuth flow evaluation helpers.
 *
 * A provider row is OAuth iff its flow (key `llm-pi-ai/<provider id>`)
 * has a method with id 'oauth' AND accountApiKey !== true AND (signedIn === true OR accountAlias === true).
 * A catalog provider that supports OAuth but is configured with an API key must NOT get the tag.
 */
import type { FlowView } from '@deepseek-ai/dsh-gaia-api-authorization/types'

/**
 * Check whether a flow represents an OAuth-connected provider.
 * @param flow - authorization flow to inspect.
 * @returns whether the flow is an active OAuth sign-in.
 */
export function isOAuthFlow(flow: FlowView): boolean {
  return (
    flow.methods.some(m => m.id === 'oauth')
    && flow.accountApiKey !== true
    && (flow.signedIn || flow.accountAlias === true)
  )
}

/**
 * Determine the authentication kind for a provider from authorization flows.
 * @param provider - route identifier.
 * @param flows - registered flow metadata.
 * @returns OAuth, API-key, or no recognized authentication.
 */
export function determineFlowAuthKind(
  provider: string,
  flows: readonly FlowView[],
): 'oauth' | 'api-key' | undefined {
  const flow = flows.find(f => f.key === `llm-pi-ai/${provider}` || f.key === provider)
  if (flow === undefined) return undefined
  return isOAuthFlow(flow) ? 'oauth' : 'api-key'
}
