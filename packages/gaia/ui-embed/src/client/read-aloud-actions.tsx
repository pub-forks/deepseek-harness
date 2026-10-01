/** Finalized assistant narration controls backed by the Gaia parent player. */
import { useEffect, useState } from 'react'
import { IconPlayOutlineRegular, IconStopFillRegular, IconSettingsOutlineRegular, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime, HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type { ChatSnapshot } from '@deepseek-ai/dsh-client-ui-chat/client'
import { MAX_CHAT_SPEECH_BYTES, narrationWorkspace, postToParent, type GaiaReadAloudState } from './bridge.ts'
import type {} from './read-aloud-locales.ts'
import css from './ReadAloudActions.module.css'

/** Parent-owned playback observation supplied through framework hooks. */
export interface ReadAloudInjected {
  hooks: { readAloud: HostObservable<GaiaReadAloudState> }
  workspacePath: () => string | undefined
}

/** Finalized message owner, session/chat seats, playback hook and labels. */
export type ReadAloudActionProps = PropsRuntime<'conversation.chat.assistant-actions'>
  & InjectFace<ReadAloudInjected> & PropsLocale<'gaia.readAloud'>

/**
 * Read only durable assistant text on explicit interaction, not during render.
 * @param snapshot - current chat projection.
 * @param messageId - finalized assistant identity.
 * @returns bounded prose, or null when absent or oversized.
 */
export function readableAssistantText(snapshot: ChatSnapshot, messageId: ReadAloudActionProps['messageId']): string | null {
  const node = snapshot.legacy.nodes.find(candidate => candidate.kind === 'assistant' && candidate.messageId === messageId)
  if (node?.kind !== 'assistant') return null
  const text = node.blocks.flatMap(block => block.kind === 'text' ? [block.text] : []).join('')
  return text.trim() && text.length <= MAX_CHAT_SPEECH_BYTES
    && new TextEncoder().encode(text).length <= MAX_CHAT_SPEECH_BYTES ? text : null
}

/**
 * Render read/stop and instructions alongside existing message actions.
 * @param props - framework-owned message and session seats.
 * @returns localized controls; streaming messages never own this slot.
 */
export function GaiaReadAloudActions({ messageId, sessionId, useChat, useReadAloud, workspacePath, t }: ReadAloudActionProps) {
  const player = useReadAloud(state => state)
  const chat = useChat(snapshot => snapshot)
  const reading = player.status !== 'idle' && player.messageId === messageId && player.sessionId === sessionId
  const [failed, setFailed] = useState(false)
  const stop = () => { postToParent({ source: 'gaia-dsh', v: 1, type: 'stopReadAloud', sessionId, messageId }) }
  useEffect(() => () => {
    postToParent({ source: 'gaia-dsh', v: 1, type: 'stopReadAloud', sessionId, messageId })
  }, [sessionId, messageId])
  const read = () => {
    if (reading) { stop(); return }
    if (!player.enabled) return
    const text = readableAssistantText(chat, messageId)
    setFailed(text === null)
    if (text !== null) postToParent({ source: 'gaia-dsh', v: 1, type: 'readAloud', sessionId, messageId, text, ...narrationWorkspace(workspacePath()) })
  }
  const label = reading ? t('stop') : t('read')
  return <>
    <Tooltip label={!player.enabled && !reading ? t('disabled') : label} side="bottom">
      <button type="button" className={css.action} aria-label={label} aria-pressed={reading}
        disabled={!player.enabled && !reading} onClick={read}>
        {reading ? <IconStopFillRegular /> : <IconPlayOutlineRegular />}
      </button>
    </Tooltip>
    <Tooltip label={t('settings')} side="bottom">
      <button type="button" className={css.action} aria-label={t('settings')}
        onClick={() => { postToParent({ source: 'gaia-dsh', v: 1, type: 'readAloudSettings' }) }}><IconSettingsOutlineRegular /></button>
    </Tooltip>
    {failed && <span role="status">{t('unavailable')}</span>}
  </>
}
