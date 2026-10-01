/** Chat narration copy owned by Gaia. */
export const en = {
  reading: 'Reading aloud',
  read: 'Read aloud', stop: 'Stop reading', settings: 'Read-aloud instructions',
  disabled: 'Read aloud is disabled or unavailable. Enable it in Gaia voice settings.',
  unavailable: 'This response has no readable text or is too large to read aloud.',
} satisfies Record<string, string>

/** Typed narration labels. */
export type ReadAloudKey = keyof typeof en

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Gaia shared-player controls. */
    'gaia.readAloud': ReadAloudKey
  }
}
