/** Gaia Markdown metadata and keyed document-body identity. */
import type { DocumentPreviewDefinition } from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/client'

/** Slot body id registered by the Gaia Markdown renderer. */
export const MARKDOWN_BODY_ID = '@deepseek-ai/dsh-gaia-ui-markdown/markdown'
/** Slot body id registered by the Gaia Tasks renderer. */
export const TASKS_BODY_ID = '@deepseek-ai/dsh-gaia-ui-markdown/tasks'

/** Build the Gaia Markdown renderer definition.
 * @param title - localized preview title.
 * @returns the higher-priority Markdown preview definition.
 */
export function markdownDefinition(title: () => string): DocumentPreviewDefinition {
  return { id: MARKDOWN_BODY_ID, extensions: ['md', 'markdown'], priority: 'extension', title, loading: 'text-pages', wrap: false }
}

/** Build the Gaia `.tasks` renderer definition; it loads the complete file because a partial JSON document cannot be parsed. */
export function tasksDefinition(title: () => string): DocumentPreviewDefinition {
  return { id: TASKS_BODY_ID, extensions: ['tasks'], priority: 'extension', title, loading: 'bytes-complete', wrap: false }
}
