import type { Branded } from '@deepseek-ai/dsh-brand'
import type { CredentialKey } from '@deepseek-ai/dsh-credentials/types'

/** One browser authorization attempt. */
export type AttemptId = Branded<'GaiaAuthorizationAttemptId'>
/** One question within an attempt. */
export type PromptId = Branded<'GaiaAuthorizationPromptId'>
/** Browser-safe authorization values. */
export interface FlowView {
  key: CredentialKey
  label: string
  methods: readonly { id: string; label: string }[]
  inFlight: boolean
  signedIn: boolean
  expiresAt?: number
  account?: string
  /** This route is a removable provider account alias. */
  accountAlias?: boolean
  /** This account alias stores an API key rather than an OAuth grant. */
  accountApiKey?: boolean
}

/** Every frame identifies its attempt so prompt answers can address it. */
export type AttemptPayload = (
  | { type: 'notice'; message: string; url?: string; code?: string }
  | { type: 'prompt'; promptId: PromptId; kind: 'text' | 'secret' | 'select'; message: string; placeholder?: string; options?: readonly { id: string; label: string; description?: string }[] }
  | { type: 'withdrawn'; promptId: PromptId }
  | { type: 'done'; outcome: 'authorized' | 'cancelled' }
  /** `detail` is the underlying failure, one line and bounded; never a credential. */
  | { type: 'error'; message: string; detail?: string }
)
/** One authorization stream item tagged with its attempt id. */
export type AttemptItem = { attemptId: AttemptId } & AttemptPayload
/** Start an authorization flow with one of its registered methods. */
export interface StartRequest { key: CredentialKey; method: string }
/** Supply a value for a live authorization prompt. */
export interface AnswerRequest { attemptId: AttemptId; promptId: PromptId; value: string }
/** Cancel an active authorization attempt. */
export interface CancelRequest { attemptId: AttemptId }
/** Remove the stored credential for a provider flow. */
export interface SignOutRequest { key: CredentialKey }
/** Create one independent alias of an installed OAuth route. */
export interface CreateAccountRequest { source: string; accountId: string; label: string; apiKey?: string }
/** Remove an alias profile and only its own credential record. */
export interface RemoveAccountRequest { key: CredentialKey }
