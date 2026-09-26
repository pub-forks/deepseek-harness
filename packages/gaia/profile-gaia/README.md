---
description: "Gaia's patch overlay for the shipped web profile."
kind: "package-reference"
---

# Gaia web profile overlay

English | [中文](README.zh.md)

## Summary

Gaia launches the shipped `web` profile with `--patch` pointing to `gaia.patch.yml`. The overlay binds the host to loopback, prints the tokenized URL without opening a browser, disables HMR and product telemetry, enables the stored-OAuth `openai-codex` route, and mounts the Gaia control bridge. The base bundle already stores session JSONL beneath `$DSH_HOME/sessions`.

## Table of Contents

- [Use this package](#use-this-package)
- [Dev Note](#dev-note)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

The launcher receives `--profile web --patch <absolute path to gaia.patch.yml> --port 0 --no-open`. `--patch` is a launcher flag and precedes the Web app flags. The Gaia server supplies `DSH_HOME` and `GAIA_CONTROL_SECRET` in the child environment.

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

- This overlay provides the host control API only; browser sign-in and session embed plugins are separate packages.

