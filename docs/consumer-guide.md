# Kontour UI Consumer Guide

`@kontourai/ui` ships three layers:

- CSS tokens: `@kontourai/ui/tokens`
- React primitives: `@kontourai/ui/react`
- Light-DOM custom elements: `@kontourai/ui/elements`

and a white-label contrast validator, `@kontourai/ui/contrast` (see
[Validating a white-label theme](#validating-a-white-label-theme)).

## Theme Boundary

Apply exactly one product theme class on a stable root:

```html
<html class="theme-console">
```

Available product classes:

- `theme-console`
- `theme-flow`
- `theme-station`
- `theme-survey`
- `theme-surface`

Use `data-theme="light"` on the same root, an ancestor, or a descendant of the theme root when a
product needs the light token skin; each resolves to the product's light values. Modes and themes
nest: the nearest `data-theme` picks the mode and the nearest theme class picks the product, so
`data-theme="dark"` inside a light page restores the dark skin, and a light element below a nested
theme takes that inner theme's light values. A nested theme class layers over the theme around it.
One case is not covered: a theme class below a mode that switches back (light, dark, then light
again above it); put `data-theme` on that theme element. See "Theme and mode scoping" in
`DESIGN.md`.

## White-label color

The token layer keeps the product identity slot (`--k-brand`) separate from the interaction
roles. Overriding `--k-brand` changes identity accents (eyebrows, panel counts, topbar edge,
progress, spinner) without recoloring primary buttons, checked controls, or focus.

Where to put an override:

- Give each mode its own values.
- Declare them in a stylesheet loaded after the tokens, using the theme's own selectors:

```css
.theme-flow,
[data-theme="dark"]:where(.theme-flow *):where([data-theme="light"] *):where(:not(.theme-survey, .theme-console, .theme-surface, .theme-station, .theme-flow :is(.theme-survey, .theme-console, .theme-surface, .theme-station) *)) {
  --k-brand: #f0a868;
  --k-action: #f0a868;
  --k-action-contrast: #06080b;
  --k-focus: #f0a868;
}
[data-theme="light"].theme-flow,
[data-theme="light"] .theme-flow:where(:not([data-theme="dark"], [data-theme="light"] [data-theme="dark"] *)),
:where(.theme-flow) [data-theme="light"]:where(:not(.theme-survey, .theme-console, .theme-surface, .theme-station, .theme-flow :is(.theme-survey, .theme-console, .theme-surface, .theme-station) *)) {
  --k-brand: #9a4418;
  --k-action: #9a4418;
  --k-action-contrast: #ffffff;
  --k-focus: #9a4418;
}
```

Copy the selectors exactly as `tokens/themes.css` spells them. Where a form has a
`:where(:not(...))` tail, copy that too: the tail keeps the block to the nearest theme and mode. The dark values go on the theme's base
block and on its dark-island block (the second selector of the first rule, from the end of
`tokens/themes.css`), which is where a `data-theme="dark"` element inside a light page resolves.
A browser test loads this example straight from this file.

Without a theme class, override `:root` and `[data-theme="dark"]:where([data-theme="light"] *)`
together for dark (the second is where a dark element below a light one resets), and
`[data-theme="light"]` for light.

A declaration on `:root` loses to the theme's light block when a theme class is present, and an
inline style on `<html>` does not reach a theme class on `<body>`.

> **Migrating overrides.** Dark elements inside a light page now really resolve dark, so an
> override written with the earlier selectors can misplace values:
>
> - `.theme-flow` alone (dark): add the dark-island block. Without it, a
>   `data-theme="dark"` element below a light one shows the shipped Flow brand, not yours.
> - `[data-theme="light"] .theme-flow` without its `:where(:not(...))` tail: add the tail.
>   Without it, a `.theme-flow` element with `data-theme="dark"` on a light page takes your
>   light values onto dark surfaces.
> - `:where(.theme-flow) [data-theme="light"]` without its tail: add it, so your light values
>   stop at a nested theme.
> - `:root` only (no theme class): add `[data-theme="dark"]:where([data-theme="light"] *)`.

Rules for the values:

- Brand used as text must meet 4.5:1 on the panel in each mode. If you put text on a brand fill,
  set `--k-brand-contrast` and check that pair too.
- Override `--k-action` and `--k-action-contrast` together, per mode. A fill without its matching
  text can drop below 4.5:1.
- `--k-focus` must reach 3:1 against both the page and the panel.
- A runtime that applies themes dynamically must reject a pair that fails these thresholds (the
  ones `npm run check:contrast` enforces for the shipped themes). See
  [Validating a white-label theme](#validating-a-white-label-theme).

### Validating a white-label theme

`@kontourai/ui/contrast` is for a runtime that applies an override from data (a config file, an
API) instead of a reviewed stylesheet. It is plain ESM with no imports, so the same module runs in
the browser and on a Node server, and `npm run check:contrast` rates the shipped themes through
the same functions and thresholds, so the package and a runtime cannot disagree.

```js
import { validateBrandOverride } from "@kontourai/ui/contrast";

const { violations, accepted } = validateBrandOverride({
  base: "flow", // the shipped theme the override is applied over
  overrides: JSON.parse(themeJson), // pass the parsed object itself
  // e.g. {"dark":  {"--k-brand": "#f0a868", "--k-action": "#f0a868", "--k-action-contrast": "#06080b", "--k-focus": "#f0a868"},
  //       "light": {"--k-brand": "#9a4418", "--k-action": "#9a4418", "--k-action-contrast": "#ffffff", "--k-focus": "#9a4418"}}
});
if (violations.length > 0) {
  // Messages echo caller data (cut to 64 characters): escape before rendering.
  for (const violation of violations) console.warn(violation.message);
  // Fall back to the shipped theme; never apply part of a rejected override.
} else {
  applyTheme(accepted); // your code: write accepted.dark / accepted.light to the theme's selectors
}
```

What it checks:

- **Shape.** Pass the object `JSON.parse` returned. Only plain objects are read: a `Map`, a class
  instance, an object from another realm (an iframe), or a non-object input is an
  `invalid-shape` violation, so an unusual input fails closed. An unknown `base` throws.
- **Keys.** Only `--k-brand`, `--k-brand-contrast`, `--k-action`, `--k-action-contrast`, and
  `--k-focus` (`BRAND_SLOT_PROPERTIES`), under a `dark` or `light` key. Anything else is a
  `disallowed-property` or `invalid-shape` violation.
- **Values.** `#rgb` or `#rrggbb` only (`isHexColor`). Alpha hex, keywords, `rgb()`, `var()`,
  and surrounding whitespace are `invalid-value`: they are rejected, not interpreted.
- **The action pair.** `--k-action` without `--k-action-contrast` (or the reverse) in a mode is
  `unpaired-action`, even when the ratio would pass.
- **Contrast** (`BRAND_SLOT_PAIRS`): action text on the action fill 4.5:1; the action fill on the
  panel 3:1; brand as text on the panel 4.5:1; brand as a UI accent on the page 3:1;
  brand-contrast text on the brand 4.5:1; focus on the page and on the panel 3:1. A mode's
  override is laid over the base theme's shipped values for that mode, and only pairs that
  include an overridden property are rated, so an override is judged on what it changes.

`accepted` is all or nothing. When `violations` is empty it holds fresh, frozen, null-prototype
copies of the validated values for each mode sent; otherwise it is empty, so applying it can never
land half an override (light applied while dark was rejected). Apply `accepted` rather than the
input: each input value is read once, so what lands is exactly what was rated. A getter or Proxy
trap on the input that throws propagates the exception; `JSON.parse` output has neither, so pass
that.

The surfaces come from the package rather than the caller: an override cannot change `--k-bg` or
`--k-panel`, so the only surfaces it can land on are the shipped ones. `SHIPPED_THEMES` exposes
them for information; `check:contrast` fails if it drifts from the token files. Validate with the
same `@kontourai/ui` version whose CSS you serve, since a different version's surfaces may differ.
`contrastRatio(a, b)` and `relativeLuminance(hex)` are exported too and throw a `TypeError` for
anything but `#rgb` / `#rrggbb`.

Consumer CSS should read `--k-focus` for focus color. `--k-focus-ring` is kept as an alias for
existing styles, but it does not follow an inline `--k-focus` override on a descendant element.

**Migration from brand-only retints.** Before this change, overriding `--k-brand` also repainted
primary buttons, toggles, checkboxes, and focus rings. To keep that behavior (for example, a
release-channel accent), set `--k-action`, `--k-action-contrast`, and `--k-focus` alongside
`--k-brand`.

## React Consumer

Install locally while unpublished:

```json
{
  "dependencies": {
    "@kontourai/ui": "file:../../ui"
  }
}
```

Import tokens and primitive styles once:

```ts
import "@kontourai/ui/tokens";
import "@kontourai/ui/react/styles.css";
```

`@kontourai/ui/tokens` is the whole token layer — base tokens, themes, and the brand
`@font-face` rules. Importing `tokens.css` and `themes.css` individually gives you the
`--k-font-*` variables without the faces they name, so the surface renders in fallbacks.

Use primitives from the React entry:

```tsx
import { Badge, Button, Panel, StatusBadge, Topbar } from "@kontourai/ui/react";

export function Header() {
  return (
    <Topbar
      eyebrow="Console"
      title="Run Review"
      body="Package-backed primitives read the active --k-* theme."
      actions={<Button>Refresh</Button>}
    />
  );
}
```

Form controls share one control contract and pair with `Field` for the
label/hint/error row:

```tsx
import { Field, Input, Select, Checkbox, Toggle } from "@kontourai/ui/react";

export function RunSettings() {
  return (
    <>
      <Field label="Project name" htmlFor="name" hint="Shown in the run header.">
        <Input id="name" placeholder="my-service" />
      </Field>
      <Field label="Runtime" htmlFor="runtime">
        <Select
          id="runtime"
          placeholder="Choose a runtime"
          options={[
            { label: "Claude Code", value: "claude" },
            { label: "Codex", value: "codex" },
          ]}
        />
      </Field>
      <Checkbox label="Require evidence" defaultChecked />
      <Toggle label="Gate on readiness" defaultChecked />
    </>
  );
}
```

`Dialog` is a controlled modal built on the native `<dialog>` element (top-layer,
backdrop, focus trap, and Esc handling come from the platform):

```tsx
import { useState } from "react";
import { Button, Dialog } from "@kontourai/ui/react";

export function ConfirmMerge() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>Merge</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Confirm merge"
        actions={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="positive" onClick={() => setOpen(false)}>Merge</Button>
          </>
        }
      >
        Merging closes the gate. This action is recorded in the run receipt.
      </Dialog>
    </>
  );
}
```

`Dialog` is a stateful primitive (it uses React hooks), unlike the pure-factory
display primitives. Vanilla consumers use the mirrored `k-dialog` custom element,
which owns the same behavior and class contract — toggle its `open` attribute to
show/hide and listen for the `k-dialog-close` event.

`Toast`/`ToastHost` are presentational — render them and drive their lifecycle
from app state. For an imperative "fire from anywhere" stack with auto-dismiss,
mount the `k-toast-host` element once and call its `notify()` method:

```html
<k-toast-host id="toasts" placement="bottom"></k-toast-host>
<script type="module">
  document.getElementById("toasts").notify({
    tone: "positive",
    title: "Readiness met",
    message: "All gates passed.",
    duration: 4000, // 0 keeps it until dismissed
  });
</script>
```

`Tooltip` is a CSS-driven hover/focus bubble (pure factory); `Popover` is a
click-triggered panel (stateful — outside-click and Esc dismiss). Both anchor to
their trigger and layer at the `--k-z-popover` tier:

```tsx
import { Button, Popover, Tooltip } from "@kontourai/ui/react";

<Tooltip label="Recorded in the run receipt">
  <Button>Merge</Button>
</Tooltip>

<Popover trigger={<Button>Actions</Button>} placement="bottom-start">
  <ul>…menu…</ul>
</Popover>;
```

Vanilla consumers use `k-tooltip` (label attribute + trigger child) and
`k-popover` (mark children with `data-popover-trigger` / `data-popover-panel`).

## Custom Elements Consumer

Load CSS and the element module:

```html
<link rel="stylesheet" href="./vendor/ui/tokens/index.css">
<link rel="stylesheet" href="./vendor/ui/react/styles.css">
<script type="module" src="./vendor/ui/dist/elements/elements/src/index.js"></script>
```

Render light-DOM components:

```html
<k-badge value="verified"></k-badge>
<k-status-badge status="connected"></k-status-badge>
<k-button label="Accept" variant="positive"></k-button>
```

Custom elements emit the same class contracts as the React primitives, so the shared `react/styles.css` file styles both renderers.

## Static HTML Consumer

Static sites should not depend on symlinks at runtime. Copy package assets into the served tree during build and run a drift check in verification.

Required assets:

- `tokens/` — including `tokens/fonts/`, which holds the woff2 faces `fonts.css` points at
- `react/styles.css` if using primitives or custom elements
- `react/trust-state.css` instead, if the only primitive is a string-rendered trust-state chip
- `dist/react/trust-states.js` if the page renders trust-state chips as strings in the browser
- `dist/elements/elements/src/` if using custom elements

Rules:

- Do not fork token files without a sync/drift check.
- Keep the product identity in a theme class, not in copied primitive CSS.
- Use `--k-*` tokens for local styles and derive product-specific aliases from `--k-*`.

## Trust States

Use a trust state, not a status tone, for the status of a claim. The states are Surface's claim
statuses, in Surface's order, with Surface's display names as default labels: `unknown` (No
evidence), `proposed` (Pending review), `assumed`, `verified`, `stale` (Needs refresh),
`disputed`, `superseded`, `rejected`, `revoked`. Each renders a text label, an SVG glyph, and a
line style, so the meaning survives without color; put the evidence in the detail.

```tsx
import { TrustState } from "@kontourai/ui/react";

<TrustState state="verified" detail="12 source records matched" />
<TrustState state="stale" label="Expired" detail="Verification expired 3 days ago" />
```

```html
<k-trust-state state="disputed" detail="Invoice and contract disagree on the amount"></k-trust-state>
<k-trust-state state="verified"><a href="#evidence">12 source records</a></k-trust-state>
```

- `label` replaces the visible wording; the default label stays available to assistive
  technology as visually hidden text, and an empty label falls back to the default.
- The element takes its detail from the `detail` attribute, or else from its children. Children
  are read once, on the first render; children added later are not picked up.
- `trustStateFor(value)` accepts any casing and surrounding space and returns `null` for
  anything else. An unrecognized state renders as its own text with no state styling or glyph.
- Chart series can reuse the ink `--k-trust-<state>`. The line token `--k-trust-<state>-line` is a
  CSS border-style keyword, not a stroke value, so translate it (DESIGN.md, "Data
  Visualization"): solid is no dash array, dashed and dotted become a `stroke-dasharray`
  pattern, and double has no stroke equivalent (draw two strokes or use the glyph as a marker).

### Trust states as HTML strings

Renderers that build markup as template strings (a server page, a shadow-DOM panel, a console
built without a framework) import `@kontourai/ui/trust-state`. It imports nothing, so it pulls in
neither React nor the custom elements, and it runs in Node or a browser.

```ts
import { renderTrustStateHtml } from "@kontourai/ui/trust-state";

panel.innerHTML = renderTrustStateHtml(claim.status, {
  label: claim.statusLabel, // optional; blank falls back to the default label
  detail: "12 source records matched", // optional, plain text
});
```

- The output is the markup `<k-trust-state>` renders for the same `state`, `label`, `detail`,
  and `class-name` (a browser test compares them for every state). Every value written into the
  markup is HTML-escaped: the label, detail, class name, and an unrecognized state's text, and
  also the state name and glyph path. Pass plain text, not markup.
- An unrecognized state renders exactly as the element renders it: its own text, with no state
  class, `data-trust-state`, or glyph. It is never coerced into a state.
- The module also exports the data the three renderers share. The tables are frozen, so they
  cannot be changed at runtime: `trustStates`, `trustStateLabels`, `trustStateGlyphs` (the SVG
  path per state). It also exports `trustStateFor` and
  `trustStatePresentation(state, label, className)` (the classes, visible and hidden labels,
  and glyph for one chip).

A string consumer must put two things on the page:

1. The token layer: `@kontourai/ui/tokens` (or `tokens.css` and `themes.css`, plus `fonts.css`
   for the faces). The chip reads the trust, neutral, space, type, and radius tokens.
2. The chip rules: `@kontourai/ui/trust-state.css`. It holds only the trust-state rules and no
   tokens, so it can be inlined at build time. It is generated from `react/styles.css`
   (`npm run check:trust-state-css` fails when they differ), so do not load both; a page that
   already loads `react/styles.css` has these rules.

## Trust Basis

The trust-basis line follows a trust-state chip and says how the claim's status was established:
`1 cited only · Extracted from a source · 2 entail the claim` (caveats first). Surface computes it: pass the
view from `claimBasisView` in `@kontourai/surface/display` as-is. Kontour UI does not depend on
Surface; your app does.

```tsx
import { claimBasisView } from "@kontourai/surface/display";
import { TrustBasis, TrustState } from "@kontourai/ui/react";

// Pass the claim's evidence or the whole bundle's: only evidence linked to this
// claim (claimId === claim.id) is used, never execution-trail tool calls.
const basis = claimBasisView(claim, bundle.evidence);

<TrustState state={claim.status} />
<TrustBasis basis={basis} />
<TrustBasis basis={basis} density="inspector" />
```

```html
<k-trust-state state="verified"></k-trust-state>
<k-trust-basis id="basis"></k-trust-basis>
<script type="module">
  import { claimBasisView } from "@kontourai/surface/display";
  document.querySelector("#basis").basis = claimBasisView(claim, bundle.evidence);
</script>

<!-- Or serialize the view into an attribute: -->
<k-trust-basis density="inspector" basis-json='{"state":"not-recorded","label":"Basis not recorded"}'></k-trust-basis>
```

- Do not build, filter, reorder, or relabel facets yourself; the line's order (caveats first) and
  words are Surface's, so every product shows the same basis.
- For a permission denial or a failed read, which only the host knows about, pass
  `missingClaimBasisView("restricted")` or `missingClaimBasisView("unavailable")`, or
  `missingClaimBasisView("not-available")` when you cannot or should not say which.
- The line is never blank. A missing or malformed view renders "Basis not available" and logs a
  console warning. One malformed facet or detail row is enough: the component never renders a
  partial line, since that could drop a caveat.
- `density="inspector"` adds one labelled row per detail (How, Support, Results, Derived, Review,
  Producer rating, Calibrated confidence, Sources) below the line.
- The `basis` property takes precedence over `basis-json`; setting it to `null` or `undefined` falls
  back to the attribute. A `basis` set before the element is defined is kept.
- Caveat facets are underlined with a dashed line in the text's own color
  (`--k-basis-caveat-decoration`). Style the line with neutral tokens only; do not color it by
  status or caveat.

## Tone Mapping

Product-specific domain words should map to the shared semantic scale:

- `positive`
- `caution`
- `negative`
- `active`
- `neutral`

Examples:

- Survey `verified` -> positive
- Flow `current` -> active
- Review `blocked` -> negative
- Queue `pending` -> caution or neutral, depending on product semantics

## Verification

Package consumers should run their own build/test command plus any asset drift check. The current cross-adopter command matrix lives in `docs/release-readiness.md`.
# Explorer

`docs/gallery.html` is the package's development/reference explorer. Its
`docs/explorer-manifest.json` is generated from the real public React exports,
custom-element registration AST, CSS token declarations, and CSS theme selectors.
Each curated component declares the CSS classes its implementation renders; the
manifest derives the complete `var(--k-*)` dependency set for those classes,
including spacing, typography, focus, and motion tokens. The explorer check
independently recomputes that mapping, so incomplete token lists are rejected.
Its generated text controls use visible native labels, so placeholders are only
supplemental hints. Regenerate it with
`node scripts/generate-explorer-manifest.mjs --write`; `npm run check:explorer`
rejects stale manifests or incomplete metadata. The explorer is documentation
only and is not an importable production bundle for adopters.
