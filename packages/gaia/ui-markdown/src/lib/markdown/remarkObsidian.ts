// Ported from gaia web/src/lib/markdown/remarkObsidian.ts — keep in sync.
import type { Plugin } from "unified";
import type {
  Root,
  RootContent,
  PhrasingContent,
  Paragraph,
  Blockquote,
  Link,
  Image,
  Text,
  Html,
} from "mdast";

const WIKI_RE = /(!?)\[\[([^\]\n]+)\]\]/g;
const MARK_DELIM = "==";
const TAG_RE = /(^|[\s(])(#[A-Za-z][\w/-]*)/g;
const BLOCK_TRAILING_RE = /\s\^([A-Za-z0-9-]+)\s*$/;
const CALLOUT_RE = /^\[!([A-Za-z][\w-]*)\]([-+]?)\s*(.*)$/;

function buildWikiNode(target: string, isEmbed: boolean): Link | Image {
  const [rawTarget, aliasRaw] = target.split("|");
  const tgt = (rawTarget ?? "").trim();
  const alias = aliasRaw?.trim();
  const encoded = encodeURIComponent(tgt);
  if (isEmbed) {
    const img: Image = {
      type: "image",
      url: `obsidian://embed/${encoded}`,
      alt: alias ?? tgt,
      title: null,
    };
    return img;
  }
  const link: Link = {
    type: "link",
    url: `obsidian://wiki/${encoded}`,
    title: null,
    children: [{ type: "text", value: alias ?? tgt } as Text],
  };
  return link;
}

function splitTags(value: string): PhrasingContent[] {
  const out: PhrasingContent[] = [];
  let lastIdx = 0;
  TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TAG_RE.exec(value))) {
    const leading = m[1] ?? "";
    const tag = m[2] ?? "";
    const tagStart = m.index + leading.length;
    if (tagStart > lastIdx) {
      out.push({ type: "text", value: value.slice(lastIdx, tagStart) });
    }
    out.push({
      type: "link",
      url: `obsidian://tag/${encodeURIComponent(tag.slice(1))}`,
      title: null,
      children: [{ type: "text", value: tag }],
    });
    lastIdx = tagStart + tag.length;
  }
  if (out.length === 0) return [{ type: "text", value }];
  if (lastIdx < value.length) {
    out.push({ type: "text", value: value.slice(lastIdx) });
  }
  return out;
}

// `==text==` → a <mark> element (matches the Lexical highlight format). Rendered
// via `data.hName` so it stays structured (not raw HTML); the sanitize schema
// allow-lists <mark>. Inner nodes are walked like any other phrasing content.
function buildMark(children: PhrasingContent[]): PhrasingContent {
  return {
    type: "emphasis",
    children,
    data: { hName: "mark" },
  } as unknown as PhrasingContent;
}

// Where a `==` delimiter sits: which phrasing child, and where in its value.
interface DelimPos {
  node: number;
  at: number;
}

function findMarkDelim(
  nodes: Array<RootContent | PhrasingContent>,
  fromNode: number,
  fromAt: number,
): DelimPos | null {
  for (let i = fromNode; i < nodes.length; i++) {
    const n = nodes[i];
    if (!n || n.type !== "text") continue;
    const at = n.value.indexOf(MARK_DELIM, i === fromNode ? fromAt : 0);
    if (at >= 0) return { node: i, at };
  }
  return null;
}

// A highlight may wrap other inline markup (`==see **this** [[note]]==`), so by
// the time remark has parsed the inner markup the two `==` delimiters usually
// live in *different* siblings of the phrasing array. Pair them across the array
// like coalesceWikilinks does — a per-text-node regex only ever sees one half of
// such a highlight and leaves both markers as literal text. Delimiters are read
// from `text` children only, so `==` inside an inline code span (or a fenced
// block, which never reaches phrasing content) is never a marker.
function applyHighlights(nodes: Array<RootContent | PhrasingContent>): void {
  let fromNode = 0;
  let fromAt = 0;
  for (;;) {
    const open = findMarkDelim(nodes, fromNode, fromAt);
    if (!open) return;
    const close = findMarkDelim(nodes, open.node, open.at + MARK_DELIM.length);
    if (!close) return;
    // `====` — no content, so not a highlight; resume past the opener.
    if (close.node === open.node && close.at === open.at + MARK_DELIM.length) {
      fromNode = open.node;
      fromAt = close.at;
      continue;
    }

    const openText = nodes[open.node] as Text;
    const closeText = nodes[close.node] as Text;
    const inner: PhrasingContent[] = [];
    if (open.node === close.node) {
      const mid = openText.value.slice(open.at + MARK_DELIM.length, close.at);
      if (mid) inner.push({ type: "text", value: mid });
    } else {
      const head = openText.value.slice(open.at + MARK_DELIM.length);
      if (head) inner.push({ type: "text", value: head });
      inner.push(...(nodes.slice(open.node + 1, close.node) as PhrasingContent[]));
      const tail = closeText.value.slice(0, close.at);
      if (tail) inner.push({ type: "text", value: tail });
    }

    const before = openText.value.slice(0, open.at);
    const after = closeText.value.slice(close.at + MARK_DELIM.length);
    const replacement: PhrasingContent[] = [];
    if (before) replacement.push({ type: "text", value: before });
    replacement.push(buildMark(inner));
    if (after) replacement.push({ type: "text", value: after });
    nodes.splice(open.node, close.node - open.node + 1, ...replacement);

    // Resume at the trailing text (if any), else at the next sibling.
    fromNode = open.node + (before ? 1 : 0) + 1;
    fromAt = 0;
  }
}

function splitText(value: string): PhrasingContent[] {
  const out: PhrasingContent[] = [];
  let lastIdx = 0;
  WIKI_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WIKI_RE.exec(value))) {
    if (m.index > lastIdx) {
      out.push(...splitTags(value.slice(lastIdx, m.index)));
    }
    out.push(buildWikiNode(m[2] ?? "", m[1] === "!"));
    lastIdx = m.index + m[0].length;
  }
  if (out.length === 0) return splitTags(value);
  if (lastIdx < value.length) {
    out.push(...splitTags(value.slice(lastIdx)));
  }
  return out;
}

function extractTrailingBlockId(para: Paragraph): void {
  const last = para.children[para.children.length - 1];
  if (!last || last.type !== "text") return;
  const m = BLOCK_TRAILING_RE.exec(last.value);
  if (!m) return;
  last.value = last.value.slice(0, last.value.length - m[0].length);
  const anchor: Html = {
    type: "html",
    value: `<span id="block-${m[1]}" class="obsidian-block-anchor"></span>`,
  };
  para.children.push(anchor);
  if (last.value.length === 0) para.children.splice(para.children.length - 2, 1);
}

function processCallout(node: Blockquote): void {
  const first = node.children[0];
  if (!first || first.type !== "paragraph") return;
  const firstChild = first.children[0];
  if (!firstChild || firstChild.type !== "text") return;
  const m = CALLOUT_RE.exec(firstChild.value.split("\n")[0] ?? "");
  if (!m) return;

  const calloutType = (m[1] ?? "note").toLowerCase();
  const foldChar = m[2] ?? "";
  const fold = foldChar === "+" ? "expanded" : foldChar === "-" ? "collapsed" : "";

  const markerLen = `[!${m[1]}]${m[2]}`.length;
  firstChild.value = firstChild.value.slice(markerLen).replace(/^[ \t]+/, "");

  const titleChildren: PhrasingContent[] = [];
  const bodyChildren: PhrasingContent[] = [];
  let foundBreak = false;
  for (const child of first.children) {
    if (foundBreak) {
      bodyChildren.push(child);
      continue;
    }
    if (child.type === "text" && child.value.includes("\n")) {
      const idx = child.value.indexOf("\n");
      const titlePart = child.value.slice(0, idx);
      const bodyPart = child.value.slice(idx + 1);
      if (titlePart.length > 0) titleChildren.push({ type: "text", value: titlePart });
      foundBreak = true;
      if (bodyPart.length > 0) bodyChildren.push({ type: "text", value: bodyPart });
    } else {
      titleChildren.push(child);
    }
  }

  const data = (node.data ?? {}) as { hProperties?: Record<string, unknown> };
  node.data = {
    ...data,
    hProperties: {
      ...(data.hProperties ?? {}),
      "data-callout": calloutType,
      "data-callout-fold": fold,
    },
  };

  const titlePara: Paragraph = {
    type: "paragraph",
    children: titleChildren,
    data: { hProperties: { "data-callout-title": "true" } },
  };
  const replacement: Array<Paragraph> = [titlePara];
  if (bodyChildren.length > 0) {
    replacement.push({ type: "paragraph", children: bodyChildren });
  }
  node.children.splice(0, 1, ...replacement);
}

function mdastText(nodes: ReadonlyArray<unknown>): string {
  let out = "";
  for (const n of nodes) {
    if (!n || typeof n !== "object") continue;
    const node = n as { type?: string; value?: string; children?: unknown[] };
    if (node.type === "text" && typeof node.value === "string") out += node.value;
    else if (Array.isArray(node.children)) out += mdastText(node.children);
  }
  return out;
}

function coalesceWikilinks(children: Array<RootContent | PhrasingContent>): void {
  for (let i = 0; i + 2 < children.length; i++) {
    const a = children[i];
    const b = children[i + 1];
    const c = children[i + 2];
    if (!a || !b || !c) continue;
    if (a.type !== "text") continue;
    if (b.type !== "linkReference") continue;
    if (c.type !== "text") continue;

    const isEmbed = a.value.endsWith("![");
    const isLink = !isEmbed && a.value.endsWith("[");
    if (!isLink && !isEmbed) continue;
    if (!c.value.startsWith("]")) continue;

    const label = mdastText(b.children ?? []).trim();
    if (!label) continue;

    const beforeLen = isEmbed ? 2 : 1;
    const before = a.value.slice(0, a.value.length - beforeLen);
    const after = c.value.slice(1);
    const merged = `${isEmbed ? "![[" : "[["}${label}]]`;
    const newText: Text = { type: "text", value: `${before}${merged}${after}` };

    children.splice(i, 3, newText);
    i -= 1;
  }
}

function walk(nodes: Array<RootContent | PhrasingContent>): void {
  coalesceWikilinks(nodes);
  applyHighlights(nodes);
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!node) continue;

    if (node.type === "code" || node.type === "inlineCode" || node.type === "link") {
      continue;
    }

    if (node.type === "blockquote") {
      processCallout(node);
    }

    if (node.type === "paragraph") {
      extractTrailingBlockId(node);
    }

    if (node.type === "text") {
      const replacement = splitText(node.value);
      if (
        replacement.length !== 1 ||
        replacement[0]?.type !== "text" ||
        (replacement[0] as Text).value !== node.value
      ) {
        nodes.splice(i, 1, ...replacement);
        i += replacement.length - 1;
      }
      continue;
    }

    if ("children" in node && Array.isArray(node.children)) {
      walk(node.children as Array<RootContent | PhrasingContent>);
    }
  }
}

const remarkObsidian: Plugin<[], Root> = () => (tree: Root) => {
  walk(tree.children);
};

export default remarkObsidian;
