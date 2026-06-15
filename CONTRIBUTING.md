# Contributing

This file is intentionally short.

The main docs in this repo are written for people installing and using Console Kit.
This file is the footnote for people developing the product itself.

## Development Rules

- Console Kit is the shared presentation layer for the Kontour family — the `--k-*` design-token contract plus React primitives and web-component wrappers built on it
- token changes ripple across every downstream product surface (flow console, survey workbench, docs sites); treat them as breaking changes
- downstream products vendor or import tokens; their vendored copies sync via their own scripts — after a token change, note that downstream syncs are needed
- no new peer or production dependencies without clear leverage

## Setup

```bash
npm install
```

## Verification

Before opening a PR:

```bash
npm run verify
```

This runs token checks, export checks, readiness checks, package-contents checks, and browser tests.

Individual checks:

- `npm run check:tokens` — token contract integrity
- `npm run check:exports` — package exports align with dist
- `npm run check:readiness` — readiness check
- `npm run check:pack` — package contents
- `npm run test:browser` — Playwright browser tests

## PR Expectations

- one concern per PR; keep diffs reviewable
- token changes must include an update to `tokens/` and, when relevant, `themes.css`
- use conventional commit prefixes (`feat:`, `fix:`, `docs:`, `chore:`) — releases are automated with release-please

## Releases

Releases are automated with release-please: merges to main accumulate into a release PR, and merging it tags the version and dispatches the npm publish workflow.

## Repository

https://github.com/kontourai/ui

All projects are Apache-2.0.
