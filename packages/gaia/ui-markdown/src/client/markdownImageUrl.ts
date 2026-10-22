/** Local Markdown image destinations served by DSH's authenticated file route. */
import { fileMediaUrl, isAbsoluteWorkspacePath, pathPartsOf } from '@deepseek-ai/dsh-util-workspace-path'

/** Resolve a local Markdown image through DSH's authenticated file route.
 * @param base - authenticated file-media base URL.
 * @param documentPath - absolute path of the Markdown document.
 * @param destination - image URL or relative path from the document.
 * @returns authenticated image URL, or undefined for invalid destinations.
 */
export function markdownImageUrl(base: string, documentPath: string | undefined, destination: string): string | undefined {
  const suffix = destination.search(/[?#]/u)
  let path: string
  try { path = decodeURIComponent(suffix === -1 ? destination : destination.slice(0, suffix)) }
  catch { return undefined }
  if (!path || (!/^[a-z]:[/\\]/iu.test(path) && /^[a-z][a-z\d+.-]*:/iu.test(path))) return undefined
  if (!isAbsoluteWorkspacePath(path)) {
    if (documentPath === undefined) return undefined
    path = `${pathPartsOf(documentPath).directory}${path}`
  }
  return fileMediaUrl(base, path)
}
