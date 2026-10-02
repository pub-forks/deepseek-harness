---
description: "Gaia iframe embed plugin for single-session conversation views."
kind: "package-reference"
---

# @deepseek-ai/dsh-gaia-ui-embed

English | [中文](README.zh.md)

## Summary

This private client plugin supports two Gaia iframe modes. Both receive Gaia's theme, palette and visual skin through the validated postMessage bridge, and both use the Gaia mark and **Gaia Harness** name in the sidebar, hero, document title, favicon and product-name locale copy. Embed mode additionally presents one session as a drawer chat and hides shell chrome; full mode keeps the complete DSH shell, including its navigation and settings.

## Table of Contents

- [Use this package](#use-this-package)
- [Dev Note](#dev-note)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

Mount the plugin in the Gaia web profile patch overlay. It activates inside an iframe for `gaia=embed` (with a valid `session` to enable chat behavior) or `gaia=full` (the complete shell). Outside an iframe it does nothing. Both modes post `ready` once, accept same-origin validated theme messages, apply Gaia branding, and observe the loaded Workspace list. Workspace additions, removals and renames post the payload-free `{ source: 'gaia-dsh', v: 1, type: 'workspacesChanged' }` message after a 500 ms debounce; Gaia then runs local project/workspace reconciliation. The plugin restores the prior title and icon links when disposed. Only embed mode opens and enforces a session, removes navigation chrome and enables drawer-specific commands and controls.

Both modes let unmodified Up at the draft start recall older human plain-text messages from the loaded Session window; Down moves forward and restores the unsent draft beyond the newest message. Traversal can reverse at either document edge; interior multiline movement, command menus, IME composition and modified or repeated arrows remain native. Each mounted input retains at most 100 complete messages and 512 KiB of UTF-8 serialized history, including metadata; oversized messages are omitted, not truncated. Attachments, references, locked or busy inputs and pending uploads disable recall. History uses existing committed append events, never reconstructs attachments, and adds no separate prompt database or transport. Recalled text still participates in the existing draft persistence mirror.

Both modes add Read aloud, Stop reading and Read-aloud instructions to finalized assistant replies. Explicit clicks send only reply text (not reasoning or tool output) to Gaia’s shared speech player through a same-origin, exact-parent bridge. Gaia applies the Markdown viewer’s voice settings, instructions and translation preferences; its global player supplies pause/resume. Complete requests are limited to 200,000 UTF-8 bytes. Unavailable or disabled output cannot start narration; leaving the message or frame cancels only that frame’s playback, including deferred model-download replay.

Session rows, including search results, show small sound-wave bars labelled "Reading aloud" for the session identified by the parent playback state, spaced away from the time label. The bars stay still during preparation, loading and pause, animate during speech, respect reduced-motion preferences, and disappear on idle or a different session. This decoration uses a root-scoped slot and never activates or retains a session.

Manual and automatic narration include an optional `workspacePath` from the owning session's catalog, read when the request is sent. Absolute POSIX paths are limited to 4,096 characters and exclude NUL, newline, carriage return and tab; invalid or unknown paths are omitted. Gaia labels playback with the matching local project name or the folder basename, truncates names to 32 characters, and keeps “Harness response” when no name is available.

Gaia Voice → Read aloud offers an off-by-default “Automatically read completed Harness answers” setting. While a session input is mounted, only live successful turn completion requests narration of the final assistant reply. Historical loads, reconnect replacements, older-page loads, failed/cancelled turns and intermediate responses never start playback. Automatic reads reuse saved instructions and translation without consuming one-shot settings, wait behind current playback, and are deduplicated across frames. Pending reads are removed when their session/frame leaves. Gaia retains at most 20 queued replies and 1,000 recent automatic identities per page; the manual controls remain available. Browser autoplay rules may require an initial user gesture.

In embed mode, document preview actions use the resolved absolute file path to ask Gaia to open the file in its editor or reveal it in Gaia Explorer. This replaces the preview's native desktop actions only inside the embed; the full Harness shell keeps its normal behavior.

Agent embeds route turn changes-review resources into a read-only Gaia editor tab using bounded session, event, turn and selected-file coordinates. Gaia reads the original summary and comparison hunks through its session-bound runtime proxy; it does not substitute the current Git diff. Full mode keeps the native Harness review sidebar.

Both iframe modes forward Gaia's allowlisted, non-repeating `Ctrl/Cmd+Alt` application chords through the same-origin bridge, including `V` for dictation, `Shift+V` for task dictation and `R` for read aloud. Only J, E and V permit Shift; AltGraph and simultaneous Ctrl+Cmd are rejected. Dictation uses the sending iframe's composer without moving focus. A V release following a forwarded press sends `phase: 'keyup'` even if modifiers were released first, preserving push-to-talk; keydown messages omit phase. H and M send closed Harness drawer toggle/maximize intents in both modes. Listeners are removed on disposal.

-----

In embed mode, message branching records the child returned by this frame's successful `sessions.fork` call for the pinned session (`atSeq` and `increaseTitle: true`). When chat displays that child, the plugin posts `{ source: 'gaia-dsh', v: 1, type: 'branched', sessionId }` once and restores the pinned session. Gaia creates or focuses a separate project agent for the child. Shared session-list changes, startup restores, `/resume` selections and subagents do not emit this message; full mode keeps native fork navigation. The fork method is restored on disposal.

<a id="dev-note"></a>
## Dev Note

No runtime invariant companion applies: this plugin's registration and disposal are owned by its existing Cordis service or effect lifecycle.

-----

<a id="model-experience"></a>
## Model Experience

### Gaia iframe modes

#### What the model sees

No direct contribution. Both modes apply the Gaia skin; embed mode additionally adjusts the `data-gaia-embed` viewport without altering model prompts.

#### Token effect

This package adds no request tokens.

#### KV Cache effect

This package does not assemble model requests.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Fullscreen rightbar actions remain suppressed while embed mode is active to preserve single-pane drawer ergonomics.
