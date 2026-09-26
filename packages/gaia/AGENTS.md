# Gaia fork packages

Gaia code lives only under `packages/gaia/*` as ordinary Cordis plugins mounted by the Gaia overlay. Upstream edits are a last resort; mark each with `GAIA:` where the format permits comments and list each in [UPSTREAM-PATCHES.md](UPSTREAM-PATCHES.md). Follow the root and documentation rules, including package README metadata, `workspace:*` DSH dependencies, oxlint, and Vitest `*.spec.ts` files under `tests/`.
