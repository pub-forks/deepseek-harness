# Gaia fork packages

Gaia code lives only under `packages/gaia/*` as ordinary Cordis plugins mounted by the Gaia overlay. Upstream edits are a last resort; mark each with `GAIA:` where the format permits comments and list each in [UPSTREAM-PATCHES.md](UPSTREAM-PATCHES.md). Follow the root and documentation rules, including package README metadata, `workspace:*` DSH dependencies, oxlint, and Vitest `*.spec.ts` files under `tests/`.

- Every new Gaia Harness plugin must ship a package-local icon: set `icon` in `package.json` to a file inside the package (SVG preferred; SVG/PNG/JPEG/WebP, max 256 KiB, as enforced by `packages/boot/app-boot/src/package-meta.ts`), list it in `files`, and make it legible in light and dark themes.
- A plugin that adds a slash command must also register its menu glyph through `commandUi.face` from a client plugin; the `package.json` icon covers only the Plugin Manager.
