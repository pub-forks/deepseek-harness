/** Ambient session narration indicator backed by the validated parent player state. */
import type { HostObservable, InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { GaiaReadAloudState } from './bridge.ts'
import type {} from './read-aloud-locales.ts'
import css from './SessionReadAloud.module.css'

/** Playback observation shared with message controls, without a Session binding. */
export interface SessionReadAloudInjected {
  hooks: { readAloud: HostObservable<GaiaReadAloudState> }
}

/** Row identity, framework playback hook, and accessible narration label. */
export type SessionReadAloudProps = PropsRuntime<'sidebar.session.row.decoration'>
  & InjectFace<SessionReadAloudInjected> & PropsLocale<'gaia.readAloud'>

const BARS = [0, 1, 2, 3] as const

/**
 * Show narration beside its owning session, independently of session activity.
 * @param props - row identity and parent playback observation.
 * @returns sound-wave bars, animated while speaking, or nothing when this session is not reading.
 */
export function GaiaSessionReadAloud({ sessionId, useReadAloud, t }: SessionReadAloudProps) {
  const status = useReadAloud(player => player.sessionId === sessionId ? player.status : 'idle')
  if (status === 'idle') return null
  return <span role="img" aria-label={t('reading')} title={t('reading')}
    className={css.indicator} data-playing={status === 'speaking' ? '' : undefined}>
    {BARS.map(bar => <span key={bar} aria-hidden="true" className={css.bar} />)}
  </span>
}
