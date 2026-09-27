/**
 * Scoped styles for the Gaia iframe embed mode.
 */

/** DOM identifier for the injected embed style tag. */
export const GAIA_EMBED_STYLE_ID = 'gaia-embed-styles'

/** CSS applied when html has the data-gaia-embed attribute. */
export const GAIA_EMBED_CSS = `
/* The side columns below are display:none, which removes them from grid
   auto-placement: the conversation column becomes the only in-flow item, so
   the frame must be a single track. A three-track "0 1fr 0" template put the
   conversation in the first, 0px track and the embed rendered blank. */
html[data-gaia-embed] [data-app-frame] {
  grid-template-columns: minmax(0, 1fr) !important;
}
html[data-gaia-embed] [data-sidebar-col],
html[data-gaia-embed] [data-rightbar-col],
html[data-gaia-embed] [data-shell-leading],
html[data-gaia-embed] [data-side="sidebar"],
html[data-gaia-embed] [data-side="rightbar"],
html[data-gaia-embed] [data-conversation-header-leading],
html[data-gaia-embed] [data-conversation-header-corner] {
  display: none !important;
}

/* Composer: Gaia's agent composer look (page background, Gaia's border,
   12px corners), replacing DSH's gray pill. On focus a soft arc in Gaia's
   accent travels around the edge: the ::before is a conic-gradient ring
   masked to the border only, so it overlays the border with no reflow. */
@property --gaia-composer-angle {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
}
@keyframes gaia-composer-border-spin {
  to { --gaia-composer-angle: 360deg; }
}
html[data-gaia-embed] [data-composer-card] {
  position: relative;
  background: var(--dsw-alias-bg-base) !important;
  border: 1px solid var(--dsw-alias-border-l2) !important;
  border-radius: 12px !important;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.05) !important;
  transition: border-color 0.2s ease;
}
html[data-gaia-embed] [data-composer-card]:focus-within {
  border-color: color-mix(in oklch, var(--dsw-alias-link), transparent 50%) !important;
}
html[data-gaia-embed] [data-composer-card]::before {
  content: "";
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  padding: 1.5px;
  background: conic-gradient(
    from var(--gaia-composer-angle),
    transparent 0deg,
    color-mix(in oklch, var(--dsw-alias-link), transparent 70%) 18deg,
    color-mix(in oklch, var(--dsw-alias-link), white 40%) 45deg,
    color-mix(in oklch, var(--dsw-alias-link), transparent 70%) 72deg,
    transparent 92deg,
    transparent 360deg
  );
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  opacity: 0;
  transition: opacity 0.25s ease;
  pointer-events: none;
}
html[data-gaia-embed] [data-composer-card]:focus-within::before {
  opacity: 1;
  animation: gaia-composer-border-spin 5s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  html[data-gaia-embed] [data-composer-card]:focus-within::before { animation: none; }
}
/* Send/stop button: page-background fill with an accent glyph and accent
   ring at rest; on hover the colors reverse (accent fill, glyph in the page
   background color: black on dark themes, white on light ones) instead of
   DSH's blue hover. */
html[data-gaia-embed] [data-composer-primary] {
  background: var(--dsw-alias-bg-base) !important;
  color: var(--dsw-alias-button-info-fill) !important;
  box-shadow: inset 0 0 0 1px var(--dsw-alias-button-info-fill) !important;
}
html[data-gaia-embed] [data-composer-primary]:hover:not(:disabled) {
  background: var(--dsw-alias-button-info-fill) !important;
  color: var(--dsw-alias-bg-base) !important;
  box-shadow: none !important;
}

/* The model menu reserves 96px of the viewport by default, which leaves a
   drawer tab's short iframe only a few rows; let it use nearly all of it. */
html[data-gaia-embed] [data-model-menu] {
  max-height: calc(100vh - 24px) !important;
}

/* A drawer tab belongs to one Gaia project whose folder is already the
   session's workspace; the empty-session hero's workspace chip would let the
   user move the tab out of its project, so it is hidden. DSH's "Into the
   Unknown" headline is hidden with it, leaving the Gaia mark. */
html[data-gaia-embed] [data-hero-workspace],
html[data-gaia-embed] [data-hero-headline] {
  display: none !important;
}

/* The /resume popup spans the composer width. Each row reads: session title
   (takes the free space), relative last activity, then the status as a tag
   on the right. DSH's row nests the badge in the label span as a superscript;
   display:contents flattens that span so its children join the row's flex
   order. An "open" option's aria-label ends in " open" (label + badge). */
html[data-gaia-embed] :has(> [role="listbox"][aria-label^="/resume"]) {
  width: 100%;
  min-width: 100% !important;
}
/* DSH's floating "jump to latest" button sits over the popup's right edge
   (the status tags) in a short drawer; hide it while the list is open. */
html[data-gaia-embed]:has([role="listbox"][aria-label^="/resume"]) [data-chat-to-bottom] {
  visibility: hidden;
}
html[data-gaia-embed] [role="listbox"][aria-label^="/resume"] > [role="option"] {
  gap: 12px;
  padding: 7px 10px;
}
html[data-gaia-embed] [role="listbox"][aria-label^="/resume"] > [role="option"] > span:first-child {
  display: contents;
}
html[data-gaia-embed] [role="listbox"][aria-label^="/resume"] > [role="option"] > span:first-child > span {
  flex: 1 1 auto;
  order: 0;
}
html[data-gaia-embed] [role="listbox"][aria-label^="/resume"] > [role="option"] > span:not(:first-child) {
  flex: none;
  order: 1;
  font-variant-numeric: tabular-nums;
}
html[data-gaia-embed] [role="listbox"][aria-label^="/resume"] > [role="option"] sup {
  order: 2;
  align-self: center;
  margin: 0;
  min-width: 56px;
  padding: 0 7px;
  box-sizing: border-box;
  text-align: center;
  border: 1px solid var(--dsw-alias-border-l3);
  border-radius: 999px;
  font-size: 10px;
  line-height: 16px;
  font-weight: 500;
  vertical-align: baseline;
  color: var(--dsw-alias-label-tertiary);
}
html[data-gaia-embed] [role="listbox"][aria-label^="/resume"] > [role="option"][aria-label$=" open"] sup {
  border-color: color-mix(in srgb, var(--dsw-alias-link) 45%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-link) 12%, transparent);
  color: var(--dsw-alias-link);
}
`

/**
 * Inject the embed stylesheet into the document head if not already present.
 * @returns disposer function that removes the injected style element.
 */
export function injectEmbedStyles(): () => void {
  if (typeof document === 'undefined') return () => {}
  let styleEl = document.getElementById(GAIA_EMBED_STYLE_ID) as HTMLStyleElement | null
  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = GAIA_EMBED_STYLE_ID
    styleEl.textContent = GAIA_EMBED_CSS
    document.head.appendChild(styleEl)
  }
  return () => {
    styleEl.remove()
  }
}
