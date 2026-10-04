import type { IconProps } from '@deepseek-ai/dsh-client-ui-primitives'

/** Slash-menu glyph for Gaia's Host-owned `/rename` command. */
export function RenameIcon({ size = 16, className }: IconProps) {
  return <svg aria-hidden="true" width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
  </svg>
}
