# Step 1 Handoff — Token Contract + Survey Proof

## Approach

- Chose the recommended vendored proof for survey.
- Authored `@kontourai/console-kit` as a CSS-only package in `console-kit/`.
- Copied `tokens.css`, `themes.css`, and `fonts.css` into `survey/examples/review-workbench/` and imported them at the top of `review-workbench.css`.
- Applied `theme-survey` to `<main id="review-workbench">` in the survey example.
- Kept a thin survey-local alias block so existing selectors and visual behavior remain stable while values resolve from `--k-*`.

## Token And Contrast Notes

- Preserved the shared starting palette except `--k-text-faint`.
- Adjusted dark `--k-text-faint` from `#6f8095` to `#72869b` for WCAG AA on `--k-panel`.
- Adjusted light `--k-text-faint` from `#8a909a` to `#707782` for WCAG AA on `--k-panel`.
- Added light-mode status overrides for AA foreground contrast on white panels.
- Added light-mode brand overrides for survey, flow, and surface where brand text/accent usage needs darker hues on white panels.

Contrast checks on `--k-panel`:

| Pair | Contrast |
| --- | ---: |
| dark `--k-text` on `--k-panel` | 15.94 |
| dark `--k-text-muted` on `--k-panel` | 9.20 |
| dark `--k-text-faint` on `--k-panel` | 4.74 |
| light `--k-text` on `--k-panel` | 16.10 |
| light `--k-text-muted` on `--k-panel` | 6.17 |
| light `--k-text-faint` on `--k-panel` | 4.52 |
| light `--k-positive` on `--k-panel` | 4.81 |
| light `--k-caution` on `--k-panel` | 5.93 |
| light `--k-negative` on `--k-panel` | 5.07 |
| light `--k-active` on `--k-panel` | 4.71 |
| light `--k-neutral` on `--k-panel` | 5.58 |

## Assumptions

- `@kontourai/console-kit` remains under the `@kontour` scope per plan; existing `@kontourai/*` package scopes are unchanged.
- The survey vendored copy is temporary until survey takes a real package dependency in a later step.
- No registry publishing, React components, or changes to flow/surface/kontour-console were included.
- The post-click accept-proposed state advances the review session according to existing workbench behavior; the proof did not alter TypeScript or fixtures.

## Verification

- `npm run check:review-workbench` from `survey/`: PASS.
- Required survey validator substrings preserved:
  - `@media (max-width: 980px)`
  - `.workbench-shell`
  - `grid-template-columns: minmax(0, 1fr) minmax(0, 520px)`
  - `overflow-wrap: anywhere`
- Served over HTTP from `survey/` on port `8765`.
- Final screenshots at viewport `1440x1200`:
  - `console-kit/plans/artifacts/review-workbench-initial-1440x1200.png`
  - `console-kit/plans/artifacts/review-workbench-accept-proposed-1440x1200.png`
  - `console-kit/plans/artifacts/review-workbench-light-1440x1200.png`
- Visual check: dark initial state keeps the forensic mint design, value hero, queue colors, status pills, decision controls, demoted JSON, and no obvious overlap.
- Visual check: accept-proposed click shows the accepted state and session count update without layout breakage.
- Visual check: `[data-theme="light"]` on `<html>` produces a coherent light skin with readable panels, text, accents, and active controls.
