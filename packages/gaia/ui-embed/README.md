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

Both modes add Read aloud, Stop reading and Read-aloud instructions to finalized assistant replies. Explicit clicks send only reply text (not reasoning or tool output) to Gaia’s shared speech player through a same-origin, exact-parent bridge. Gaia applies the Markdown viewer’s voice settings, instructions and translation preferences; its global player supplies pause/resume. Complete requests are limited to 200,000 UTF-8 bytes. Unavailable or disabled output cannot start narration; leaving the message or frame cancels only that frame’s playback, including deferred model-download replay.

Gaia Voice → Read aloud offers an off-by-default “Automatically read completed Harness answers” setting. While a session input is mounted, only live successful turn completion requests narration of the final assistant reply. Historical loads, reconnect replacements, older-page loads, failed/cancelled turns and intermediate responses never start playback. Automatic reads reuse saved instructions and translation without consuming one-shot settings, wait behind current playback, and are deduplicated across frames. Pending reads are removed when their session/frame leaves. Gaia retains at most 20 queued replies and 1,000 recent automatic identities per page; the manual controls remain available. Browser autoplay rules may require an initial user gesture.

In embed mode, document preview actions use the resolved absolute file path to ask Gaia to open the file in its editor or reveal it in Gaia Explorer. This replaces the preview's native desktop actions only inside the embed; the full Harness shell keeps its normal behavior.

Agent embeds route turn changes-review resources into a read-only Gaia editor tab using bounded session, event, turn and selected-file coordinates. Gaia reads the original summary and comparison hunks through its session-bound runtime proxy; it does not substitute the current Git diff. Full mode keeps the native Harness review sidebar.

While focus is inside the embed, `Ctrl/Cmd+Alt+H` toggles Gaia's Harness drawer and `Ctrl/Cmd+Alt+M` toggles its maximize state. The embed captures only those exact, non-repeating chords and sends a closed drawer intent through the same-origin bridge; the full shell does not forward them.

-----

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
