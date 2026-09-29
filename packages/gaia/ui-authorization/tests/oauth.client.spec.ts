import { describe, expect, it } from 'vitest'
import { credentialKey } from '@deepseek-ai/dsh-credentials'
import type { FlowView } from '../../api-authorization/src/types.ts'
import { determineFlowAuthKind, isOAuthFlow } from '../src/client/oauth.ts'

describe('isOAuthFlow', () => {
  it('identifies OAuth-connected catalog providers and aliases per Rule 3', () => {
    // 1. Catalog provider signed in via OAuth
    const codexSignedIn: FlowView = {
      key: credentialKey('llm-pi-ai', 'openai-codex'),
      label: 'OpenAI Codex',
      methods: [{ id: 'oauth', label: 'OAuth' }],
      inFlight: false,
      signedIn: true,
    }
    expect(isOAuthFlow(codexSignedIn)).toBe(true)

    // 2. Catalog provider supporting OAuth but NOT signed in via OAuth (e.g. configured with API key)
    const codexNotSignedIn: FlowView = {
      key: credentialKey('llm-pi-ai', 'openai-codex'),
      label: 'OpenAI Codex',
      methods: [{ id: 'oauth', label: 'OAuth' }],
      inFlight: false,
      signedIn: false,
    }
    expect(isOAuthFlow(codexNotSignedIn)).toBe(false)

    // 3. Catalog provider with API-key sign-in method
    const openai: FlowView = {
      key: credentialKey('llm-pi-ai', 'openai'),
      label: 'OpenAI',
      methods: [{ id: 'api-key', label: 'API key' }],
      inFlight: false,
      signedIn: true,
    }
    expect(isOAuthFlow(openai)).toBe(false)

    // 4. Gaia OAuth account alias
    const codexAlias: FlowView = {
      key: credentialKey('llm-pi-ai', 'codex-work'),
      label: 'Codex Work',
      methods: [{ id: 'oauth', label: 'OAuth' }],
      inFlight: false,
      signedIn: true,
      accountAlias: true,
    }
    expect(isOAuthFlow(codexAlias)).toBe(true)

    // 5. Gaia API-key account alias (accountApiKey === true)
    const apiKeyAlias: FlowView = {
      key: credentialKey('llm-pi-ai', 'openai-work'),
      label: 'OpenAI Work',
      methods: [{ id: 'api-key', label: 'API key' }],
      inFlight: false,
      signedIn: true,
      accountAlias: true,
      accountApiKey: true,
    }
    expect(isOAuthFlow(apiKeyAlias)).toBe(false)

    // 6. Gaia account alias with OAuth methods but configured as API-key (accountApiKey === true)
    const hybridApiKeyAlias: FlowView = {
      key: credentialKey('llm-pi-ai', 'codex-custom'),
      label: 'Codex Custom',
      methods: [{ id: 'oauth', label: 'OAuth' }],
      inFlight: false,
      signedIn: true,
      accountAlias: true,
      accountApiKey: true,
    }
    expect(isOAuthFlow(hybridApiKeyAlias)).toBe(false)
  })
})

describe('determineFlowAuthKind', () => {
  it('maps flows to oauth, api-key, or undefined', () => {
    const flows: FlowView[] = [
      {
        key: credentialKey('llm-pi-ai', 'openai-codex'),
        label: 'OpenAI Codex',
        methods: [{ id: 'oauth', label: 'OAuth' }],
        inFlight: false,
        signedIn: true,
      },
      {
        key: credentialKey('llm-pi-ai', 'anthropic'),
        label: 'Anthropic',
        methods: [{ id: 'oauth', label: 'OAuth' }, { id: 'api-key', label: 'API key' }],
        inFlight: false,
        signedIn: false, // not signed in via OAuth
      },
      {
        key: credentialKey('llm-pi-ai', 'openai'),
        label: 'OpenAI',
        methods: [{ id: 'api-key', label: 'API key' }],
        inFlight: false,
        signedIn: true,
      },
      {
        key: credentialKey('llm-pi-ai', 'codex-work'),
        label: 'Codex Work',
        methods: [{ id: 'oauth', label: 'OAuth' }],
        inFlight: false,
        signedIn: true,
        accountAlias: true,
      },
      {
        key: credentialKey('llm-pi-ai', 'openai-work'),
        label: 'OpenAI Work',
        methods: [{ id: 'api-key', label: 'API key' }],
        inFlight: false,
        signedIn: true,
        accountAlias: true,
        accountApiKey: true,
      },
    ]

    expect(determineFlowAuthKind('openai-codex', flows)).toBe('oauth')
    expect(determineFlowAuthKind('anthropic', flows)).toBe('api-key')
    expect(determineFlowAuthKind('openai', flows)).toBe('api-key')
    expect(determineFlowAuthKind('codex-work', flows)).toBe('oauth')
    expect(determineFlowAuthKind('openai-work', flows)).toBe('api-key')
    expect(determineFlowAuthKind('non-existent', flows)).toBeUndefined()
    expect(determineFlowAuthKind('openai-codex', [])).toBeUndefined()
  })
})
