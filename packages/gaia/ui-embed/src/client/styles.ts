/** Gaia skin and single-session drawer chrome for the iframe client. */

/** DOM identifier for the shared Gaia skin style tag. */
export const GAIA_SKIN_STYLE_ID = 'gaia-skin-styles'
/** DOM identifier retained for the embed-only chrome style tag. */
export const GAIA_EMBED_STYLE_ID = 'gaia-embed-styles'

const GAIA_FRAME = ':is(html[data-gaia-embed], html[data-gaia-full])'

/** Settings modal skin and maximize layout inside Gaia frames. */
export const GAIA_SETTINGS_CSS = `
${GAIA_FRAME} [data-shortcut-modal="settings"] {
  width: min(960px, calc(100vw - 48px));
  height: min(880px, calc(100vh - 2 * max(24px, var(--dsh-frame-top-clearance, 24px))));
  max-width: none;
  background: var(--dsw-alias-bg-base);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  transition: width 0.15s, height 0.15s;
  --dsw-radius-md: 6px;
  --dsw-radius-sm: 6px;
  --dsw-alias-brand-primary: var(--dsw-alias-link);
}
@media (prefers-reduced-motion: reduce) {
  ${GAIA_FRAME} [data-shortcut-modal="settings"] {
    transition: none;
  }
}
html[data-gaia-settings-maximized] [data-shortcut-modal="settings"] {
  width: calc(100vw - 16px);
  height: calc(100vh - 16px);
  border-radius: 8px;
}
${GAIA_FRAME} [data-shortcut-modal="settings"] nav {
  background: var(--dsw-alias-bg-layer-1);
  border-right: 1px solid var(--dsw-alias-border-l1);
}
${GAIA_FRAME} [data-shortcut-modal="settings"] nav button {
  border-radius: 6px;
  color: var(--dsw-alias-label-tertiary);
}
${GAIA_FRAME} [data-shortcut-modal="settings"] nav button:hover {
  color: var(--dsw-alias-label-primary);
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent);
}
${GAIA_FRAME} [data-shortcut-modal="settings"] nav button[aria-current="true"] {
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-link);
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.1);
}
${GAIA_FRAME} [data-shortcut-modal="settings"] nav button[aria-current="true"]:hover {
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-link);
}
${GAIA_FRAME} [data-shortcut-modal="settings"] nav button[aria-current="true"]:focus-visible:not([data-dsh-automatic-focus]) {
  box-shadow: 0 0 0 1px var(--dsw-alias-link);
}
${GAIA_FRAME} [data-shortcut-modal="settings"] :is(button, input, select, textarea):focus-visible:not([data-dsh-automatic-focus]) {
  outline: none;
  box-shadow: 0 0 0 1px var(--dsw-alias-link);
}
${GAIA_FRAME} [data-shortcut-modal="settings"] [data-gaia-settings-maximize] {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: var(--dsw-radius-sm);
  background: transparent;
  cursor: pointer;
  color: var(--dsw-alias-label-primary);
}
${GAIA_FRAME} [data-shortcut-modal="settings"] [data-gaia-settings-maximize]:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}
${GAIA_FRAME} [data-gaia-appearance] {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 0;
  border-bottom: 0.5px solid var(--dsw-alias-border-l2);
}
${GAIA_FRAME} [data-gaia-appearance-title] {
  font-size: 14px;
  font-weight: 400;
  line-height: 22px;
  color: var(--dsw-alias-label-primary);
}
${GAIA_FRAME} [data-gaia-appearance-body] {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
${GAIA_FRAME} [data-gaia-appearance-desc] {
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-secondary);
}
`

const GAIA_CONTROLS_SCOPE = `${GAIA_FRAME} :is([data-shortcut-modal="settings"], [data-dsh-modal])`

/** Controls inside Settings and Modal dialogs styled to match Gaia's shadcn design. */
export const GAIA_CONTROLS_CSS = `
/* Modal card styling for DSH Modal dialogs */
${GAIA_FRAME} [data-dsh-modal] {
  background: var(--dsw-alias-bg-base);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  --dsw-radius-md: 6px;
  --dsw-radius-sm: 6px;
}

/* Ensure exact box sizing on all controls */
${GAIA_CONTROLS_SCOPE} :is(button, [data-dsh-button], [data-dsh-select-trigger], input, textarea, div[data-dsh-input]) {
  box-sizing: border-box;
}

/* Base button defaults */
${GAIA_CONTROLS_SCOPE} [data-dsh-button] {
  box-sizing: border-box;
  border-radius: 6px;
  font-weight: 500;
  font-size: 12px;
  line-height: 18px;
  transition: background-color 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s;
}

/* Button default: primary buttons */
${GAIA_CONTROLS_SCOPE} [data-dsh-button="primary"] {
  box-sizing: border-box;
  height: 32px;
  padding: 0 12px;
  font-size: 12px;
  line-height: 18px;
  background: var(--dsw-alias-button-primary-fill);
  color: var(--dsw-alias-label-primary-foreground);
  border: 1px solid transparent;
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
}
${GAIA_CONTROLS_SCOPE} form[data-gaia-auth-account-form] [data-dsh-button="primary"] {
  height: 36px;
  align-self: flex-end;
}
${GAIA_CONTROLS_SCOPE} [data-dsh-button="primary"]:hover:not(:disabled) {
  background: var(--dsw-alias-button-primary-hover);
}

/* Button outline: outline and toolbar buttons */
${GAIA_CONTROLS_SCOPE} :is([data-dsh-button="outline"], [data-dsh-button="toolbar"]) {
  box-sizing: border-box;
  height: 32px;
  padding: 0 12px;
  font-size: 12px;
  line-height: 18px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
}
${GAIA_CONTROLS_SCOPE} :is([data-dsh-button="outline"], [data-dsh-button="toolbar"]):hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover-solid);
}

/* Button ghost */
${GAIA_CONTROLS_SCOPE} [data-dsh-button="ghost"]:not([data-dsh-modal-close]) {
  box-sizing: border-box;
  height: 32px;
  padding: 0 12px;
  font-size: 12px;
  line-height: 18px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--dsw-alias-label-primary);
}
${GAIA_CONTROLS_SCOPE} [data-dsh-button="ghost"]:not([data-dsh-modal-close]):hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover-solid);
}

/* Button size sm */
${GAIA_CONTROLS_SCOPE} [data-dsh-size="sm"] {
  box-sizing: border-box;
  height: 32px;
  padding: 0 12px;
  font-size: 12px;
  line-height: 18px;
  border-radius: 6px;
}

/* Button destructive / danger */
${GAIA_CONTROLS_SCOPE} :is([data-dsh-button="danger"], button[class*="_danger"]:not([data-dsh-modal-close]), button[class*="_deleteConfirm"]) {
  box-sizing: border-box;
  height: 32px;
  padding: 0 12px;
  font-size: 12px;
  line-height: 18px;
  border-radius: 6px;
  font-weight: 500;
  background: var(--dsw-alias-state-error-primary);
  color: #fafafa;
  border: 1px solid transparent;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
}
${GAIA_CONTROLS_SCOPE} :is([data-dsh-button="danger"], button[class*="_danger"]:not([data-dsh-modal-close]), button[class*="_deleteConfirm"]):hover:not(:disabled) {
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 90%, black);
}

/* Close button: closeGhost (transparent at rest, red fill on hover) */
${GAIA_CONTROLS_SCOPE} [data-dsh-modal-close] {
  box-sizing: border-box;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--dsw-alias-label-secondary);
  transition: background-color 0.15s, color 0.15s;
}
${GAIA_CONTROLS_SCOPE} [data-dsh-modal-close]:hover:not(:disabled) {
  background: var(--dsw-alias-state-error-primary);
  color: #fafafa;
}

/* Dropdown triggers: SettingSelect outline dropdown */
${GAIA_CONTROLS_SCOPE} [data-dsh-select-trigger] {
  box-sizing: border-box;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  transition: background-color 0.15s, border-color 0.15s, box-shadow 0.15s;
}
${GAIA_CONTROLS_SCOPE} [data-dsh-select-trigger]:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover-solid);
}
${GAIA_CONTROLS_SCOPE} select[data-dsh-select-trigger] {
  padding-right: 32px;
  cursor: pointer;
}

/* Inputs and textareas */
${GAIA_CONTROLS_SCOPE} :is(input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="submit"]):not([type="button"]), textarea) {
  box-sizing: border-box;
  height: 36px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: transparent;
  padding: 0 12px;
  font-size: 14px;
  line-height: 20px;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  color: var(--dsw-alias-label-primary);
  transition: border-color 0.15s, box-shadow 0.15s;
}
${GAIA_CONTROLS_SCOPE} textarea {
  box-sizing: border-box;
  height: auto;
  min-height: 36px;
  padding: 8px 12px;
}
${GAIA_CONTROLS_SCOPE} span:has(> [data-dsh-input]) {
  box-sizing: border-box;
  height: 36px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: transparent;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  padding: 0 12px;
}
${GAIA_CONTROLS_SCOPE} span:has(> [data-dsh-input]) [data-dsh-input] {
  box-sizing: border-box;
  height: 100%;
  border: none;
  background: transparent;
  box-shadow: none;
  padding: 0;
  outline: none;
}
${GAIA_CONTROLS_SCOPE} div[data-dsh-input] {
  box-sizing: border-box;
  font-size: 14px;
  height: 36px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: transparent;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  transition: border-color 0.15s, box-shadow 0.15s;
}
${GAIA_CONTROLS_SCOPE} div[data-dsh-input] input {
  font-size: 14px;
}
/* Cancel outside a modal footer (e.g. the Models inline editor): Gaia cancelOutline hover. */
${GAIA_CONTROLS_SCOPE} [data-dsh-cancel]:hover:not(:disabled) {
  border-color: #f59e0b;
  background: #f59e0b;
  color: #451a03;
}
${GAIA_CONTROLS_SCOPE} div[data-dsh-input]:focus-within {
  border-color: var(--dsw-alias-link);
  box-shadow: 0 0 0 1px var(--dsw-alias-link);
}

/* Add provider button: dashed row button */
${GAIA_CONTROLS_SCOPE} :is([data-dsh-add-provider], button[class*="_addButton"]) {
  border-radius: 6px;
}
${GAIA_CONTROLS_SCOPE} :is([data-dsh-add-provider], button[class*="_addButton"]):hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover-solid);
}

/* Authorization provider cards in Gaia frames: base background, 1px border, 8px radius */
${GAIA_CONTROLS_SCOPE} [data-gaia-auth-card] {
  box-sizing: border-box;
  background: var(--dsw-alias-bg-base);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
}

/* Focus ring */
${GAIA_CONTROLS_SCOPE} :is(button, input, select, textarea, [data-dsh-select-trigger]):focus-visible:not([data-dsh-automatic-focus]) {
  outline: none;
  box-shadow: 0 0 0 1px var(--dsw-alias-link);
}

/* Modal footer buttons: sm sizing for all footer buttons */
${GAIA_CONTROLS_SCOPE} [data-dsh-modal-footer] :is(button, [data-dsh-button]) {
  box-sizing: border-box;
  height: 32px;
  padding: 0 12px;
  font-size: 12px;
  line-height: 18px;
  border-radius: 6px;
  font-weight: 500;
}
/* Modal footer: primary buttons -> Gaia default sm */
${GAIA_CONTROLS_SCOPE} [data-dsh-modal-footer] [data-dsh-button="primary"]:not(:is(button[class*="_danger"], button[class*="_delete"], [data-dsh-button="danger"])) {
  background: var(--dsw-alias-button-primary-fill);
  color: var(--dsw-alias-label-primary-foreground);
  border: 1px solid transparent;
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
}
${GAIA_CONTROLS_SCOPE} [data-dsh-modal-footer] [data-dsh-button="primary"]:not(:is(button[class*="_danger"], button[class*="_delete"], [data-dsh-button="danger"])):hover:not(:disabled) {
  background: var(--dsw-alias-button-primary-hover);
}
/* Modal footer: danger buttons -> destructive sm */
${GAIA_CONTROLS_SCOPE} [data-dsh-modal-footer] :is(button[class*="_danger"], button[class*="_delete"], [data-dsh-button="danger"]) {
  background: var(--dsw-alias-state-error-primary);
  color: #fafafa;
  border: 1px solid transparent;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
}
${GAIA_CONTROLS_SCOPE} [data-dsh-modal-footer] :is(button[class*="_danger"], button[class*="_delete"], [data-dsh-button="danger"]):hover:not(:disabled) {
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 90%, black);
}
/* Modal footer: cancel / secondary buttons -> cancelOutline sm with amber hover */
${GAIA_CONTROLS_SCOPE} [data-dsh-modal-footer] :is(button, [data-dsh-button]):not([data-dsh-button="primary"]):not(:is(button[class*="_danger"], button[class*="_delete"], [data-dsh-button="danger"])) {
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
}
${GAIA_CONTROLS_SCOPE} [data-dsh-modal-footer] :is(button, [data-dsh-button]):not([data-dsh-button="primary"]):not(:is(button[class*="_danger"], button[class*="_delete"], [data-dsh-button="danger"])):hover:not(:disabled) {
  border-color: #f59e0b;
  background: #f59e0b;
  color: #451a03;
}
`

/** Gaia typography, surfaces, radii, palette-driven colors and composer styling. */
export const GAIA_SKIN_CSS = `
${GAIA_FRAME} body {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-base);
  font-family: "Fira Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
${GAIA_FRAME} [data-app-frame] {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-base);
}
/* Hide the stock hero headline in both Gaia frames. */
${GAIA_FRAME} [data-hero-headline] {
  display: none !important;
}
${GAIA_FRAME} [data-composer-card] {
  position: relative;
  background: var(--dsw-alias-bg-base) !important;
  border: 1px solid var(--dsw-alias-border-l2) !important;
  border-radius: 12px !important;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.05) !important;
  transition: border-color 0.2s ease;
}
${GAIA_FRAME} [data-composer-card]:focus-within {
  border-color: color-mix(in oklch, var(--dsw-alias-link), transparent 50%) !important;
}
@property --gaia-composer-angle {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
}
@keyframes gaia-composer-border-spin {
  to { --gaia-composer-angle: 360deg; }
}
${GAIA_FRAME} [data-composer-card]::before {
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
${GAIA_FRAME} [data-composer-card]:focus-within::before {
  opacity: 1;
  animation: gaia-composer-border-spin 5s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  ${GAIA_FRAME} [data-composer-card]:focus-within::before { animation: none; }
}
${GAIA_FRAME} [data-composer-primary] {
  background: var(--dsw-alias-bg-base) !important;
  color: var(--dsw-alias-button-info-fill) !important;
  box-shadow: inset 0 0 0 1px var(--dsw-alias-button-info-fill) !important;
}
${GAIA_FRAME} [data-composer-primary]:hover:not(:disabled) {
  background: var(--dsw-alias-button-info-fill) !important;
  color: var(--dsw-alias-bg-base) !important;
  box-shadow: none !important;
}
/* Chat and builtin Markdown tables: column titles in Gaia's accent, and the
   header rule in the same app border as the rows (DSH draws it in a neutral
   gray). The Obsidian viewer keeps Gaia's file-viewer table style. */
${GAIA_FRAME} table:not([data-gaia-markdown] table) th {
  color: var(--dsw-alias-link);
  border-bottom: 1px solid var(--dsw-alias-border-l2);
}
${GAIA_FRAME} table:not([data-gaia-markdown] table) td {
  border-bottom-width: 1px;
}
/* The selected session row exposes its title as the second direct span. */
${GAIA_FRAME} [data-row-key^="session:"][role="treeitem"][aria-selected="true"] > span:nth-child(2) {
  color: var(--dsw-alias-link);
}
${GAIA_FRAME} [data-gaia-settings-launcher] {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  width: auto;
  height: 42px;
  margin: 0;
  padding: 0 10px 0 8px;
  box-sizing: border-box;
  border: none;
  border-radius: var(--dsw-radius-md);
  background: transparent;
  cursor: pointer;
  overflow: hidden;
  color: var(--dsw-alias-label-primary);
  font-family: inherit;
  font-size: 14px;
  line-height: 22px;
}
${GAIA_FRAME} [data-gaia-settings-launcher]:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}
${GAIA_FRAME} [data-gaia-settings-launcher][data-rail] {
  flex: none;
  width: 36px;
  height: 36px;
  margin: 0;
  justify-content: center;
  gap: 0;
  padding: 0;
}
${GAIA_FRAME} [data-gaia-settings-launcher] .gaia-trigger-label {
  overflow: hidden;
  white-space: nowrap;
}
${GAIA_SETTINGS_CSS}
${GAIA_CONTROLS_CSS}
`


/** Chrome removal and compact-viewport treatment unique to single-session embed mode. */
export const GAIA_EMBED_CHROME_CSS = `
/* Remove shell columns from the grid so the conversation fills the drawer. */
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
/* The short drawer viewport can use all room beside the model trigger. */
html[data-gaia-embed] [data-model-menu] {
  max-height: var(--model-menu-room, calc(100vh - 24px)) !important;
}
/* The drawer belongs to one project; its hero cannot change workspace. */
html[data-gaia-embed] [data-hero-workspace] {
  display: none !important;
}
/* Resume popup rows are widened and flattened for the compact drawer. */
html[data-gaia-embed] :has(> [role="listbox"][aria-label^="/resume"]) {
  width: 100%;
  min-width: 100% !important;
}
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

function injectStyle(id: string, css: string): () => void {
  if (typeof document === 'undefined') return () => {}
  let styleEl = document.getElementById(id) as HTMLStyleElement | null
  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = id
    styleEl.textContent = css
    document.head.appendChild(styleEl)
  }
  return () => { styleEl.remove() }
}

/** Inject shared Gaia skin rules. */
export function injectGaiaSkin(): () => void {
  return injectStyle(GAIA_SKIN_STYLE_ID, GAIA_SKIN_CSS)
}

/** Inject embed-only chrome rules. */
export function injectEmbedChrome(): () => void {
  return injectStyle(GAIA_EMBED_STYLE_ID, GAIA_EMBED_CHROME_CSS)
}

/** Backward-compatible helper that installs the skin and embed chrome together. */
export function injectEmbedStyles(): () => void {
  const removeSkin = injectGaiaSkin()
  const removeChrome = injectEmbedChrome()
  return () => { removeChrome(); removeSkin() }
}
