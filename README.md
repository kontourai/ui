# Kontour UI

**The shared design-token and component layer for Kontour product interfaces.**

`@kontourai/ui`

[![npm version](https://img.shields.io/npm/v/%40kontourai%2Fui)](https://www.npmjs.com/package/@kontourai/ui)
[![CI](https://github.com/kontourai/ui/actions/workflows/ci.yml/badge.svg)](https://github.com/kontourai/ui/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

Use Kontour UI when you are building a Kontour product interface (Surface
Console, Flow Console, Survey Review Workbench, Station, or a custom operator
surface) and need to stay visually consistent with the `--k-*` token contract
without copying CSS by hand. If you are building a general-purpose application
with its own design system, you do not need this package.

Kontour UI ships three layers:

- `@kontourai/ui/tokens` — CSS custom properties for any renderer, no framework required.
- `@kontourai/ui/react` — class-driven React primitives: display (`Badge`, `Button`, `Panel`, `Metric`, `Progress`, `Skeleton`, `Spinner`, `StatusBadge`, `StatusBar`, `Topbar`, `TrustState`, `TrustBasis`, `Empty`, `ProductIcon`), form controls (`Field`, `Input`, `Textarea`, `Select`, `Checkbox`, `Toggle`), and overlays/feedback (`Dialog`, `Toast`, `ToastHost`, `Tooltip`, `Popover`) that read the token contract.
- `@kontourai/ui/elements` — light-DOM web-component wrappers for vanilla products.

It also exports `@kontourai/ui/contrast`, a dependency-free module for runtimes that apply a
white-label theme from data: it rejects a brand-slot override that fails the thresholds the
shipped themes meet (see "Validating a white-label theme" in `docs/consumer-guide.md`).

For products that build markup as HTML strings, `@kontourai/ui/trust-state` exports the
trust-state chip without React or custom elements: `renderTrustStateHtml(state, { label, detail,
className })` returns the markup `<k-trust-state>` renders, with every interpolated value HTML-escaped, beside
the presentation data (the frozen tables `trustStates`, `trustStateLabels`, `trustStateGlyphs`, and the helpers `trustStateFor` and
`trustStatePresentation`). Style it with the tokens plus `@kontourai/ui/trust-state.css`, which
holds only the chip rules (see "Trust States" in `docs/consumer-guide.md`).

Package docs:

- `docs/consumer-guide.md` covers React, custom elements, static HTML, theme classes, and vendored asset sync.
- `docs/release-readiness.md` records the release and adopter verification matrix.
- [`docs/gallery.html`](docs/gallery.html) is the canonical static gallery for React/custom-element parity.

## Themes

Apply one product theme class on a stable root element to set the product identity:

```html
<main class="theme-survey">...</main>
```

| Theme class | Product | Brand (`--k-brand`, dark / light) | Design intent |
| --- | --- | --- | --- |
| `theme-survey` | Survey / Review Workbench | `#5ce0c6` / `#107e6d` teal | Evidence-forward; minimal overrides on the default dark shell |
| `theme-console` | Kontour Console | `#c9ff4a` / `#577800` lime-green | Dense operator plane; condensed font, zero radius, high-contrast palette |
| `theme-flow` | Flow | `#3890ae` / `#1f6f88` blue | Process-transparency; cool accent on the default dark shell |
| `theme-station` | Station | `#966aff` / `#7c3aed` violet | Draft violet accent adjusted for readable brand text on dark panels |
| `theme-surface` | Surface | `#14a37a` / `#0f6b52` green | Trust-state inspection; earthy-green accent on the default dark shell |

All themes support `[data-theme="light"]` for light-mode overrides. See [`docs/gallery.html`](docs/gallery.html) for rendered examples of each theme in both modes.

## React

Import primitive styles once at your app root:

```ts
import "@kontourai/ui/react/styles.css";
```

Then use the primitives:

```ts
import { Badge, Button, Panel, StatusBadge, Topbar } from "@kontourai/ui/react";
```

## Custom elements

Load the element module for vanilla or web-component-based products:

```html
<script type="module" src="./vendor/ui/dist/elements/elements/src/index.js"></script>
```

Then render:

```html
<k-badge value="verified"></k-badge>
<k-status-badge status="connected"></k-status-badge>
<k-button label="Accept" variant="positive"></k-button>
```

## Token import

Import the full token layer:

```css
@import "@kontourai/ui/tokens";
```

That one import is sufficient: it pulls in the base tokens, the theme classes, and the
`@font-face` rules for the brand faces. The individual files stay exported for consumers
that compose them by hand:

```css
@import "@kontourai/ui/fonts.css";
@import "@kontourai/ui/tokens.css";
@import "@kontourai/ui/themes.css";
```

Skipping `fonts.css` gives you the `--k-font-*` variables without the faces they name, and
the surface silently renders in fallback typography.

## Fonts

The brand faces ship inside the package as woff2 and are declared with real `@font-face`
rules — nothing is fetched from a third party at render time. A product with
`default-src 'self'`, the right posture for a tool handling someone's documents, gets the
brand typography with no CSP allowance and no network request.

| Token | Family | Weights | License |
| --- | --- | --- | --- |
| `--k-font-display` | Fraunces (variable) | 100–900 | SIL OFL 1.1 |
| `--k-font-ui` | Hanken Grotesk (variable) | 100–900 | SIL OFL 1.1 |
| `--k-font-mono` | IBM Plex Mono | 400, 500, 600 | SIL OFL 1.1 |

Coverage is latin + latin-ext; anything outside those ranges falls through to the fallback
stacks in `tokens.css`. Licenses ship alongside the files, and `tokens/fonts/README.md`
records provenance. `node scripts/vendor-fonts.mjs` regenerates both the files and
`tokens/fonts.css`.

For static HTML consoles served without a bundler, add a local package dependency and copy the CSS assets into the product's asset tree during build or setup:

```json
{
  "devDependencies": {
    "@kontourai/ui": "file:../ui"
  }
}
```

```html
<link rel="stylesheet" href="./vendor/ui/tokens/index.css">
<link rel="stylesheet" href="./vendor/ui/react/styles.css">
```

Products should style components with `--k-*` variables and treat the product theme class as the product identity boundary. Domain status words map to the shared semantic scale: positive, caution, negative, active, and neutral.

## Checks

- `npm run check:tokens` verifies the token/theme contract and keeps React styles token-only.
- `npm run check:contrast` rates every shipped theme and mode against the WCAG pairs, through the same functions and thresholds `@kontourai/ui/contrast` exports; `npm run test:unit` tests that module.
- `npm run check:exports` builds and verifies package export targets, ESM output, declaration files, package naming, and framework-free element output.
- `npm run check:readiness` verifies release docs, gallery, package metadata, and adopter contract markers.
- `npm run check:pack` previews package contents with `npm pack --dry-run`.
- `npm run verify` runs all package readiness checks.
