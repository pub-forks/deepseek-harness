---
description: "Archive completed Sessions created by scheduled tasks."
kind: "package-reference"
---

# @deepseek-ai/dsh-gaia-schedule-archive

## Summary

Archives the fresh Session created for each new-target scheduled delivery after its Agent is idle and the delivered turn completed safely. It leaves failed, pending-interaction, user-taken-over, and pinned Sessions visible.

## Model Experience

This plugin adds no model-visible tools, prompt text, or Session events. It observes Scheduler receipts and Session history, then updates the Workspace archive registry.

## Known Limitations

The restart sweep checks at most 100 tasks and 20 recent receipts per task from the last seven days. Receipt retention and these bounds can leave older Sessions visible.
