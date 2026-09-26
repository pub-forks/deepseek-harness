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
}

/** Every frame identifies its attempt so prompt answers can address it. */
export type AttemptPayload = (
  | { type: 'notice'; message: string; url?: string; code?: string }
  | { type: 'prompt'; promptId: PromptId; kind: 'text' | 'secret' | 'select'; message: string; placeholder?: string; options?: readonly { id: string; label: string; description?: string }[] }
  | { type: 'withdrawn'; promptId: PromptId }
  | { type: 'done'; outcome: 'authorized' | 'cancelled' }
  | { type: 'error'; message: string }
)
export type AttemptItem = { attemptId: AttemptId } & AttemptPayload
export interface StartRequest { key: CredentialKey; method: string }
export interface AnswerRequest { attemptId: AttemptId; promptId: PromptId; value: string }
export interface CancelRequest { attemptId: AttemptId }
export interface SignOutRequest { key: CredentialKey }
