# Step 2 Handoff: React Core

## Approach

- Package scope is `@kontourai/console-kit`.
- `kontour-console/console-ui` consumes the kit through `"@kontourai/console-kit": "file:../../console-kit"`.
- The app imports kit token files and React primitive styles once from `src/main.tsx`, then keeps app-specific layout and texture in local CSS.
- `theme-console` is applied on the document root in `kontour-console/console-ui/index.html` so root-level app aliases and body background read the console theme.
- Local app primitive files were thinned to re-export portable kit primitives where possible. App-specific row, process, and diagram components stayed local.

## Component Inventory

Moved to `@kontourai/console-kit/react`:

- `Badge`
- `StatusBadge`
- `Panel`
- `Metric`
- `Progress`
- `Empty`

New in `@kontourai/console-kit/react`:

- `Button`
- `Topbar`
- `tones.ts` semantic tone helpers

Kept app-local:

- `Rows.tsx`: console-core row composition, now imports kit `Badge`.
- `ProcessView.tsx`: console-core process composition, now imports kit `Badge` and `Progress`.
- `ProcessFlowDiagram.tsx`: console-core SVG visualization.
- Section components and hub connection logic.

Thin re-export files in `kontour-console/console-ui/src/components/`:

- `Badge.tsx`
- `StatusBadge.tsx`
- `Panel.tsx`
- `Metric.tsx`
- `Progress.tsx`
- `Empty.tsx`

## ClassName Contracts

`Badge`

- Root element: `span.badge`
- Tone class: `tone-positive | tone-caution | tone-negative | tone-active | tone-neutral`
- Optional caller class is appended after the tone class.
- Default tone is derived with `toneForValue(value)`.

`StatusBadge`

- Root element: `div.status`
- Status class: `status-${normalizedClassSuffix(status)}`
- Tone class: `tone-positive | tone-caution | tone-negative | tone-active | tone-neutral`
- Optional caller class is appended after the tone class.
- Status is a portable `string`, no `ConnectionStatus` import.

`Button`

- Root element: `button.btn`
- Variant class: `btn-primary | btn-ghost | btn-positive | btn-caution | btn-negative`
- Optional caller class is appended after the variant class.
- Accepts native `ButtonHTMLAttributes<HTMLButtonElement>`.

`Topbar`

- Root element: `section.topbar`
- Copy wrapper: `.topbar-copy`
- Eyebrow: `.eyebrow`
- Title: `h1` inside `.topbar-copy`
- Optional body wrapper: `.topbar-body`
- Optional metadata grid: `.topbar-meta`
- Metadata item: `.topbar-meta-item`
- Optional actions wrapper: `.topbar-actions`
- Optional caller class is appended on `.topbar`.

## Tone Mapping

Semantic tones are `positive`, `caution`, `negative`, `active`, and `neutral`.

- `positive`: passed, verified, fresh, completed, accepted, resolved, connected, good, success
- `caution`: open, waiting, pending, warn, warning, hold, escalated
- `negative`: failed, blocked, stale, error, rejected, bad, disconnect
- `active`: running, current, active, in-review, connecting, proposed
- fallback: `neutral`

## Decisions And Assumptions

- React component CSS uses only `--k-*` tokens. Local app CSS may keep layout-specific app variables, but those variables are aliases or mixes from `--k-*`.
- Console app grid and scanline texture stayed local and now references token-derived aliases.
- The console theme overrides `--k-font-ui` and `--k-font-display` with the old condensed console stack to preserve visual parity.
- The console theme also sets square radius tokens so kit primitives retain the old console edge treatment without app-local primitive CSS.
- Because `theme-console` now lives on `<html>`, light theme selectors support both `[data-theme="light"].theme-console` and descendant theme usage.
- A console light palette was added to make `[data-theme="light"]` coherent for the root theme placement.
- Review follow-up trimmed duplicated app-local primitive styling for `StatusBadge`, `Metric`, `Panel`, `Badge`, and `Progress`; app CSS now leaves those base primitive contracts to the kit and keeps only app layout/texture overrides.

## Screenshots

- Before adoption: `plans/artifacts/kontour-console-before-step2-1440x1200.png`
- After adoption: `plans/artifacts/kontour-console-after-step2-1440x1200.png`
- Light theme check: `plans/artifacts/kontour-console-light-step2-1440x1200.png`

## Verification

- `console-kit`: `npm install` passed.
- `console-kit`: `npm run build` passed and emitted ESM plus `.d.ts` under `dist/react/`.
- `kontour-console/console-ui`: `npm install` passed.
- `kontour-console/console-ui`: `npm run typecheck` passed.
- `kontour-console/console-ui`: `npm run test` passed, 4 tests.
- `kontour-console/console-ui`: `npm run build` passed.
- `console-kit/react/styles.css` grep found no literal hex/rgb colors and no non-`--k-*` custom-property reads.
- `kontour-console/console-ui/src/styles.css` grep found no duplicate app-local base blocks for `.status`, `.metric`, `.badge`, `.progress`, `.panel`, `.tone-good`, `.tone-warn`, or `.tone-bad` after review cleanup.
- `npm run dev` was served over HTTP for screenshot verification.
