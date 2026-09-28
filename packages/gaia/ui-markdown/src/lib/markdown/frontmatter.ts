// Ported from gaia web/src/lib/markdown/frontmatter.ts — keep in sync.
export type PropScalar = string | number | boolean | null;
export type PropValue = PropScalar | PropScalar[];
export type PropEntry = { key: string; value: PropValue };

const INT_RE = /^-?\d+$/;
const FLOAT_RE = /^-?\d+\.\d+$/;

function stripQuotes(s: string): string {
  if (s.length < 2) return s;
  const first = s[0];
  const last = s[s.length - 1];
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return s.slice(1, -1);
  }
  return s;
}

function coerceScalar(raw: string): PropScalar {
  const v = raw.trim();
  if (v === "" || v === "null" || v === "~") return null;
  if (v === "true") return true;
  if (v === "false") return false;
  if (INT_RE.test(v)) return parseInt(v, 10);
  if (FLOAT_RE.test(v)) return parseFloat(v);
  return stripQuotes(v);
}

function splitFlowList(inner: string): string[] {
  const out: string[] = [];
  let buf = "";
  let inSingle = false;
  let inDouble = false;
  for (const ch of inner) {
    if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === "'" && !inDouble) inSingle = !inSingle;
    if (ch === "," && !inSingle && !inDouble) {
      out.push(buf.trim());
      buf = "";
    } else {
      buf += ch;
    }
  }
  if (buf.trim().length > 0) out.push(buf.trim());
  return out;
}

// Number of raw lines consumed by a leading `---`/`...` frontmatter block
// (0 if the document has none). Body line N (1-based, as reported by
// remark's `position.start.line`) corresponds to raw line N + offset.
export function frontmatterLineOffset(text: string): number {
  const lines = text.split(/\r?\n/);
  if (lines[0] !== "---") return 0;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === "---" || lines[i] === "...") return i + 1;
  }
  return 0;
}

export function parseFrontmatter(text: string): { props: PropEntry[]; body: string } {
  const lines = text.split(/\r?\n/);
  if (lines[0] !== "---") return { props: [], body: text };
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === "---" || line === "...") {
      end = i;
      break;
    }
  }
  if (end < 0) return { props: [], body: text };

  const yamlLines = lines.slice(1, end);
  const body = lines.slice(end + 1).join("\n");
  const props: PropEntry[] = [];

  let i = 0;
  while (i < yamlLines.length) {
    const line = yamlLines[i] ?? "";
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      i++;
      continue;
    }
    const m = /^([A-Za-z_][\w.-]*)\s*:\s*(.*)$/.exec(line);
    if (!m) {
      i++;
      continue;
    }
    const key = m[1] ?? "";
    const rest = (m[2] ?? "").trim();

    if (rest === "") {
      const items: PropScalar[] = [];
      i++;
      while (i < yamlLines.length) {
        const next = yamlLines[i] ?? "";
        const itemMatch = /^\s+-\s+(.*)$/.exec(next);
        if (!itemMatch) break;
        items.push(coerceScalar(itemMatch[1] ?? ""));
        i++;
      }
      props.push({ key, value: items });
      continue;
    }

    if (rest.startsWith("[") && rest.endsWith("]")) {
      const inner = rest.slice(1, -1).trim();
      const items = inner === "" ? [] : splitFlowList(inner).map(coerceScalar);
      props.push({ key, value: items });
      i++;
      continue;
    }

    props.push({ key, value: coerceScalar(rest) });
    i++;
  }

  return { props, body };
}
