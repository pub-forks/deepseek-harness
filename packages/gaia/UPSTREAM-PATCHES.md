# Gaia upstream edits

| File | Change | Reason | Drop when |
| --- | --- | --- | --- |
| `apps/cli/package.json` | Add Gaia bridge and profile workspace dependencies. | The installed CLI resolver needs these packages to mount the overlay. | The launcher resolves Gaia packages from a separate installed profile. |
| `tsconfig.base.json` | Add source path mappings for Gaia packages. | Source plane typecheck and tests resolve workspace imports without built artifacts. | Workspace path mappings become generated automatically. |
| `tsconfig.host.json` | Add Gaia bridge and profile project references. | Host aggregate typecheck includes both new packages. | Host references become generated automatically. |
| `pnpm-lock.yaml` | Record Gaia workspace package importers and CLI dependencies. | Offline frozen installs must link the packages. | Gaia packages leave the workspace. |
