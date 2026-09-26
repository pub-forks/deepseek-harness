---
description: "Gaia's loopback host control API for workspaces, sessions, and runtime activity."
kind: "package-reference"
---

# Gaia bridge

English | [中文](README.zh.md)

## Summary

`@deepseek-ai/dsh-gaia-bridge` registers `/gaia/control/` on the Host webserver for Gaia's server. Calls require a loopback peer and `Authorization: Bearer <GAIA_CONTROL_SECRET>`. The secret is sampled once at activation; a missing or shorter than 32-character value makes every request return 503. Responses are JSON with `Cache-Control: no-store`; errors contain a short code only.

## Table of Contents

- [Use this package](#use-this-package)
- [Dev Note](#dev-note)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

Mount this plugin in the Gaia Web overlay and supply the secret in the DSH child environment. `GET health` reports readiness and version. `POST workspaces/ensure` realpaths an absolute existing directory and returns its durable Workspace id. `POST sessions` creates a Session in a known Workspace and optionally renames it. `GET sessions?workspaceId=` lists that Workspace's Sessions. `POST sessions/:id/rename` renames one Session; `POST sessions/:id/archive` uses the registry archive operation with activity stopping. JSON bodies have a 16 KiB limit.

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

