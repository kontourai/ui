# Kontour Console Kit

**The shared design-token and component layer for Kontour consoles.**

`@kontourai/ui`

[![npm version](https://img.shields.io/npm/v/%40kontourai%2Fui)](https://www.npmjs.com/package/@kontourai/ui)
[![CI](https://github.com/kontourai/ui/actions/workflows/ci.yml/badge.svg)](https://github.com/kontourai/ui/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

Use Console Kit when you are building a Kontour console product (Surface Console, Flow Console, Survey Review Workbench, or a custom operator UI) and need to stay visually consistent with the `--k-*` token contract without copying CSS by hand. If you are building a general-purpose application with its own design system, you do not need this package.

Console Kit ships three layers:

- `@kontourai/ui/tokens` — CSS custom properties for any renderer, no framework required.
- `@kontourai/ui/react` — class-driven React primitives: display (`Badge`, `Button`, `Panel`, `Metric`, `Progress`, `Skeleton`, `Spinner`, `StatusBadge`, `StatusBar`, `Topbar`, `Empty`, `ProductIcon`), form controls (`Field`, `Input`, `Textarea`, `Select`, `Checkbox`, `Toggle`), and overlays/feedback (`Dialog`, `Toast`, `ToastHost`, `Tooltip`, `Popover`) that read the token contract.
- `@kontourai/ui/elements` — light-DOM web-component wrappers for vanilla products.

Package docs:

- `docs/consumer-guide.md` covers React, custom elements, static HTML, theme classes, and vendored asset sync.
- `docs/release-readiness.md` records the release and adopter verification matrix.
- [`docs/gallery.html`](docs/gallery.html) is the canonical static gallery for React/custom-element parity.

## Themes

Apply one product theme class on a stable root element to set the product identity:

```html
<main class="theme-survey">...</main>
```

| Theme class | Product | Brand accent | Design intent |
| --- | --- | --- | --- |
| `theme-survey` | Survey / Review Workbench | `#5ce0c6` teal | Evidence-forward; minimal overrides on the default dark shell |
| `theme-console` | Kontour Console | `#c9ff4a` lime-green | Dense operator plane; condensed font, zero radius, high-contrast palette |
| `theme-flow` | Flow | `#2f88a6` blue | Process-transparency; cool accent on the default dark shell |
| `theme-surface` | Surface | `#14a37a` green | Trust-state inspection; earthy-green accent on the default dark shell |

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

Or import individual files:

```css
@import "@kontourai/ui/fonts.css";
@import "@kontourai/ui/tokens.css";
@import "@kontourai/ui/themes.css";
```

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
- `npm run check:exports` builds and verifies package export targets, ESM output, declaration files, package naming, and framework-free element output.
- `npm run check:readiness` verifies release docs, gallery, package metadata, and adopter contract markers.
- `npm run check:pack` previews package contents with `npm pack --dry-run`.
- `npm run verify` runs all package readiness checks.
