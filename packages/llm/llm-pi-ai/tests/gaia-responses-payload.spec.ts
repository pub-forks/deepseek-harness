import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, { ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import * as LlmPiAi from '@deepseek-ai/dsh-llm-pi-ai'
import { responsesPayloadHook } from '../src/gaia-responses-payload.ts'
import { resolveProfiles } from '../src/config.ts'
import { assemble } from './assemble.ts'
import { closeMockServers, mockServer } from './mock-server.ts'

afterEach(async () => {
  vi.unstubAllEnvs()
  await closeMockServers()
})

describe('GAIA: Responses payload hook', () => {
  it('skips every protocol that is not a Responses API', () => {
    expect(responsesPayloadHook('openai-completions', { reasoningSummary: 'detailed' })).toBeUndefined()
    expect(responsesPayloadHook('anthropic-messages', { textVerbosity: 'high' })).toBeUndefined()
  })

  it('leaves the request alone when the profile configures nothing', () => {
    expect(responsesPayloadHook('openai-codex-responses', {})).toBeUndefined()
  })

  it('sets a configured summary only while reasoning is on', () => {
    const hook = responsesPayloadHook('openai-codex-responses', { reasoningSummary: 'detailed' })
    expect(hook?.({ reasoning: { effort: 'high', summary: 'auto' }, text: { verbosity: 'low' } }))
      .toEqual({ reasoning: { effort: 'high', summary: 'detailed' }, text: { verbosity: 'low' } })
    expect(hook?.({ reasoning: { effort: 'none' } })).toEqual({ reasoning: { effort: 'none' } })
    expect(hook?.({ model: 'm' })).toEqual({ model: 'm' })
  })

  it('applies configured summary and verbosity without mutating the body', () => {
    const hook = responsesPayloadHook('openai-responses', { reasoningSummary: 'concise', textVerbosity: 'medium' })
    const body = { reasoning: { effort: 'low', summary: 'auto' } }
    expect(hook?.(body)).toEqual({
      reasoning: { effort: 'low', summary: 'concise' },
      text: { verbosity: 'medium' },
    })
    expect(body).toEqual({ reasoning: { effort: 'low', summary: 'auto' } })
  })

  it('validates the profile fields', () => {
    expect(resolveProfiles({ acme: { api: 'openai-responses', baseURL: 'https://acme.test/v1', reasoningSummary: 'detailed', textVerbosity: 'high', models: [{ id: 'm' }] } })
      .get('acme')).toMatchObject({ reasoningSummary: 'detailed', textVerbosity: 'high' })
    expect(() => resolveProfiles({ acme: { baseURL: 'https://acme.test/v1', reasoningSummary: 'verbose' as never } }))
      .toThrow()
  })

  it('reaches the wire on a Responses route', async () => {
    vi.stubEnv('PI_TEST_KEY', 'test-key')
    const server = await mockServer([{ status: 401, body: JSON.stringify({ error: { message: 'expected mock failure' } }) }])
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    await ctx.plugin(LlmPiAi, {
      providers: {
        acme: {
          apiKeyEnv: 'PI_TEST_KEY',
          api: 'openai-responses',
          baseURL: `${server.url}/v1`,
          reasoningSummary: 'detailed',
          textVerbosity: 'high',
          models: [{ id: 'acme-think', contextWindow: 65_536, maxTokens: 4096, reasoningEfforts: { off: null, high: 'high' } }],
        },
      },
    })
    await assemble(ctx, { provider: 'acme', model: 'acme-think', reasoningEffort: ReasoningEffortId('high'), messages: [] })
    expect(server.paths).toEqual(['/v1/responses'])
    expect(server.requests[0]).toMatchObject({
      reasoning: { effort: 'high', summary: 'detailed' },
      text: { verbosity: 'high' },
    })
  })
})
