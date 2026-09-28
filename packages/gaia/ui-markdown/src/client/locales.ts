/** Renderer labels. */
export const zh = { label: 'Obsidian', copy: '复制', copied: '已复制', properties: 'Properties', empty: 'empty', footnotes: 'Footnotes' } satisfies Record<string, string>
export type MarkdownKey = keyof typeof zh
export const en = { label: 'Obsidian', copy: 'Copy', copied: 'Copied', properties: 'Properties', empty: 'empty', footnotes: 'Footnotes' } satisfies Record<MarkdownKey, string>

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { gaiaMarkdown: MarkdownKey }
}
