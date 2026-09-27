# Gaia upstream edits

| File | Change | Reason | Drop when |
| --- | --- | --- | --- |
| `apps/cli/package.json` | Add Gaia bridge, profile, authorization, and embed workspace dependencies. | The installed CLI resolver needs these packages to mount the overlay. | The launcher resolves Gaia packages from a separate installed profile. |
| `tsconfig.base.json` | Add source path mappings for Gaia packages, including authorization and embed types and client face. | Source plane typecheck and tests resolve workspace imports without built artifacts. | Workspace path mappings become generated automatically. |
| `tsconfig.host.json` | Add Gaia bridge, profile, and authorization project references. | Host aggregate typecheck includes both new packages. | Host references become generated automatically. |
| `tsconfig.client.json` | Add Gaia authorization and embed UI project references. | Client aggregate typecheck includes the browser plugin. | Client references become generated automatically. |
| `packages/bundle/web-app/package.json` | Add Gaia authorization and embed client plugin dependencies. | Web bundle resolver needs a manifest edge for the overlay client row. | Gaia client is supplied by another bundle. |
| `packages/client/ui-layout/src/client/AppFrame.tsx` | `GAIA:` add `data-app-frame` and `data-sidebar-col` attributes. | The embed client plugin requires stable data attributes for scoped embed layout styling. | Upstream supplies stable frame and sidebar column attributes. |
| `packages/client/ui-settings/src/client/contract/slots.ts` | `GAIA:` add section navigation owner callback. | The success hint must open Models through the Settings shell. | Upstream supplies section navigation to child sections. |
| `packages/client/ui-settings-general/src/client/SettingsRoot.tsx` | `GAIA:` pass Settings navigation to section slots. | The success hint uses shell-owned navigation. | Upstream supplies section navigation to child sections. |
| `pnpm-lock.yaml` | Record Gaia workspace package importers and CLI dependencies. | Offline frozen installs must link the packages. | Gaia packages leave the workspace. |
| `packages/client/ui-conversation/src/client/skeleton/InputBar.tsx` | Add `data-composer-primary` to the composer's send/stop buttons. | The embed restyles the send button's hover (reversed colors) and the buttons only carry hashed CSS-module classes. | Upstream exposes a stable attribute or theme token for the primary composer button's hover colors. |
| `packages/client/ui-conversation/src/client/skeleton/EmptyHero.tsx` | Add `data-hero-workspace` to the empty-session workspace chip. | A drawer tab is bound to its Gaia project's workspace, so the embed hides the chip; it only carries hashed CSS-module classes and a localized label. | Upstream lets a host hide or lock the hero workspace chip. |
