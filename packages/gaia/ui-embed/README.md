---
description: "Gaia iframe embed plugin for single-session conversation views."
kind: "package-reference"
---

# @deepseek-ai/dsh-gaia-ui-embed

English | [中文](README.zh.md)

## Summary

This private client plugin supports two Gaia iframe modes. Both receive Gaia's theme, palette and visual skin through the validated postMessage bridge, and both use the Gaia mark and **Gaia Harness** name in the sidebar, hero, document title, favicon and product-name locale copy. Embed mode additionally presents one session as a drawer chat and hides shell chrome; full mode keeps the complete DSH shell, including its navigation and settings.

## Table of Contents

- [Use this package](#use-this-package)
- [Dev Note](#dev-note)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

Mount the plugin in the Gaia web profile patch overlay. It activates inside an iframe for `gaia=embed` (with a valid `session` to enable chat behavior) or `gaia=full` (the complete shell). Outside an iframe it does nothing. Both modes post `ready` once, accept same-origin validated theme messages, apply Gaia branding, and observe the loaded Workspace list. Workspace additions, removals and renames post the payload-free `{ source: 'gaia-dsh', v: 1, type: 'workspacesChanged' }` message after a 500 ms debounce; Gaia then runs local project/workspace reconciliation. The plugin restores the prior title and icon links when disposed. Only embed mode opens and enforces a session, removes navigation chrome and enables drawer-specific commands and controls.

-----

<a id="dev-note"></a>
## Dev Note

No runtime invariant companion applies: this plugin's registration and disposal are owned by its existing Cordis service or effect lifecycle.

-----

<a id="model-experience"></a>
## Model Experience

### Gaia iframe modes

#### What the model sees

No direct contribution. Both modes apply the Gaia skin; embed mode additionally adjusts the `data-gaia-embed` viewport without altering model prompts.

#### Token effect

This package adds no request tokens.

#### KV Cache effect

This package does not assemble model requests.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Fullscreen rightbar actions remain suppressed while embed mode is active to preserve single-pane drawer ergonomics.
