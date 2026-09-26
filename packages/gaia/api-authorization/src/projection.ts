import type { AuthorizationEntry } from '@deepseek-ai/dsh-authorization/types'
import type { CredentialRecordInfo } from '@deepseek-ai/dsh-credentials'
import type { FlowView } from './types.ts'

/** Explicit public-field projection; record payloads are never read. */
export function projectFlow(entry: AuthorizationEntry, record: CredentialRecordInfo): FlowView {
  return {
    key: entry.key,
    label: entry.label,
    methods: entry.methods.map(method => ({ id: method.id, label: method.label })),
    inFlight: entry.inFlight,
    signedIn: record.configured,
  }
}
