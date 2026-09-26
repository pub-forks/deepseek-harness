/**
 * Map Gaia's resolved theme colors onto DSH's alias tokens, so an embedded
 * harness tab paints with the host application's colors (e.g. Gaia's near
 * black dark background instead of DSH's bluish dark gray).
 *
 * Gaia sends six colors; DSH layers (panels, code blocks, hovers) are derived
 * from the background and foreground with color-mix so every Gaia theme,
 * including accent variants and per-project themes, stays coherent.
 */
import type { ThemeTokenOverrides } from '@deepseek-ai/dsh-client-ui-theme/client'
import type { GaiaPalette } from './bridge.ts'

/** Override-layer source name for the Gaia palette. */
export const GAIA_PALETTE_LAYER = 'gaia-embed-palette'

/**
 * `mix(a, pct, b)`: `a` at `pct` percent over `b`.
 * @param a - foreground color.
 * @param pct - share of `a`, 0–100.
 * @param b - background color.
 * @returns a CSS color-mix() expression.
 */
function mix(a: string, pct: number, b: string): string {
  return `color-mix(in srgb, ${a} ${String(pct)}%, ${b})`
}

/**
 * Derive DSH alias token values from a Gaia palette. Keys absent from the
 * palette leave the corresponding DSH tokens untouched.
 * @param palette - validated Gaia colors.
 * @returns alias-token overrides; each value applies to both schemes because
 * Gaia sends a fresh palette whenever its own scheme changes.
 */
export function paletteTokens(palette: GaiaPalette): ThemeTokenOverrides {
  const flat: Record<string, string> = {}
  const { background: bg, foreground: fg, surface, border, mutedForeground: muted, accent } = palette
  if (bg !== undefined) {
    flat['--dsw-alias-bg-base'] = bg
    flat['--dsw-alias-bg-document-preview'] = bg
    flat['--dsw-specific-sidebar-fill'] = bg
  }
  if (bg !== undefined && fg !== undefined) {
    const layer1 = surface ?? mix(fg, 4, bg)
    flat['--dsw-alias-bg-layer-1'] = layer1
    flat['--dsw-alias-bg-layer-2'] = mix(fg, 7, bg)
    flat['--dsw-alias-bg-layer-3'] = mix(fg, 10, bg)
    flat['--dsw-alias-bg-module-platform'] = mix(fg, 10, bg)
    flat['--dsw-alias-bg-overlay'] = mix(fg, 14, bg)
    flat['--dsw-alias-markdown-code-block'] = layer1
    flat['--dsw-alias-markdown-code-block-banner'] = mix(fg, 7, bg)
    flat['--dsw-alias-button-floating-fill'] = mix(fg, 7, bg)
    flat['--dsw-alias-button-floating-hover'] = mix(fg, 10, bg)
    flat['--dsw-alias-interactive-bg-hover-solid'] = mix(fg, 10, bg)
    flat['--dsw-alias-border-l3'] = mix(fg, 18, bg)
    flat['--dsw-alias-border-l4'] = mix(fg, 24, bg)
    flat['--dsw-alias-label-secondary'] = mix(fg, 80, bg)
  }
  // Gaia's border is its accent line (orange on the default dark theme); it
  // takes DSH's primary borders, while the faint l1 dividers stay neutral.
  if (border !== undefined) flat['--dsw-alias-border-l2'] = border
  if (bg !== undefined && fg !== undefined) flat['--dsw-alias-border-l1'] = mix(fg, 8, bg)
  if (fg !== undefined) {
    flat['--dsw-alias-label-primary'] = fg
    flat['--dsw-alias-label-primary-bluish'] = fg
  }
  if (muted !== undefined) {
    flat['--dsw-alias-label-tertiary'] = muted
    flat['--dsw-alias-label-caption'] = bg === undefined ? muted : mix(muted, 80, bg)
  }
  if (accent !== undefined) {
    flat['--dsw-alias-link'] = accent
    flat['--dsw-alias-state-business-primary'] = accent
    flat['--dsw-alias-button-info-fill'] = accent
  }
  return Object.fromEntries(Object.entries(flat).map(([name, value]) => [name, { light: value, dark: value }]))
}
