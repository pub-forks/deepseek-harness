---
description: "Gaia Markdown and editable .tasks previews for DSH documents."
kind: "package-reference"
---

# @deepseek-ai/dsh-gaia-ui-markdown

English | [中文](README.zh.md)

## Summary

Preview Markdown with Gaia's Obsidian-style renderer, including GFM, wikilinks, frontmatter, syntax highlighting, and Mermaid. Settled `mermaid` fences in Harness Chat use Gaia's parent bridge; streaming, standalone, and failed renders retain code. In Gaia, valid absolute `.tasks` paths open Cockpit's task viewer in a same-origin iframe; standalone or invalid paths use the package renderer. Markdown reads and standalone task writes use DSH Host Remotes; images use the file-media route and navigation uses Sidebar actions.

## Table of Contents

- [Use this package](#use-this-package)
- [Dev Note](#dev-note)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

Mount `gaia-ui-markdown` in `packages/gaia/profile-gaia/gaia.patch.yml`. Its `extension` priority band is ranked above the builtin document renderer, and its keyed `sidebar.right.tab.document` contributions render Markdown and `.tasks` files wherever DSH shows document previews. Markdown remains read-only. Inside a Gaia iframe, the `.tasks` renderer detects the `data-gaia-full` or `data-gaia-embed` document-root attribute and requires an absolute path without `.` or `..` segments; it then fills the preview with Gaia's `/embed/tasks?path=…` viewer. The iframe uses the Gaia origin root and has no sandbox attribute. Without that Gaia signal, or with an invalid path, the existing `.tasks` task renderer is used; its edits use a version-guarded `gaiaTasks` Host Remote and preserve fields the preview does not render. `.tasks` notes render as plain text, and images use the authenticated file-media route.

The remark plugin, frontmatter parser and wikilink path helpers are copied from Gaia's web viewer. Keep those ports aligned with their source files. Raw HTML is parsed and sanitized with the Gaia schema before rendering. Mermaid is not bundled: its async chunks cannot load through the client module table. The shared Mermaid renderer posts `renderMermaid {reqId, code, dark}` to the Gaia parent, which renders with its own Mermaid at `securityLevel: 'strict'` and replies `mermaidRendered {reqId, svg | error}`. The document viewer shows source outside a Gaia frame, or on error or timeout (15 s). Chat uses the session-scoped `conversation.chat.markdown.fence` layer keyed by `mermaid`; it shows the plain code while streaming, then the diagram, and falls back to the code after an error, timeout or standalone render. The client build maps vfile's `#minpath`/`#minproc`/`#minurl` to their browser variants so the bundle never requires node builtins.

## Dev Note

This package has no service invariant companion: its definition and keyed body are registered and disposed through the plugin's Cordis effects.

## Model Experience

### Chat Mermaid fences

#### What the model sees

No model-visible change. Chat renders settled Mermaid fences from the existing Assistant response.

#### Token effect

This package adds no request tokens.

#### KV Cache effect

This package does not assemble model requests.

### Document preview

#### What the model sees

No direct contribution. The plugin renders Markdown opened through a `dsh-resource://file/...` address and does not add prompt context.

#### Token effect

This package adds no request tokens.

#### KV Cache effect

This package does not assemble model requests.

## Known Limitations and Deferred Work

- Markdown editing remains in Gaia's web application.
- Standalone `.tasks` previews load the complete file, so a file above the document preview's complete-read cap does not open; due dates, tags, and notes are read-only and steps can only be checked there. Embedded Gaia previews use the Cockpit task viewer instead.
