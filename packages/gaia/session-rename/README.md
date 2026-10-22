---
description: "Rename the current Gaia Harness session with /rename or an explicit user request."
kind: "package-reference"
---

# @deepseek-ai/dsh-gaia-session-rename

English | [中文](README.zh.md)

## Summary

This Gaia Host plugin registers `/rename [title]` and the `rename_session` model tool. Both write a user-sourced title through `SessionTitleService`; the model tool can target only its calling agent's current session and requires a direct human turn.

## Table of Contents

- [Use this package](#use-this-package)
- [Dev Note](#dev-note)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

<a id="use-this-package"></a>
## Use this package

The Gaia overlay mounts this Host plugin with the command and tool services. It has no configuration. `/rename [title]` accepts one free-form title. A supplied title is normalized and applied immediately; an empty input asks the agent to propose a concise title from the conversation and apply it with `rename_session`. Attachments are refused.

The `rename_session` tool accepts only `title`. The title service normalizes accepted text and rejects titles with no visible characters. Tool calls require the active root agent and a user-sourced message in the current open turn, so autonomous continuation rounds and child agents cannot rename a session. The tool uses the registry's exclusive execution mode and adds no permission override.

## Dev Note

[`src/index.ts`](src/index.ts) registers the Host command and model tool. [`tests/cordis.yml`](tests/cordis.yml) declares the services used by the plugin. The package owns no mutable state or independently derived observations, so it publishes no runtime invariant entry.

<a id="model-experience"></a>
## Model Experience

### Explicit session rename

#### What the model sees

The tool description limits `rename_session` to an explicit request or confirmation, and the schema accepts only a title.

##### Tool input

```markdown
Use `rename_session` only when the user explicitly asks to rename or title this session, or confirms a proposed title. The tool accepts one required string field, `title`, and no session identifier.
```

##### Empty command follow-up

```markdown
Propose a concise title for this session based on our conversation, then apply it with `rename_session`.
```

#### Token effect

The tool adds no model-visible message. The title service records a `session/title` event. The empty command adds one user follow-up; a direct `/rename title` command does not.

#### KV Cache effect

Renaming does not change the system prompt or earlier conversation messages. The follow-up form appends to ordinary history.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- `/rename [title]` is a direct user command and does not require a model turn. The model tool remains constrained to explicit human authority in the current turn.
