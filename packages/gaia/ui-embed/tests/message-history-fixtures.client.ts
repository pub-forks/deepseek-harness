/** Complete committed human-message fixture used by recall and assembled-composer tests. */
import { SessionSeq, type SessionEvent } from '@deepseek-ai/dsh-session/types'

/** @param seq - durable sequence. @param text - human message. @returns an append-origin event entry. */
export function historyMessage(seq: number, text: string, data: Partial<SessionEvent<'user/message'>['data']> = {}, surfaceOp: SessionEvent<'user/message'>['surfaceOp'] = 'append'): { type: 'event'; event: SessionEvent<'user/message'> } {
  return { type: 'event', event: {
    type: 'user/message', seq: SessionSeq(seq), time: seq, surfaceOp,
    data: { role: 'user', id: `history-${seq}` as SessionEvent<'user/message'>['data']['id'],
      source: { kind: 'user' }, content: [{ type: 'text', text }], ...data },
  } }
}
