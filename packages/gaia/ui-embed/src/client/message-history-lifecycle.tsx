/** Common input lifecycle contribution for durable message recall in both Gaia surfaces. */
import { useEffect } from 'react'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'

/** Session-binding observer installed by the Gaia plugin. */
export interface MessageHistoryInjected { observe: () => () => void }

/** Framework-owned input identity and binding-scoped observer callback. */
export type MessageHistoryLifecycleProps = PropsRuntime<'conversation.input.overlay'> & InjectFace<MessageHistoryInjected>

/**
 * Install recall for the mounted input and release it on rebind or unmount.
 * @param props - session-derived observer capability.
 * @returns no additional composer chrome.
 */
export function GaiaMessageHistoryLifecycle(props: MessageHistoryLifecycleProps): null {
  useEffect(props.observe, [props.observe])
  return null
}
