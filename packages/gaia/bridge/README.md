---
description: "Gaia's loopback host control API for workspaces, sessions, and runtime activity."
kind: "package-reference"
---

# Gaia bridge

English | [中文](README.zh.md)

## Summary

`@deepseek-ai/dsh-gaia-bridge` registers `/gaia/control/` on the Host webserver for Gaia's server. Calls require a loopback peer and `Authorization: Bearer <GAIA_CONTROL_SECRET>`. The secret is sampled once at activation; a missing or shorter than 32-character value makes every request return 503. Responses are JSON with `Cache-Control: no-store`; errors omit stacks and request bodies are never logged.

## Table of Contents

- [Use this package](#use-this-package)
- [Dev Note](#dev-note)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

Mount this plugin in the Gaia Web overlay and supply the secret in the DSH child environment. Workspace endpoints are `GET workspaces` (with live directory status), `POST workspaces/ensure { path, title? }`, and `POST workspaces/rename { workspaceId, title }`; titles are trimmed and capped at 120 characters. Other endpoints include session create/list/rename/archive/unarchive and `GET activity`. `POST remote` invokes an allowlisted unary Remote; `POST streams` opens an allowlisted stream Remote, `GET streams/:id?after=` long-polls buffered items, and `DELETE streams/:id` cancels it. The Remote allowlist is in `src/allowlist.ts`; all other methods return `not_allowed`. `GET/PUT config-document` edits the active profile patch with YAML validation, SHA-256 preconditions, a 1 MiB file cap, and atomic replacement. `GET profile-files` lists only `cordis.patch.yml`, `cordis.yml`, `package.json`, and `pnpm-workspace.yaml`; `GET/PUT profile-files/:name` reads or updates one of those fixed names. File writes use SHA-256 preconditions, format validation, and atomic replacement. Request bodies are limited to 16 KiB on existing routes, 256 KiB for Remote calls, and 1.25 MiB for document and profile-file writes.

-----

<a id="dev-note"></a>
## Dev Note

No runtime invariant companion applies: route registration and disposal belong to the same `webServer` table.

-----

<a id="model-experience"></a>
## Model Experience

### Host control

#### What the model sees

No direct contribution; the `/gaia/control/` routes do not write model requests.

#### Token effect

This package adds no request tokens.

#### KV Cache effect

This package neither assembles nor sends model requests.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- `GET activity` counts running Agents, but the Gateway publishes no live browser event-stream connection count. It reports `attachedClients: 0` and `approximate: true`; Gaia must not use that value alone to stop a runtime while browser clients may be attached.
