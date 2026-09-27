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
/* Send/stop button: accent fill with a glyph in the page background color
   (black on dark themes, white on light ones); on hover the colors reverse
   (page-background fill, accent glyph) instead of DSH's blue hover. The
   accent ring keeps the reversed button visible against the page. */
html[data-gaia-embed] [data-composer-primary] {
  color: var(--dsw-alias-bg-base) !important;
}
html[data-gaia-embed] [data-composer-primary]:hover:not(:disabled) {
  background: var(--dsw-alias-bg-base) !important;
  color: var(--dsw-alias-button-info-fill) !important;
  box-shadow: inset 0 0 0 1px var(--dsw-alias-button-info-fill) !important;
}

/* The /resume popup lists session titles with a badge and a relative time;
   DSH's compact 220px card truncates them, so widen it (still capped at the
   composer width by the card's own max-width). */
html[data-gaia-embed] :has(> [role="listbox"][aria-label^="/resume"]) {
  min-width: min(480px, 100%);
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
