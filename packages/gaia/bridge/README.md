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

Mount this plugin in the Gaia Web overlay and supply the secret in the DSH child environment. Workspace endpoints are `GET workspaces` (with live directory status), `POST workspaces/ensure { path, title? }`, and `POST workspaces/rename { workspaceId, title }`; titles are trimmed and capped at 120 characters. Other endpoints include session create/list/rename/archive/unarchive and `GET activity`. `GET/PUT config-document` edits the active profile patch with YAML validation, SHA-256 preconditions, a 1 MiB file cap, and atomic replacement. `GET profile-files` lists only `cordis.patch.yml`, `cordis.yml`, `package.json`, and `pnpm-workspace.yaml`; `GET/PUT profile-files/:name` reads or updates one of those fixed names. File writes use SHA-256 preconditions, format validation, and atomic replacement. Request bodies are limited to 16 KiB on existing routes and 1.25 MiB for document and profile-file writes.

The bridge mounts its workspace-model child plugin for both drawer and Gaia agent creation. Committed `model/selection` events record a workspace's latest choice; a scoped `sessionController.create` decorator uses the public `agents.create` setup callback to append that choice before API routing setup. Forks, resumes, subagents and existing explicit choices retain their selection. Catalog or exact-route/effort failures silently keep the normal default. Automatic restoration never calls `selectModel` or saves the global default; explicit selection retains upstream behavior.

`$DSH_HOME/gaia-workspace-models.json` is a JSON object keyed by canonical session cwd, with `{ provider, model, reasoningEffort?, updatedAt }` values (`updatedAt` is Unix milliseconds). Atomic temp-file replacement writes mode `0600`; missing, unreadable or corrupt files start empty. The 500 most recent workspaces are retained, including across reloads. Only identifiers are stored; credentials, bodies and errors are never logged. Writes are serialized and drained at session flush and plugin teardown.

-----

<a id="dev-note"></a>
## Dev Note

No runtime invariant companion applies: route registration and disposal belong to the same `webServer` table, and workspace preferences have one store owner. The child plugin restores its public method decorators and removes observers on disposal.

-----

<a id="model-experience"></a>
## Model Experience

### Host control

#### What the model sees

New ordinary sessions route to the workspace's available remembered provider/model and effort. This uses the existing logged `model/selection` event; it contributes no new prompt text.

#### Token effect

This package adds no request tokens.

#### KV Cache effect

This package selects the initial route; upstream model-selection routing owns prompt assembly and cache behavior.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Agents opened on a subfolder use a separate workspace preference. Preferences are scoped to the single per-user DSH runtime; there is no cross-process writer coordination.
- `GET activity` counts running Agents, but the Gateway publishes no live browser event-stream connection count. It reports `attachedClients: 0` and `approximate: true`; Gaia must not use that value alone to stop a runtime while browser clients may be attached.
