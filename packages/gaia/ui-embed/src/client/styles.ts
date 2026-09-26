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
