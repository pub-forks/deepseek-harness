// Ported from gaia web/src/lib/markdown/wikiLinks.ts — keep in sync.
// Wikilink target resolution shared by the markdown preview (FileViewer) and
// the Lexical rich editor, so `[[target|alias]]` opens the same file in both.

export function dirOf(absPath: string | undefined): string | null {
  if (!absPath) return null;
  const idx = absPath.lastIndexOf("/");
  if (idx < 0) return null;
  return absPath.slice(0, idx) || "/";
}

export function joinPath(dir: string, rel: string): string {
  if (rel.startsWith("/")) return rel;
  const parts = (dir + "/" + rel).split("/");
  const out: string[] = [];
  for (const p of parts) {
    if (p === "" || p === ".") continue;
    if (p === "..") out.pop();
    else out.push(p);
  }
  return "/" + out.join("/");
}

// `target` is the wikilink body before any alias: an optional relative path,
// optionally followed by a `#heading` / `^block` fragment. Bare names get `.md`.
export function resolveWikiTarget(dir: string | null, target: string): string | null {
  if (!dir) return null;
  const cleanTarget = target.split(/[#^]/)[0] ?? target;
  if (!cleanTarget) return null;
  const withExt = /\.[a-z0-9]+$/i.test(cleanTarget) ? cleanTarget : `${cleanTarget}.md`;
  return joinPath(dir, withExt);
}
