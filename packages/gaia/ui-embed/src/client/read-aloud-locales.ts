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

/** Japanese narration controls. */
export const ja = {
  reading: '読み上げ中',
  read: '読み上げる', stop: '読み上げを停止', settings: '読み上げの説明',
  disabled: '読み上げが無効か利用できません。Gaia の音声設定で有効にしてください。',
  unavailable: 'この回答には読み上げ可能なテキストがないか、長すぎて読み上げられません。',
} satisfies Record<keyof typeof en, string>

/** Spanish narration controls. */
export const es = {
  reading: 'Leyendo en voz alta',
  read: 'Leer en voz alta', stop: 'Detener lectura', settings: 'Instrucciones de lectura en voz alta',
  disabled: 'La lectura en voz alta está desactivada o no disponible. Actívala en los ajustes de voz de Gaia.',
  unavailable: 'Esta respuesta no tiene texto legible o es demasiado larga para leerla en voz alta.',
} satisfies Record<keyof typeof en, string>

/** French narration controls. */
export const fr = {
  reading: 'Lecture à voix haute',
  read: 'Lire à voix haute', stop: 'Arrêter la lecture', settings: 'Consignes de lecture à voix haute',
  disabled: 'La lecture à voix haute est désactivée ou indisponible. Activez-la dans les paramètres vocaux de Gaia.',
  unavailable: 'Cette réponse ne contient pas de texte lisible ou est trop longue pour être lue à voix haute.',
} satisfies Record<keyof typeof en, string>

/** German narration controls. */
export const de = {
  reading: 'Wird vorgelesen',
  read: 'Vorlesen', stop: 'Vorlesen beenden', settings: 'Anweisungen zum Vorlesen',
  disabled: 'Vorlesen ist deaktiviert oder nicht verfügbar. Aktiviere es in den Gaia-Spracheinstellungen.',
  unavailable: 'Diese Antwort enthält keinen vorlesbaren Text oder ist zu lang zum Vorlesen.',
} satisfies Record<keyof typeof en, string>

/** Russian narration controls. */
export const ru = {
  reading: 'Чтение вслух',
  read: 'Прочитать вслух', stop: 'Остановить чтение', settings: 'Инструкции для чтения вслух',
  disabled: 'Чтение вслух отключено или недоступно. Включите его в голосовых настройках Gaia.',
  unavailable: 'В этом ответе нет текста для чтения или он слишком длинный.',
} satisfies Record<keyof typeof en, string>

/** Portuguese narration controls. */
export const pt = {
  reading: 'Lendo em voz alta',
  read: 'Ler em voz alta', stop: 'Parar leitura', settings: 'Instruções de leitura em voz alta',
  disabled: 'A leitura em voz alta está desativada ou indisponível. Ative-a nas configurações de voz do Gaia.',
  unavailable: 'Esta resposta não tem texto legível ou é longa demais para ser lida em voz alta.',
} satisfies Record<keyof typeof en, string>

/** Typed narration labels. */
export type ReadAloudKey = keyof typeof en

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Gaia shared-player controls. */
    'gaia.readAloud': ReadAloudKey
  }
}
