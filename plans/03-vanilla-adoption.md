# Step 3 — Vanilla adoption (flow + survey) via web components

> Read `00-shared-context.md` first. **Depends on Step 1** (tokens) and **Step 2** (the
> React core + the documented className contracts for primitives).

## Mission

Bring the **vanilla-TS consoles** (`flow/src/console-ui`, `survey/examples/review-workbench`)
into the family so they share the same tokens AND the same primitive **look** as the React
core — **without** rewriting them in React. Do this by:
1. Adopting the `--k-*` tokens + a product theme class in each (so colors/typography
   converge), and
2. Shipping `@kontourai/console-kit/elements` — **web-component wrappers** that render the
   same className contracts as the React primitives, so a vanilla app can drop in
   `<k-badge>`, `<k-panel>`, `<k-button>`, etc. and get identical styling.

The result: React `<Badge>` and vanilla `<k-badge value="verified">` produce the same DOM
shape + classes and are skinned by the same stylesheet. That is "interoperable as possible"
across stacks.

## Deliverables

1. **`@kontourai/console-kit/elements`** in `console-kit/`:
   ```
   console-kit/
     elements/
       src/
         index.ts            # registers all custom elements
         k-badge.ts k-panel.ts k-status-badge.ts k-metric.ts
         k-progress.ts k-empty.ts k-button.ts k-topbar.ts
       elements/styles.css    # OR reuse react/styles.css if class contracts are identical
   ```
   - Each custom element renders the **exact className contract** documented in Step 2's
     `HANDOFF.md` (e.g. `<k-badge>` renders `<span class="badge tone-positive">…`). Prefer
     **light DOM** (no shadow DOM) so the shared stylesheet + `--k-*` cascade apply without
     duplicating styles. If you use shadow DOM, you must adopt the kit stylesheet into each
     root and ensure `--k-*` inherit (they do, as custom properties pierce shadow boundaries).
   - Reuse the **same `tones.ts`** semantic mapping from the React core (import it; do not
     fork the regex).
   - Keep the API minimal and attribute-driven (`value`, `status`, `label`, `variant`,
     `title`, `count`) to mirror the React props.
   - Build to ESM + `.d.ts`, same toolchain as Step 2.

2. **flow adopts tokens + theme** (`flow/src/console-ui/`):
   - Replace `styles.css`'s local `:root` vars (`--bg/--surface/--ink/--muted/--line/
     --pass/--block/--wait/--current/--accent`) with `--k-*`:
     - `--ink` → `--k-text`, `--surface` → `--k-panel`, `--bg` → `--k-bg`, `--line` → `--k-line`
     - `--pass` → `--k-positive`, `--block` → `--k-negative`, `--wait` → `--k-caution`,
       `--current` → `--k-active`, `--accent` → `--k-brand`
   - Apply `class="theme-flow"` on the app root (`#app` or `<body>`; see `index.html`).
   - flow is **light today** — decide light vs dark (RECOMMENDED: keep flow light via
     `data-theme="light"` to preserve its identity, brand = flow teal). Note the choice.
   - Optionally swap hand-rolled badge/panel markup in `app.ts` for `<k-*>` elements where
     it reduces code — but tokens+theme adoption is the required part; element swap is
     a nice-to-have for this step.

3. **survey switches from vendored tokens to the package** (`survey/examples/review-workbench/`):
   - In Step 1 survey vendored a copy of the tokens. Now point it at the package:
     either add `"@kontourai/console-kit": "file:../console-kit"` and reference the installed
     CSS, or (for the static example) replace the vendored copy with a symlink/relative
     `<link>` to `console-kit/tokens/index.css`. Pick whichever keeps the example loadable
     when served over HTTP and note it.
   - Remove the now-duplicated vendored token files.
   - **Survey validator still applies** — see DO-NOT-BREAK.

## Constraints / DO-NOT-BREAK

- **Survey:** `survey/scripts/check-review-workbench.cjs` (`npm run check:review-workbench`)
  still asserts the CSS contains, verbatim: `@media (max-width: 980px)`, `.workbench-shell`,
  `grid-template-columns: minmax(0, 1fr) minmax(0, 520px)`, `overflow-wrap: anywhere`. It
  also checks compiled render JS + fixture provenance — do not edit the `.ts` render/data/
  fixture files. CSS + `index.html` only.
- **flow:** check `flow/package.json` scripts and run them (typecheck/build/test if present)
  after changes. flow's console-ui builds via `tsconfig.console-ui.json`. Don't change
  flow's domain logic in `app.ts` beyond markup/styling.
- **Web components:** must work when the consuming app has no bundler step too (flow/survey
  load ES modules directly). Ship plain ESM; avoid framework deps.
- Custom element tag names must be hyphenated and namespaced (`k-*`) to avoid collisions.

## Verification (must pass before handoff)

- **survey** (from `survey/`): `npm run check:review-workbench` passes; serve over HTTP and
  screenshot — still visually identical to the Step 1 result, now sourced from the package.
- **flow** (from `flow/`): run its build/typecheck/test; serve `flow/src/console-ui` (or its
  built output) over HTTP and screenshot — flow now wears `theme-flow` over `--k-*`, with the
  same primitive look as the React core but its own brand + (chosen) light/dark mode.
- **elements:** write a tiny demo HTML that loads `@kontourai/console-kit/tokens.css`,
  `themes.css`, the element bundle, and the component styles; render one of each `<k-*>` in
  several states; screenshot and compare to the React versions from Step 2 — they must match.
- Cross-stack parity check: place a React `<Badge value="verified">` (Step 2 demo) next to
  `<k-badge value="verified">` — identical rendering.

## Acceptance criteria (how this will be evaluated)

- [ ] `@kontourai/console-kit/elements` registers `k-*` custom elements that emit the same
      className contracts as the React primitives and reuse the shared `tones.ts`.
- [ ] Elements build to ESM + `.d.ts` and work without a bundler.
- [ ] flow consumes `--k-*` + `theme-flow`; local status vars removed; build/typecheck/test pass.
- [ ] survey consumes tokens from the package (no vendored duplicate); validator passes;
      no visual regression.
- [ ] Demo proves React vs web-component parity (screenshots).
- [ ] `HANDOFF.md`: element API table, flow light/dark decision, survey consumption method,
      any parity gaps, screenshots.

## Out of scope / future

- surface (`surface/docs-site`) token adoption — it is a static serif docs site; adopting
  `--k-*` + `theme-surface` there is a small follow-on, optional in this step. If time
  allows, do it the same way (swap `:root` vars for `--k-*`, add `theme-surface`,
  `data-theme` per its light/dark preference) and note it.
- Registry publishing, Storybook/visual-regression CI, and any React migration of the
  vanilla apps are explicitly future work.
