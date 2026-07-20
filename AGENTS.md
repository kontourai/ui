# Kontour UI Agent Guidance

Kontour UI (`@kontourai/ui`) is the shared presentation layer for the Kontour
family: the `--k-*` design-token contract plus React primitives and web-component
wrappers built on it. Downstream products (Flow Console, Survey Review Workbench,
Station, and docs sites) vendor or import these tokens, so token changes ripple
across every product surface.

## Source Of Truth

- Product/domain context: `CONTEXT.md`.
- Agent-facing repo instructions: `AGENTS.md`.
- Broad verification: `npm run verify`.
- Token contract: `tokens/` (CSS custom properties; per-product accents live in `themes.css`).
- React primitives: `react/`; light-DOM wrappers: `elements/`; docs in `docs/`.
- `dist/` is generated.

## Match Checks To Change Type

- Token changes: `npm run check:tokens` — and remember downstream vendored copies (e.g. flow's `src/console-ui/vendor/console-kit/`) sync via those repos' own scripts.
- Export/package changes: `npm run check:exports` and `npm run check:pack`.
- Visual/browser changes: `npm run test:browser`.
- Before push: `npm run verify`.

## Useful Commands

- `npm run verify` · `npm run check` · `npm run check:tokens` · `npm run test:browser`

<!-- veritas:governance-block:start -->
This repo uses Veritas for AI governance. Read `.veritas/GOVERNANCE.md` before making changes.
After changes, run `veritas readiness` and address any FAIL lines before finishing.
<!-- veritas:governance-block:end -->
