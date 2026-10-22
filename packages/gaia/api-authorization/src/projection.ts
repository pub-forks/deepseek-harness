import type { AuthorizationEntry } from '@deepseek-ai/dsh-authorization/types'
import type { CredentialRecordInfo } from '@deepseek-ai/dsh-credentials'
import type { FlowView } from './types.ts'

/** Project public flow details and credential presence without reading record payloads.
 * @param entry - registered provider flow.
 * @param record - credential presence metadata.
 * @returns browser-safe flow view.
 */
export function projectFlow(entry: AuthorizationEntry, record: CredentialRecordInfo): FlowView {
  return {
    key: entry.key,
    label: entry.label,
    methods: entry.methods.map(method => ({ id: method.id, label: method.label })),
    inFlight: entry.inFlight,
    signedIn: record.configured,
  }
}
