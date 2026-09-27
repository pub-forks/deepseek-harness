/** Gaia Markdown metadata and keyed document-body identity. */
import type { DocumentPreviewDefinition } from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/client'

export const MARKDOWN_BODY_ID = '@deepseek-ai/dsh-gaia-ui-markdown/markdown'

/** DSH's `extension` band ranks above its builtin Markdown definition. */
export function markdownDefinition(title: () => string): DocumentPreviewDefinition {
  return { id: MARKDOWN_BODY_ID, extensions: ['md', 'markdown'], priority: 'extension', title, loading: 'text-pages', wrap: false }
}
