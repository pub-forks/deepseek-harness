---
description: "Read-only Gaia Markdown and .tasks previews for DSH documents."
kind: "package-reference"
---

# @deepseek-ai/dsh-gaia-ui-markdown

English | [中文](README.zh.md)

## Summary

Preview Markdown files with Gaia's read-only Obsidian-style renderer, including GFM, wikilinks, frontmatter, syntax highlighting, and Mermaid diagrams. Preview `.tasks` files as read-only task lists with status, dates, steps, notes, and tags. These renderers replace DSH's built-in Markdown preview only in the Gaia overlay; file reads and image requests stay with the DSH host, and navigation uses Sidebar resource actions.

## Table of Contents

- [Use this package](#use-this-package)
- [Dev Note](#dev-note)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

Mount `gaia-ui-markdown` in `packages/gaia/profile-gaia/gaia.patch.yml`. Its `extension` priority band is ranked above the builtin document renderer, and its keyed `sidebar.right.tab.document` contributions render Markdown and `.tasks` files wherever DSH shows document previews. Both renderers are read-only: GFM task-list checkboxes remain disabled, and `.tasks` notes render as plain text. The host continues to own document reads and images use the authenticated file-media route.

The remark plugin, frontmatter parser and wikilink path helpers are copied from Gaia's web viewer. Keep those ports aligned with their source files. Raw HTML is parsed and sanitized with the Gaia schema before rendering. Mermaid is not bundled: its async chunks cannot load through the client module table. The viewer posts `renderMermaid {reqId, code, dark}` to the Gaia parent, which renders with its own Mermaid at `securityLevel: 'strict'` and replies `mermaidRendered {reqId, svg | error}`; outside a Gaia frame, or on error or timeout (15 s), the diagram source is shown. The client build maps vfile's `#minpath`/`#minproc`/`#minurl` to their browser variants so the bundle never requires node builtins.

## Dev Note

This package has no service invariant companion: its definition and keyed body are registered and disposed through the plugin's Cordis effects.

## Model Experience

### Document preview

#### What the model sees

No direct contribution. The plugin renders Markdown opened through a `dsh-resource://file/...` address and does not add prompt context.

#### Token effect

This package adds no request tokens.

#### KV Cache effect

This package does not assemble model requests.

## Known Limitations and Deferred Work

- Task list editing and document editing remain in Gaia's web application.
