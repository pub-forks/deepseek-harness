/** Authenticated browser Remote for registered authorization flows. */
import { randomUUID } from 'node:crypto'
import { brandString } from '@deepseek-ai/dsh-brand'
import { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { AuthorizationDeclinedError, AuthorizationError } from '@deepseek-ai/dsh-authorization'
import type {} from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-llm'
import type { AuthorizationPrompt } from '@deepseek-ai/dsh-authorization/types'
import { projectFlow } from './projection.ts'
import type { AnswerRequest, AttemptId, AttemptItem, AttemptPayload, CancelRequest, CreateAccountRequest, FlowView, PromptId, RemoveAccountRequest, SignOutRequest, StartRequest } from './types.ts'
export type { AnswerRequest, AttemptId, AttemptItem, AttemptPayload, CancelRequest, CreateAccountRequest, FlowView, PromptId, RemoveAccountRequest, SignOutRequest, StartRequest } from './types.ts'

interface PendingPrompt { resolve(value: string): void; reject(reason: Error): void }
interface Attempt { key: FlowView['key']; controller: AbortController; prompts: Map<PromptId, PendingPrompt> }

/**
 * One-line, bounded reason for a failed attempt. Flow errors describe the
 * provider exchange (status, OAuth error code), not credential values.
 */
export function failureDetail(error: unknown): string {
  const code = error instanceof AuthorizationError ? error.code : undefined
  const text = describeThrown(error)
  return (code && !text.includes(code) ? `${code}: ${text}` : text).slice(0, 300)
}

/** @returns readable text for any thrown value, never empty. */
function describeThrown(error: unknown): string {
  let text: string
  if (error instanceof Error) text = `${error.name === 'Error' ? '' : `${error.name}: `}${error.message}`
  else if (typeof error === 'string') text = error
  else if (error !== null && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string') text = (error as { message: string }).message
  else text = safeJson(error)
  text = text.replace(/\s+/g, ' ').trim()
  return text.length > 0 ? text : `unexpected ${error === null ? 'null' : typeof error} failure`
}

function safeJson(value: unknown): string {
  // JSON.stringify returns undefined (despite its typing) for these, and throws for bigint/cycles.
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') return String(value)
  try { return JSON.stringify(value) } catch { return `unserializable ${typeof value}` }
}

/** One stream per attempt, with answer and cancellation calls addressed by random ids. */
export class GaiaAuthorizationController extends TypertRemoteService {
  static inject = ['authorization', 'credentials', 'settings', 'llm']
  private readonly attempts = new Map<AttemptId, Attempt>()
  /** @param ctx - Host with the authorization and credential services. */
  constructor(ctx: Context) { super(ctx, 'gaiaAuthorizationController', { namespace: 'gaiaAuthorization' }) }

  /** @returns Public flow and stored-record presence facts. */
  @Remote
  async listFlows(): Promise<FlowView[]> {
    const profile = this.ctx.settings.describe({ redactSecrets: true }).find(row => row.ns === 'llm-pi-ai')?.value as { providers?: Record<string, { catalogProvider?: string }> } | undefined
    return Promise.all(this.ctx.authorization.list().map(async (entry) => {
      const projected = projectFlow(entry, await this.ctx.credentials.describeRecord(entry.key))
      const id = entry.key.startsWith('llm-pi-ai/') ? entry.key.slice('llm-pi-ai/'.length) : ''
      return { ...projected, ...(profile?.providers?.[id]?.catalogProvider ? { accountAlias: true } : {}) }
    }))
  }

  /** Create an independently keyed OAuth route alias in the live settings profile. */
  @Remote
  async createAccount(request: CreateAccountRequest): Promise<void> {
    const accountId = request.accountId.trim()
    const label = request.label.trim()
    const source = request.source.trim()
    if (!/^[a-z][a-z0-9-]{1,47}$/.test(accountId)) throw new Error('Account id must use 2–48 lowercase letters, digits, or hyphens and start with a letter.')
    if (label.length < 1 || label.length > 80) throw new Error('Account label must contain 1–80 characters.')
    const key = `llm-pi-ai/${source}`
    const sourceFlow = this.ctx.authorization.list().find(flow => flow.key === key)
    if (sourceFlow === undefined || !sourceFlow.methods.some(method => method.id === 'oauth')) throw new Error('Unknown OAuth source provider.')
    const descriptor = this.ctx.settings.describe({ redactSecrets: true }).find(row => row.ns === 'llm-pi-ai')
    if (descriptor === undefined) throw new Error('Harness Models settings are unavailable.')
    const value = descriptor.value as { providers?: Record<string, unknown> }
    const providers = value.providers ?? {}
    const sourceProfile = providers[source] as { catalogProvider?: unknown } | undefined
    if (sourceProfile?.catalogProvider !== undefined) throw new Error('Choose an installed OAuth provider, not another account alias.')
    const directory = this.ctx.llm.listConfigurableProviders()
    if (!directory.some(provider => provider.provider === source && provider.declared === false)) {
      throw new Error('Choose an installed OAuth provider.')
    }
    if (directory.some(provider => provider.provider === accountId)) throw new Error('Account id is already in use.')
    if (Object.hasOwn(providers, accountId) || this.ctx.authorization.list().some(flow => flow.key === `llm-pi-ai/${accountId}`)) throw new Error('Account id is already in use.')
    await this.ctx.settings.mutate('llm-pi-ai', [{ op: 'set', path: ['providers', accountId], value: { displayName: label, catalogProvider: source } }], descriptor.revision)
  }

  /** Delete one account alias and its independent credential. */
  @Remote
  async removeAccount(request: RemoveAccountRequest): Promise<void> {
    const entry = this.ctx.authorization.list().find(flow => flow.key === request.key)
    if (entry === undefined || !entry.key.startsWith('llm-pi-ai/')) throw new Error('Unknown account alias.')
    if (entry.inFlight || [...this.attempts.values()].some(item => item.key === request.key)) throw new Error('Sign-in is in progress.')
    const id = entry.key.slice('llm-pi-ai/'.length)
    const descriptor = this.ctx.settings.describe({ redactSecrets: true }).find(row => row.ns === 'llm-pi-ai')
    const providers = (descriptor?.value as { providers?: Record<string, { catalogProvider?: string }> } | undefined)?.providers
    if (descriptor === undefined || providers?.[id]?.catalogProvider === undefined) throw new Error('This provider is not a removable account alias.')
    await this.ctx.credentials.deleteRecord(entry.key)
    await this.ctx.settings.mutate('llm-pi-ai', [{ op: 'unset', path: ['providers', id] }], descriptor.revision)
  }

  /**
   * @param request - registered flow and selected method.
   * @param signal - stream lifetime.
   * @returns attempt events until settlement or cancellation.
   */
  @Remote({ mode: 'stream' })
  async *start(request: StartRequest, signal: AbortSignal): AsyncIterable<AttemptItem> {
    const attemptId = brandString<AttemptId>(randomUUID())
    const entry = this.ctx.authorization.list().find(flow => flow.key === request.key)
    if (entry === undefined || entry.key !== request.key) {
      yield { attemptId, type: 'error', message: 'Sign-in failed.', detail: `Unknown sign-in flow ${request.key}.` }; return
    }
    if (!entry.methods.some(method => method.id === request.method)) {
      yield { attemptId, type: 'error', message: 'Sign-in failed.', detail: `Unknown sign-in method ${request.method}.` }; return
    }
    if (entry.inFlight || [...this.attempts.values()].some(item => item.key === request.key)) {
      yield { attemptId, type: 'error', message: 'busy' }; return
    }
    const controller = new AbortController()
    const attempt: Attempt = { key: request.key, controller, prompts: new Map() }
    this.attempts.set(attemptId, attempt)
    const queue: AttemptItem[] = []
    let wake: (() => void) | undefined
    const state = { finished: false }
    const push = (item: AttemptPayload): void => { queue.push({ ...item, attemptId }); wake?.() }
    const abort = (): void => { controller.abort(); wake?.() }
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
    void this.ctx.authorization.begin({
      key: entry.key, method: request.method, signal: controller.signal,
      interaction: {
        notify: (notice) => { push({ type: 'notice', message: notice.message, ...notice.url === undefined ? {} : { url: notice.url }, ...notice.code === undefined ? {} : { code: notice.code } }) },
        prompt: prompt => this.ask(attempt, prompt, push),
      },
    }).then((outcome) => { push({ type: 'done', outcome: outcome.status }) }, (error: unknown) => {
      if (error instanceof AuthorizationError && error.code === 'ALREADY_IN_FLIGHT') { push({ type: 'error', message: 'busy' }); return }
      console.error(`gaia-authorization: sign-in for ${entry.key} failed`, error)
      const detail = failureDetail(error)
      push({ type: 'error', message: 'Sign-in failed.', ...detail ? { detail } : {} })
    }).finally(() => {
      state.finished = true
      for (const pending of attempt.prompts.values()) pending.reject(new AuthorizationDeclinedError())
      attempt.prompts.clear()
      this.attempts.delete(attemptId)
      wake?.()
    })
    try {
      while (!signal.aborted) {
        if (queue.length > 0) { yield queue.shift() as AttemptItem; continue }
        if (state.finished) return
        await new Promise<void>((resolve) => { wake = resolve })
        wake = undefined
      }
    } finally {
      signal.removeEventListener('abort', abort)
      controller.abort()
      for (const pending of attempt.prompts.values()) pending.reject(new AuthorizationDeclinedError())
      attempt.prompts.clear()
    }
  }

  private ask(attempt: Attempt, prompt: AuthorizationPrompt, push: (item: AttemptPayload) => void): Promise<string> {
    const promptId = brandString<PromptId>(randomUUID())
    return new Promise<string>((resolve, reject) => {
      const withdraw = (): void => {
        if (!attempt.prompts.delete(promptId)) return
        push({ type: 'withdrawn', promptId })
        reject(new Error('prompt withdrawn'))
      }
      const settle = (value: string): void => {
        prompt.signal?.removeEventListener('abort', withdraw)
        attempt.prompts.delete(promptId)
        resolve(value)
      }
      attempt.prompts.set(promptId, { resolve: settle, reject })
      prompt.signal?.addEventListener('abort', withdraw, { once: true })
      if (prompt.signal?.aborted) { withdraw(); return }
      push({ type: 'prompt', promptId, kind: prompt.kind, message: prompt.message,
        ...prompt.kind === 'select' ? { options: prompt.options.map(option => ({ id: option.id, label: option.label, ...option.description === undefined ? {} : { description: option.description } })) } : prompt.placeholder === undefined ? {} : { placeholder: prompt.placeholder },
      })
    })
  }

  /** @param request - active attempt, live prompt, and answer. @returns true once accepted. */
  @Remote
  answer(request: AnswerRequest): boolean {
    const pending = this.attempts.get(request.attemptId)?.prompts.get(request.promptId)
    if (pending === undefined) return false
    pending.resolve(request.value)
    return true
  }

  /** @param request - active attempt. @returns true if cancellation was requested. */
  @Remote
  cancel(request: CancelRequest): boolean {
    const attempt = this.attempts.get(request.attemptId)
    if (attempt === undefined) return false
    attempt.controller.abort()
    return true
  }

  /** @param request - registered flow key. @returns after its stored record is deleted. */
  @Remote
  async signOut(request: SignOutRequest): Promise<void> {
    const entry = this.ctx.authorization.list().find(flow => flow.key === request.key)
    if (entry === undefined) throw new Error('Unknown sign-in flow.')
    if (entry.inFlight) throw new Error('Sign-in is in progress.')
    await this.ctx.credentials.deleteRecord(entry.key)
  }
}
export default GaiaAuthorizationController
