# Step 3 Handoff: Vanilla Adoption + Elements

## Package scope

The package name is `@kontourai/console-kit`. Step 3 therefore ships the vanilla entry as `@kontourai/console-kit/elements`.

## Element implementation

Location: `console-kit/elements/`

The web components are light-DOM wrappers that emit the same className contracts documented in `HANDOFF-step2.md` and use the shared React tone resolver through `elements/react/tones.ts`.

| Element | Attributes | Emitted contract |
| --- | --- | --- |
| `k-badge` | `value`, `tone`, `class-name` | `<span class="badge tone-*">` |
| `k-status-badge` | `status`, `tone`, `class-name` | `<div class="status status-{normalized} tone-*">` |
| `k-panel` | `title`, `count`, `class-name` | `<section class="panel"><div class="panel-head"><h2>...` |
| `k-metric` | `label`, `value`, `class-name` | `<div class="metric"><span>...<strong>...` |
| `k-progress` | `value`, `class-name` | `<div class="progress"><span style="width: n%">` |
| `k-empty` | `label`, `class-name` | `<p class="empty">` |
| `k-button` | `label`, `variant`, `type`, `disabled`, `class-name` | `<button class="btn btn-{variant}">` |
| `k-topbar` | `eyebrow`, `title`, `body`, `meta`, `actions`, `aria-label`, `class-name` | `<section class="topbar">` with `.topbar-copy`, `.topbar-meta`, `.topbar-actions` |

`k-topbar` accepts `meta` as JSON array or `label:value|...`; `actions` accepts JSON array or `label:variant|...` and renders `.btn` children.

## Flow adoption

Location: `flow/src/console-ui/`

Flow stays light: `<html class="theme-flow" data-theme="light">`. Local variables are now aliases over `--k-*` tokens:

- `pass` -> `--k-positive`
- `block` -> `--k-negative`
- `wait` -> `--k-caution`
- `current` -> `--k-active`
- `accent` -> `--k-brand`

Consumption method:

- `src/console-kit/console-kit-tokens -> ../../../console-kit/tokens`
- `src/console-kit/console-kit-react-styles.css -> ../../../console-kit/react/styles.css`
- `scripts/copy-console-ui.mjs` dereferences those CSS assets into `dist/console-ui` so the built Flow console server loads the same token contract.

No `src/console-kit/app.ts` domain logic was changed.

## Survey adoption

Location: `survey/examples/review-workbench/`

Survey now loads package tokens via:

- `examples/review-workbench/console-kit-tokens -> ../../../console-kit/tokens`
- `<link rel="stylesheet" href="./console-kit-tokens/index.css">`
- `<html class="theme-survey">`

The workbench CSS retains its original layout selectors and validator substrings while aliasing its local presentation variables to `--k-*`. No survey `.ts` files were edited.

## Parity Gaps

No functional parity gaps found. The elements demo imports `dist/react/Badge.js` with a demo-only JSX runtime shim and renders `Badge({ value: "verified" })` beside `<k-badge value="verified">`; both produce matching `.badge tone-positive` DOM.

Reviewer remediation:

- `disconnected` now resolves to `tone-negative` before the broader `connected` positive matcher.
- `k-panel` defers rendering until connection so programmatic children are not captured as empty before append.
- `k-topbar` normalizes action variants to the Step 2 Button contract and falls back to `ghost`.
- Flow uses `var(--k-font-ui)`.
- Survey legacy color literals were rewritten to token-derived `color-mix()` values.

## Screenshots

- Survey initial: `plans/step3-survey-initial.png`
- Survey after `[data-decision="accept-proposed"]`: `plans/step3-survey-accept-proposed.png`
- Flow source presentation: `plans/step3-flow-source.png`
- Flow built smoke screenshot: `../flow/.flow-agents/flow-console-shell/console-smoke.png`
- Elements parity demo: `plans/step3-elements-demo.png`

## Verification

- `console-kit`: `npm run build` passed.
- `survey`: `npm run check:review-workbench` passed.
- `flow`: `npm run typecheck` passed.
- `flow`: `npm run typecheck:console-ui` passed.
- `flow`: `npm run build` passed.
- `flow`: `npm run test` passed with local-server permission for the console smoke bind.
- Browser screenshots captured over HTTP for survey, Flow, and the elements demo.

## Future

Surface/docs-site adoption was not started.
