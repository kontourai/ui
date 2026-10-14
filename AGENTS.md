# Kontour UI Agent Guidance

Kontour UI (`@kontourai/ui`) is the shared presentation layer for the Kontour
family: the `--k-*` design-token contract plus React primitives and web-component
wrappers built on it. Downstream products (Flow Console, Survey Review Workbench,
Station, and docs sites) vendor or import these tokens, so token changes ripple
across every product surface.

## Source Of Truth

- Product/domain context: `CONTEXT.md`.
- Design roles and rules (brand, color, type, layout, trust UX, agent MUST/MUST NOT, OPEN decisions): `DESIGN.md`. Its token front matter is generated — change `tokens/`, then `node scripts/generate-design-md.mjs --write`; never resolve an OPEN item silently.
- Agent-facing repo instructions: `AGENTS.md`.
- Broad verification: `npm run verify`.
- Token contract: `tokens/` (CSS custom properties; per-product accents live in `themes.css`).
- React primitives: `react/`; light-DOM wrappers: `elements/`; docs in `docs/`.
- Docs are published with Corpus: `corpus.json` lists the published docs and MCP topics, `npm run docs:check` is the gate, and when you change code a document `covers`, update that document.
- Decisions: one living record per subject in `docs/decisions/<slug>.md`, in the [Corpus decision-record format](https://github.com/kontourai/corpus/blob/main/docs/decisions.md); list a new record in `corpus.json` `documents`. The numbered ADRs in `docs/adr/` are frozen history: never add one, and cite them as `adr` evidence instead. After editing a record, run `npm run gen:decisions-index`. `npm run check:decisions` (part of `npm run verify`) validates the records and the index, and refuses files added under `docs/adr/` since `$DECISIONS_BASE` (default `origin/main`; CI sets it to the pull request base, or to the pushed range on `main`).
- `dist/` is generated.

## Match Checks To Change Type

- Token changes: `npm run check:tokens` and `npm run check:design` (regenerate `DESIGN.md`'s front matter) — and remember downstream vendored copies (e.g. flow's `src/console-ui/vendor/ui/`) sync via those repos' own scripts.
- Export/package changes: `npm run check:exports` and `npm run check:pack`.
- Visual/browser changes: `npm run test:browser`.
- Before push: `npm run verify`.

## Useful Commands

- `npm run verify` · `npm run check` · `npm run check:tokens` · `npm run test:browser`

<!-- veritas:governance-block:start -->
This repo uses Veritas for AI governance. Read `.veritas/GOVERNANCE.md` before making changes.
After changes, run `npx --no @kontourai/veritas readiness` and address any FAIL lines before finishing.
<!-- veritas:governance-block:end -->
