# ADR 0001: Console Kit Token Contract

> Numbered ADRs in `docs/adr/` are frozen history: new decisions go to `docs/decisions/<slug>.md` in the [Corpus decision-record format](https://github.com/kontourai/corpus/blob/main/docs/decisions.md), citing this ADR as `adr` evidence.

## Status

Accepted

## Context

Kontour console products use different rendering stacks, but they already theme through CSS custom properties. A shared token layer lets React, vanilla TypeScript, and static HTML products look like one product family without forcing a renderer migration.

## Decision

Ship `@kontourai/console-kit` first as a CSS token package. Components and product styles read only `--k-*` tokens. Product-specific identity is limited to one brand color set by a theme class:

| Theme | Brand |
| --- | --- |
| `.theme-survey` | `--k-brand: #5ce0c6` |
| `.theme-console` | `--k-brand: #c9ff4a` |
| `.theme-flow` | `--k-brand: #2f88a6` |
| `.theme-surface` | `--k-brand: #14a37a` |

The package keeps dark mode as the default `:root` contract and provides a `[data-theme="light"]` override for light skins. Light-mode status hues are darkened in `tokens.css` for AA foreground contrast on white panels. Light-mode survey, flow, and surface brands are darkened in `themes.css` so brand text and accents remain usable on white panels.

The shared status scale maps product domain words to semantic tokens:

| Semantic token | survey | flow | kontour-console |
| --- | --- | --- | --- |
| `--k-positive` | verify | pass | good |
| `--k-caution` | hold | wait | warn |
| `--k-negative` | reject | block | bad |
| `--k-active` | in-review | current | - |
| `--k-neutral` | pending | - | dim |

## Token Names

The contract covers structure (`--k-bg`, `--k-panel`, `--k-panel-raised`, lines, shadow), text (`--k-text`, `--k-text-muted`, `--k-text-faint`), brand (`--k-brand`, `--k-brand-contrast`), status hues and soft companions, spacing, radius, typography, and motion.

## Contrast Notes

The shared starting values were preserved for dark mode except `--k-text-faint`, which uses `#72869b` so normal text on `--k-panel` meets WCAG AA. Light mode uses `#707782` for `--k-text-faint` and darker status hues (`#168257`, `#8a5a00`, `#c83b3b`, `#3f6fd6`, `#5f6975`) so status text also meets AA on white panels.

## Scope Note

The kit ships under the `@kontourai` package scope (owner-confirmed), matching the existing sibling products `@kontourai/survey`, `@kontourai/flow`, and `@kontourai/surface`. The kontour-console app keeps its own `@kontour/console-ui` name and takes a cross-scope dependency on `@kontourai/console-kit`; this ADR does not rename existing packages.

## Consequences

Products can adopt incrementally by importing the token CSS and mapping existing local variables to `--k-*`. Later React primitives must stay className-driven and token-only so the same stylesheet can skin React and non-React markup.
