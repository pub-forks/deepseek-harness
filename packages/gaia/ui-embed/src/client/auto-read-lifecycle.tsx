/** Session input lifecycle seat keeps the completion observer mounted before a task answers. */
import { useEffect } from 'react'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'

/** Binding-scoped observer factory injected by the Gaia plugin. */
export interface AutoReadInjected { observe: () => () => void }

/** Framework-owned session lifecycle and injected observer. */
export type AutoReadLifecycleProps = PropsRuntime<'conversation.input.overlay'> & InjectFace<AutoReadInjected>

/**
 * Attach once for the mounted session input and dispose on navigation.
 * @param props - session-bound observer capability.
 * @returns no visual chrome; the existing manual controls remain unchanged.
 */
export function GaiaAutoReadLifecycle(props: AutoReadLifecycleProps): null {
  useEffect(props.observe, [props.observe])
  return null
}
