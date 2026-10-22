/** Chat narration copy owned by Gaia. */
export const en = {
  reading: 'Reading aloud',
  read: 'Read aloud', stop: 'Stop reading', settings: 'Read-aloud instructions',
  disabled: 'Read aloud is disabled or unavailable. Enable it in Gaia voice settings.',
  unavailable: 'This response has no readable text or is too large to read aloud.',
} satisfies Record<string, string>

/** Simplified Chinese narration controls. */
export const zh = {
  reading: '正在朗读',
  read: '朗读', stop: '停止朗读', settings: '朗读说明',
  disabled: '朗读功能已关闭或不可用。请在 Gaia 语音设置中启用。',
  unavailable: '此回答没有可朗读的文本，或文本过长。',
} satisfies Record<keyof typeof en, string>

/** Typed narration labels. */
export type ReadAloudKey = keyof typeof en

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Gaia shared-player controls. */
    'gaia.readAloud': ReadAloudKey
  }
}
