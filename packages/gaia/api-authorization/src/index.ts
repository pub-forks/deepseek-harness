/** Authenticated browser Remote for registered authorization flows. */
import { randomUUID } from 'node:crypto'
import { brandString } from '@deepseek-ai/dsh-brand'
import { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { AuthorizationDeclinedError, AuthorizationError } from '@deepseek-ai/dsh-authorization'
import type { AuthorizationPrompt } from '@deepseek-ai/dsh-authorization/types'
import { projectFlow } from './projection.ts'
import type { AnswerRequest, AttemptId, AttemptItem, AttemptPayload, CancelRequest, FlowView, PromptId, SignOutRequest, StartRequest } from './types.ts'
export type { AnswerRequest, AttemptId, AttemptItem, AttemptPayload, CancelRequest, FlowView, PromptId, SignOutRequest, StartRequest } from './types.ts'

interface PendingPrompt { resolve(value: string): void; reject(reason: Error): void }
interface Attempt { key: FlowView['key']; controller: AbortController; prompts: Map<PromptId, PendingPrompt> }

/** One stream per attempt, with answer and cancellation calls addressed by random ids. */
export class GaiaAuthorizationController extends TypertRemoteService {
  static inject = ['authorization', 'credentials']
  private readonly attempts = new Map<AttemptId, Attempt>()
  /** @param ctx - Host with the authorization and credential services. */
  constructor(ctx: Context) { super(ctx, 'gaiaAuthorizationController', { namespace: 'gaiaAuthorization' }) }

  /** @returns Public flow and stored-record presence facts. */
  @Remote
  async listFlows(): Promise<FlowView[]> {
    return Promise.all(this.ctx.authorization.list().map(async entry =>
      projectFlow(entry, await this.ctx.credentials.describeRecord(entry.key))))
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
      yield { attemptId, type: 'error', message: 'Unknown sign-in flow.' }; return
    }
    if (!entry.methods.some(method => method.id === request.method)) {
      yield { attemptId, type: 'error', message: 'Unknown sign-in method.' }; return
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
      push({ type: 'error', message: error instanceof AuthorizationError && error.code === 'ALREADY_IN_FLIGHT' ? 'busy' : 'Sign-in failed.' })
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
