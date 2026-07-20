# Kontour UI Consumer Guide

`@kontourai/ui` ships three layers:

- CSS tokens: `@kontourai/ui/tokens`
- React primitives: `@kontourai/ui/react`
- Light-DOM custom elements: `@kontourai/ui/elements`

## Theme Boundary

Apply exactly one product theme class on a stable root:

```html
<html class="theme-console">
```

Available product classes:

- `theme-console`
- `theme-flow`
- `theme-survey`
- `theme-surface`

Use `data-theme="light"` on the same root, or an ancestor, when a product needs the light token skin.

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
import "@kontourai/ui/tokens.css";
import "@kontourai/ui/themes.css";
import "@kontourai/ui/react/styles.css";
```

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

- `tokens/`
- `react/styles.css` if using primitives or custom elements
- `dist/elements/elements/src/` if using custom elements

Rules:

- Do not fork token files without a sync/drift check.
- Keep the product identity in a theme class, not in copied primitive CSS.
- Use `--k-*` tokens for local styles and derive product-specific aliases from `--k-*`.

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
