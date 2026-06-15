# Console Kit Release Readiness

This package is ready for release review when the package checks, pack preview, and adopter checks all pass against the same `@kontourai/ui` source.

## Package Checks

From `ui`:

```sh
npm install
npm run verify
```

`npm run verify` runs:

- token contract check
- package export build and smoke check
- release readiness check
- machine-checked `npm pack --dry-run --json` package contents

In an isolated `ui` checkout, release readiness verifies package-local artifacts and skips sibling adopter contracts. In a Kontour workspace where `../kontour-console`, `../flow`, `../survey`, and `../surface` are present, the same readiness check also verifies those adopter contracts.

## Adopter Checks

Kontour Console:

```sh
cd ../kontour-console/console-ui
npm install
npm run typecheck
npm run test
npm run build
```

Flow:

```sh
cd ../flow
npm install
npm run check:console-kit-assets
npm run typecheck
npm run typecheck:console-ui
npm run test
```

Survey:

```sh
cd ../survey
npm install
npm run check:review-workbench-assets
npm run check:review-workbench
npm run verify
```

Survey consumes vendored Console Kit tokens through `sync:review-workbench-assets`; `check:review-workbench-assets` verifies the copied token files have not drifted.

Surface:

```sh
cd ../surface
npm install
npm run docs:build
npm run check:console-kit-assets
npm run verify
```

## Browser Evidence

After `ui` builds, serve the package root over HTTP and capture:

- `docs/gallery.html`
- Kontour Console main app
- Flow console shell
- Survey review workbench
- Surface docs home page

Screenshots should prove:

- no blank pages
- no missing token styles
- no text overlap at 1440x1200
- theme identity remains product-specific

## Release Decision

Before registry publishing, confirm these decisions remain current:

- Apache-2.0 license metadata
- semver policy
- npm public access policy
- whether local `file:` adopters move to a registry version or workspace protocol
- whether `docs/` remains in package `files`
