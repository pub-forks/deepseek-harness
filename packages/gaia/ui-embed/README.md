---
description: "Gaia iframe embed plugin for single-session conversation views."
kind: "package-reference"
---

# @deepseek-ai/dsh-gaia-ui-embed

English | [中文](README.zh.md)

## Summary

This private client plugin activates when the page loads with query parameters specifying embed mode for a single session. It hides the navigation and window chrome, suppresses navigation shortcuts, and manages postMessage communication with the host frame.

## Table of Contents

- [Use this package](#use-this-package)
- [Dev Note](#dev-note)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

Mount the plugin in the Gaia web profile patch overlay. The browser bundle activates only when `gaia=embed` and a valid `session` query parameter are present in the location search.

-----

<a id="dev-note"></a>
## Dev Note

No runtime invariant companion applies: this plugin's registration and disposal are owned by its existing Cordis service or effect lifecycle.

-----

<a id="model-experience"></a>
## Model Experience

### Gaia iframe embed

#### What the model sees

No direct contribution; embed presentation adjusts `data-gaia-embed` browser viewports without altering model prompts.

#### Token effect

This package adds no request tokens.

#### KV Cache effect

This package does not assemble model requests.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Fullscreen rightbar actions remain suppressed while embed mode is active to preserve single-pane drawer ergonomics.
