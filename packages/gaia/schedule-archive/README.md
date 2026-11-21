---
description: "Archive completed Sessions created by scheduled tasks."
kind: "package-reference"
---

# @deepseek-ai/dsh-gaia-schedule-archive

English | [中文](README.zh.md)

## Summary

Archives the fresh Session created for each new-target scheduled delivery after its Agent is idle and the delivered turn completed safely. Failed, pending-interaction, user-taken-over, and pinned Sessions remain visible.

## Table of Contents

- [Behavior](#behavior)
- [Dev Note](#dev-note)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

## Behavior

The plugin observes Scheduler receipts and Session history, then updates the Workspace archive registry. It archives only Sessions whose scheduled turn completed and has no unresolved approval or question; failed turns stay visible when configured, and pinned Sessions are never archived.

## Dev Note

The controller owns its Schedule and Agent listeners and disposes both when the plugin unloads.

## Model Experience

### Scheduled delivery archive

#### What the model sees

This plugin adds no model-visible tools, prompt text, or Session events; `schedule` receipts and Session history remain Host-only data.

#### Token effect

This package adds no request tokens.

#### KV Cache effect

This package does not assemble model requests.

## Known Limitations and Deferred Work

- The restart sweep checks at most 100 tasks and 20 recent receipts per task from the last seven days; receipt retention and these bounds can leave older Sessions visible.
