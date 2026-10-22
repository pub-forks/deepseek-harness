---
description: "Gaia's patch overlay for the shipped web profile."
kind: "package-reference"
---

# Gaia web profile overlay

English | [中文](README.zh.md)

## Summary

Launch DSH's `web` profile with Gaia branding, browser sign-in, and the control bridge enabled. The patch binds to loopback and leaves model-provider settings under the user's profile so Settings → Models can edit them. The bridge seeds an OAuth `openai-codex` route only when no pi-ai routes exist and disables session-log uploads unless the profile enables them.

## Table of Contents

- [Use this package](#use-this-package)
- [Dev Note](#dev-note)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

The launcher receives `--profile web --patch <absolute path to gaia.patch.yml> --port 0 --no-open`. `--patch` is a launcher flag and precedes the Web app flags. The Gaia server supplies `DSH_HOME` and `GAIA_CONTROL_SECRET` in the child environment. The existing bridge mount also activates [workspace model memory](../bridge/README.md#use-this-package) for new drawer and agent sessions.

-----

<a id="dev-note"></a>
## Dev Note

No runtime invariant companion applies: this package exports a patch asset and a filename constant, not a mutable service.

-----

<a id="model-experience"></a>
## Model Experience

### Profile overlay

#### What the model sees

No direct contribution; `gaia.patch.yml` selects content owned by other plugins.

#### Token effect

This package adds no request tokens.

#### KV Cache effect

This package neither assembles nor sends model requests.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- This overlay provides browser sign-in through separate Gaia packages. The session embed plugin is added in a later phase.
