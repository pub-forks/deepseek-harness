---
description: "Read-only Gaia Obsidian-style Markdown preview for DSH documents."
kind: "package-reference"
---

# @deepseek-ai/dsh-gaia-ui-markdown

English | [中文](README.zh.md)

## Summary

This Gaia overlay plugin replaces DSH's builtin `.md` and `.markdown` document preview with Gaia's read-only Obsidian-flavored renderer. It uses GFM, Gaia's remark plugin and frontmatter parser, Gaia's sanitization schema, Prism highlighting, and lazily loaded Mermaid diagrams. Wikilinks, relative file links and image embeds resolve from the current document; file navigation uses the Sidebar resource action.

## Table of Contents

- [Use this package](#use-this-package)
- [Dev Note](#dev-note)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

Mount `gaia-ui-markdown` in `packages/gaia/profile-gaia/gaia.patch.yml`. Its `extension` priority band is ranked above the builtin document renderer, and its keyed `sidebar.right.tab.document` contribution applies wherever DSH renders document previews. The renderer is read-only: GFM task-list checkboxes remain disabled. The host continues to own document reads and images use the authenticated file-media route.

The remark plugin, frontmatter parser and wikilink path helpers are copied from Gaia's web viewer. Keep those ports aligned with their source files. Raw HTML is parsed and sanitized with the Gaia schema before rendering. Mermaid is dynamically imported and initialized with `securityLevel: 'strict'`.

## Dev Note

This package has no service invariant companion: its definition and keyed body are registered and disposed through the plugin's Cordis effects.

## Model Experience

### Document preview

#### What the model sees

No direct contribution. The plugin only changes browser rendering of files opened in the document Sidebar.

#### Token effect

This package adds no request tokens.

#### KV Cache effect

This package does not assemble model requests.

## Known Limitations and Deferred Work

- Task list editing and document editing remain in Gaia's web application.
