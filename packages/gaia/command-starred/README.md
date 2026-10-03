---
description: "Gaia's /starred command for sequential work on important project tasks."
kind: "package-reference"
---

# @deepseek-ai/dsh-gaia-command-starred

English | [中文](README.zh.md)

## Summary

`/starred` sends the invoking agent a user follow-up requesting work on unfinished important tasks. The plugin performs no file, shell, or network operations.

## Table of Contents

- [Use this package](#use-this-package)
- [Dev Note](#dev-note)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

<a id="use-this-package"></a>
## Use this package

The Gaia overlay mounts this Host plugin beside the commands service. It has no configuration fields. Usage: `/starred [inline|subagent] [model] [--release]`.

Words split on whitespace. Exact `--release` words anywhere enable a release request. The first remaining word selects `inline` or `subagent` case-insensitively; otherwise the mode is `subagent`. Remaining words form the model name with single spaces. Inline mode ignores the model. Attachments are refused.

The prompt locates the tasks file through `tasks.default` in `.gaia/settings.json`, falling back to `.ai/ToDo.tasks`. It requests only unfinished `important: true` tasks, allows related groups, and asks for a commit before moving on. Subagent mode requests sequential delegation, review, and commit. After each commit it requests completion fields and a fresh read that preserves every other task and field. `--release` requests a release under the project's own rules after every starred task is committed.

The confirmation is `starred: inline` or `starred: subagent [model] · sequential`, with ` · release after` when requested. Unexpected follow-up failures propagate to command dispatch.

<a id="dev-note"></a>
## Dev Note

[`src/index.ts`](src/index.ts) exports the parser, prompt builder, confirmation formatter, and Cordis plugin. Registration is disposed with the plugin. No runtime invariant companion is published because the plugin owns no mutable state or independently derived observations.

<a id="model-experience"></a>
## Model Experience

### Starred task follow-up

#### What the model sees

One ordinary user message carries the workflow instructions. Subagent mode includes the exact instruction `DO NOT RUN SUBAGENTS IN PARALLEL. WAIT FOR ONE TO FINISH -> REVIEW -> COMMIT -> NEXT TASK.` The slash input and direct confirmation stay in the command UI; the follow-up enters normal session history through the agent.

#### Token effect

Each accepted command adds one text message containing the workflow and optional model name. Rejected attachments add no message.

#### KV Cache effect

The follow-up appends to ordinary conversation history without changing the system prompt or earlier messages.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- The command supplies instructions; the agent's available tools and permissions determine execution. It neither mounts a subagent provider nor verifies task-file edits, commits, or releases. Model names are prompt text and are not validated against a registry.
