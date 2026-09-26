# Gaia upstream edits

| File | Change | Reason | Drop when |
| --- | --- | --- | --- |
| `apps/cli/package.json` | Add Gaia bridge, profile, and authorization workspace dependencies. | The installed CLI resolver needs these packages to mount the overlay. | The launcher resolves Gaia packages from a separate installed profile. |
| `tsconfig.base.json` | Add source path mappings for Gaia packages, including authorization types and client face. | Source plane typecheck and tests resolve workspace imports without built artifacts. | Workspace path mappings become generated automatically. |
| `tsconfig.host.json` | Add Gaia bridge, profile, and authorization project references. | Host aggregate typecheck includes both new packages. | Host references become generated automatically. |
| `tsconfig.client.json` | Add Gaia authorization UI project reference. | Client aggregate typecheck includes the browser plugin. | Client references become generated automatically. |
| `packages/bundle/web-app/package.json` | Add Gaia client plugin dependency. | Web bundle resolver needs a manifest edge for the overlay client row. | Gaia client is supplied by another bundle. |
| `packages/client/ui-settings/src/client/contract/slots.ts` | `GAIA:` add section navigation owner callback. | The success hint must open Models through the Settings shell. | Upstream supplies section navigation to child sections. |
| `packages/client/ui-settings-general/src/client/SettingsRoot.tsx` | `GAIA:` pass Settings navigation to section slots. | The success hint uses shell-owned navigation. | Upstream supplies section navigation to child sections. |
| `pnpm-lock.yaml` | Record Gaia workspace package importers and CLI dependencies. | Offline frozen installs must link the packages. | Gaia packages leave the workspace. |
