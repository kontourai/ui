# Step 2 — React core component library + adopt in kontour-console

> Read `00-shared-context.md` first. **Depends on Step 1** (the `--k-*` token layer must
> exist in `@kontourai/console-kit`).

## Mission

Extract kontour-console's presentational primitives into the **`@kontourai/console-kit/react`**
entry point as the shared React core, restyle them to read **only `--k-*` tokens**, then
**repoint `kontour-console/console-ui` at the package** with no functional or visual
regression. kontour-console is already React 19 + Vite, so it is the lowest-friction first
consumer and the source of the seed components.

## Deliverables

1. **React core** in `console-kit/` (`@kontourai/console-kit`):
   ```
   console-kit/
     react/
       src/
         index.ts            # barrel export of all components
         Panel.tsx Badge.tsx StatusBadge.tsx Metric.tsx Progress.tsx Empty.tsx Rows.tsx
         Button.tsx          # NEW primitive (see below)
         Topbar.tsx          # NEW primitive (extract the common topbar shell)
         tones.ts            # shared semantic-tone mapping (single source of truth)
       package exports updated so consumers can:
         import { Panel, Badge } from "@kontourai/console-kit/react"
     react/styles.css        # component styles, written entirely against --k-* tokens
   ```
   - **Seed from** `kontour-console/console-ui/src/components/*.tsx` (they are tiny and
     purely presentational). Generalize props where they are coupled to kontour-specific
     types (e.g. `StatusBadge` currently imports `ConnectionStatus` from the app's
     `types.ts` — replace with a local/portable union or a generic `status: string`).
   - **`Badge` tone mapping → `tones.ts`.** Today `Badge` inlines a regex mapping
     domain words to `good/bad/warn/neutral`. Move it to `tones.ts` and map to the
     **semantic scale** so classes are `tone-positive | tone-caution | tone-negative |
     tone-active | tone-neutral`. `react/styles.css` styles `.tone-*` from
     `--k-positive/--k-caution/...`. Keep the regex extensible (export the mapping table).
   - **New `Button`**: variants `primary` (filled `--k-brand`, text `--k-brand-contrast`),
     `ghost`, and outcome variants (`positive|caution|negative`) for action rows like
     survey's accept/keep/reject. ClassName contract: `.btn .btn-<variant>`.
   - **New `Topbar`**: the eyebrow + title + meta-grid shell that recurs across products.
     ClassName contract documented for vanilla parity (Step 3).
   - All component CSS must use **only `--k-*` tokens** — no literal colors, spacing, radii,
     or font stacks. This is what makes the same components reusable + skinnable.
   - Build: add a `tsconfig` + build script (Vite library mode or `tsc`) producing
     consumable ESM + `.d.ts`. Mirror kontour-console's toolchain (TS 6, React 19, Vite 7).

2. **kontour-console adopts the package:**
   - Add dependency `"@kontourai/console-kit": "file:../../console-kit"` to
     `kontour-console/console-ui/package.json` (same `file:` pattern it already uses for
     `@kontour/console-core`).
   - Replace local `src/components/*` usage with imports from `@kontourai/console-kit/react`.
     Delete (or thin to re-exports) the local component files that are now provided by the
     package. Keep app-specific composites (`ProcessFlowDiagram`, `ProcessView`, `Rows` if
     it is app-coupled, the `sections/*`) in the app for now — only the **generic
     primitives** move.
   - Import the kit tokens + react styles in the app entry (`main.tsx` or `index.html`):
     `@kontourai/console-kit/tokens.css`, `@kontourai/console-kit/themes.css`,
     `@kontourai/console-kit/react/styles.css`. Apply `class="theme-console"` (and the dark
     default) on the app root.
   - **Reconcile `styles.css`:** kontour-console's `src/styles.css` currently defines its
     own `--bg/--panel/--good/...` and the app aesthetic (olive/lime, grid texture). Map
     these onto `--k-*`:
     - app `--bg/--panel/--panel-2/--line/--text/--muted/--dim/--shadow` → `--k-*` equivalents
     - app `--good/--warn/--bad` → `--k-positive/--k-caution/--k-negative`
     - app `--accent` (lime) → `--k-brand` via `.theme-console`
     - Keep the app's signature **grid/scanline background texture** — that is allowed
       product personality; just have it reference `--k-*` colors.
   - The app must keep working: SSE hub connection, sections, data flow — **presentation
     only**, no logic changes.

## Decisions to surface (don't block; use RECOMMENDED + note it)

- **Consumption:** RECOMMENDED `file:` dependency now; registry publish later. If the owner
  wants publishing now, document the registry + `publishConfig` but still wire `file:` for
  local dev.
- **Which components are "generic" vs app-specific:** RECOMMENDED move `Panel, Badge,
  StatusBadge, Metric, Progress, Empty, Button, Topbar`; leave `ProcessFlowDiagram,
  ProcessView, sections/*` in the app. If `Rows` is generic enough, move it; if it is
  coupled to app types, leave it.

## Constraints / DO-NOT-BREAK

- kontour-console scripts (from `kontour-console/console-ui/package.json`):
  `build` = `tsc -b && vite build`, `typecheck` = `tsc -b --noEmit`,
  `test` = `node --import tsx --test test/*.ts`, `dev`/`preview` = vite.
  All of `typecheck`, `test`, `build` must pass after adoption.
- Do not touch `console-core` / `console-server` logic, the hub client, or server API types.
- Component CSS: **no hard-coded colors/spacing/fonts** — tokens only. A quick grep for
  hex codes in `react/styles.css` should return (essentially) nothing.

## Verification (must pass before handoff)

From `kontour-console/console-ui/`:
```bash
npm install           # resolves the file: dependency
npm run typecheck
npm run test
npm run build
npm run dev           # then screenshot the running app
```
Visual parity: screenshot the kontour-console app before and after adoption — it must look
**equivalent** (same olive/lime industrial identity, now sourced from `theme-console` +
`--k-*`). Render a few `Badge`/`StatusBadge`/`Metric` states to confirm the semantic tones
map correctly.

Also confirm the **package builds standalone** from `console-kit/`:
```bash
cd console-kit && npm install && npm run build   # produces dist + .d.ts for ./react
```

## Acceptance criteria (how this will be evaluated)

- [ ] `@kontourai/console-kit/react` exports the primitives; `tones.ts` is the single
      tone→semantic source; all component CSS uses only `--k-*` (no literal colors).
- [ ] `Button` and `Topbar` primitives exist with documented className contracts.
- [ ] kontour-console depends on the package via `file:` and imports primitives + kit CSS.
- [ ] Local duplicated primitive files removed or reduced to re-exports.
- [ ] kontour-console `typecheck`, `test`, `build` all pass.
- [ ] Before/after screenshots show no visual regression; semantic tones render correctly.
- [ ] Package builds standalone with type declarations.
- [ ] `HANDOFF.md`: component inventory (moved vs kept), className contracts for `Badge`,
      `Button`, `Topbar`, `StatusBadge` (needed by Step 3), decisions/assumptions, screenshots.

## Out of scope

- No web components yet (Step 3).
- No changes to flow / survey app code in this step (survey already consumes tokens from
  Step 1; flow adoption is Step 3).
