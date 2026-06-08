# Step 1 — Token contract + prove it on survey + ADR

> Read `00-shared-context.md` first. This step has no prerequisites.

## Mission

Author the **`@kontourai/console-kit` token layer** (the `--k-*` contract from the shared
context) as the package's first deliverable, then **prove the contract works** by
refactoring the survey review-workbench onto it with **zero visual regression**. Ship an
**ADR** documenting the names + status-scale mapping so other products can adopt
incrementally.

This step is deliberately low-risk and self-contained: it touches only the new package
folder and the survey repo's CSS.

## Deliverables

1. **Package skeleton** at `/Users/brian/dev/github/kontourai/console-kit/`:
   ```
   console-kit/
     package.json          # name "@kontourai/console-kit", version 0.0.0, private:false,
                           # type:module, exports map for ./tokens, ./tokens.css, ./themes.css
     tokens/
       tokens.css          # base (dark) + [data-theme="light"] variant
       themes.css          # .theme-survey / .theme-console / .theme-flow / .theme-surface
       index.css           # @import "./tokens.css"; @import "./themes.css";
       fonts.css           # @import the Google Fonts (Fraunces, Hanken Grotesk, IBM Plex Mono)
     README.md             # what the package is, the 3 layers, how to consume tokens
     docs/adr/0001-console-kit-token-contract.md
   ```
   - Use the token values from `00-shared-context.md` as the starting point. Verify text
     colors meet **WCAG AA** on `--k-panel` (both dark and light); adjust hues if not and
     record the change in the ADR.
   - `package.json` `exports` should let consumers do
     `import "@kontourai/console-kit/tokens.css"` and `@import` the CSS. Keep it CSS-only for
     this step (no JS/React yet — that is Step 2).

2. **Survey refactored onto the contract** (`survey/examples/review-workbench/`):
   - Add `--k-*` token consumption to `review-workbench.css`. Two acceptable approaches —
     pick one and note it in the handoff:
     - **(RECOMMENDED) Vendored proof:** copy `tokens.css` + `themes.css` + `fonts.css`
       into the example dir and `@import` them at the top of `review-workbench.css`; add
       `class="... theme-survey"` to the root element (see note on the mount point below).
       The vendored copy is temporary until survey takes a real dependency in a later step;
       say so in a comment.
     - Alternative: reference the sibling package files by relative path. Avoid this for the
       browser example unless you confirm the path resolves when served.
   - **Re-map survey's local variables to the contract.** Today `review-workbench.css`
     defines `--ink-*`, `--paper*`, `--accent`, `--verify/--hold/--reject`, etc. Replace
     their *usage* with `--k-*`:
     - `--ink-*` ramp → `--k-bg` / `--k-panel` / `--k-panel-raised`
     - `--paper` / `--paper-dim` / `--paper-faint` → `--k-text` / `--k-text-muted` / `--k-text-faint`
     - `--line` / `--line-strong` → `--k-line` / `--k-line-strong`
     - `--accent` → `--k-brand` (the eyebrow/structure accent IS survey's brand mint)
     - `--verify` → `--k-positive`, `--hold` → `--k-caution`, `--reject` → `--k-negative`,
       `--proposed` → `--k-active`
     - fonts → `--k-font-display` / `--k-font-ui` / `--k-font-mono`
     - radii → `--k-radius-*`
   - You MAY keep a thin survey-local alias block (e.g. `--accent: var(--k-brand)`) if it
     reduces churn — but the source of truth must be `--k-*`.

3. **ADR** `console-kit/docs/adr/0001-console-kit-token-contract.md`: the token names,
   the light/dark strategy, the status-scale mapping table, the per-product brand decision,
   the org-scope note (`@kontour` vs `@kontourai`), and the "components read only tokens"
   principle. Keep it to ~1 page.

## Where survey applies the theme class

The review-workbench mounts into `<main id="review-workbench" class="workbench">`
(see `survey/examples/review-workbench/index.html`). The renderer
(`review-workbench.ts`) writes `<section class="workbench-shell">` inside it. Add
`theme-survey` to a stable element. **Editing `index.html`** to make it
`<main id="review-workbench" class="workbench theme-survey">` is the simplest and is
allowed. Do **not** restructure the renderer to inject classes for this.

## Constraints / DO-NOT-BREAK (survey-specific — important)

Survey has a static validator: `survey/scripts/check-review-workbench.cjs`
(run via `npm run check:review-workbench`). It asserts the CSS **contains these exact
substrings** — they MUST survive your refactor verbatim:
- `@media (max-width: 980px)`
- `.workbench-shell`
- `grid-template-columns: minmax(0, 1fr) minmax(0, 520px)`
- `overflow-wrap: anywhere`

Also:
- The validator checks `review-workbench.js` (compiled render logic) and **fixture
  provenance**. Do **not** edit `review-workbench.ts`, `review-workbench-data.ts`, or any
  `.ts` in that dir — CSS (and the one `index.html` class) only.
- Class names and the `data-queue-status` / `is-selected` / `is-unselected` hooks are
  produced by the renderer and are fixed. Style via the existing selectors.
- Keep all existing visual behavior: color-coded queue rows by `data-queue-status`,
  the proposed-candidate accent, the `is-selected` verify-glow, decision-button color
  coding by `:nth-child`, the demoted JSON `pre`, the page-load `rise` animation, and the
  `prefers-reduced-motion` guard.

## Verification (must pass before handoff)

From `survey/`:
```bash
npm run check:review-workbench   # rebuilds + runs the static validator (must pass)
```
Visual parity (the real acceptance test):
```bash
# from survey/ , serve and screenshot the workbench in both states
python3 -m http.server 8765   # background
# open http://localhost:8765/examples/review-workbench/index.html
```
Screenshot (a) initial load and (b) after clicking `[data-decision='accept-proposed']`,
at viewport 1440×1200. Compare against the current design — the redesign must look
**effectively identical** (same dark forensic look, mint accent, value hero, verify-glow).
The whole point is that swapping local vars for `--k-*` changes nothing visible.

Token sanity: confirm `console-kit/tokens/index.css` parses (no `@import` typos) and that
toggling `[data-theme="light"]` on `<html>` produces a coherent light skin.

## Acceptance criteria (how this will be evaluated)

- [ ] `@kontourai/console-kit` skeleton exists with `tokens/`, `themes.css`, `index.css`,
      `fonts.css`, `README.md`, and the ADR.
- [ ] `tokens.css` defines the full `--k-*` contract incl. light variant; AA contrast met.
- [ ] `themes.css` defines all four `.theme-*` brand classes.
- [ ] survey `review-workbench.css` consumes `--k-*` (no orphaned hard-coded hex where a
      token exists); `theme-survey` is applied.
- [ ] `npm run check:review-workbench` passes (all four required substrings intact).
- [ ] Before/after screenshots show no visual regression in either state.
- [ ] ADR present with the status-scale mapping table.
- [ ] `HANDOFF.md` written: approach chosen (vendored vs referenced), any hue/contrast
      adjustments, assumptions, screenshots referenced.

## Out of scope (leave for later steps)

- No React components yet (Step 2).
- No changes to flow / surface / kontour-console (their adoption is Step 1-follow-on or
  Step 2/3). This step proves the contract on survey only.
- No registry publishing.
