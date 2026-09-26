---
description: "Gaia's generic browser sign-in Settings section."
kind: "package-reference"
---

# @deepseek-ai/dsh-gaia-ui-authorization

English | [中文](README.zh.md)

## Summary

This private client plugin registers a localized Sign-in section in Settings. It renders every registered authorization flow through the Gaia Remote, including notices, device codes, prompts, cancellation, and confirmed sign-out. The section keeps secret answers in its input state and sends them only through `answer`.

## Table of Contents

- [Use this package](#use-this-package)
- [Dev Note](#dev-note)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

Mount the plugin in Gaia's patch overlay with the host authorization controller. The Client module table loads its browser bundle automatically through `dsh.client`. A device-code method is preferred when offered; for the Codex method picker, the device-code option starts selected while manual callback text remains available.

-----

<a id="dev-note"></a>
## Dev Note

No runtime invariant companion applies: this plugin's registration and disposal are owned by its existing Cordis service or slot lifecycle.

-----

<a id="model-experience"></a>
## Model Experience

### Gaia sign-in

#### What the model sees

No direct contribution; sign-in changes credentials that an LLM provider may use on later requests.

#### Token effect

This package adds no request tokens.

#### KV Cache effect

This package does not assemble model requests.

<a id="known-limitations-and-deferred-work"></a>
## Known Limitations and Deferred Work

The credential seam exposes no account or expiry metadata, so the row shows presence without those details.
