# Kontour Design-System Audit — `@kontourai/ui` (Console Kit)

_Audit date: 2026-06-28 · Package version: 1.7.0_

> **Historical document (2026-07-20).** This audit is a point-in-time snapshot
> taken at package version 1.7.0. It is preserved as-is below for historical
> record. At least one headline finding is now out of date: **F4**'s claim of
> "zero form controls and zero overlays" no longer holds — the package
> (currently 1.11.0) ships form-control primitives (Input, Textarea, Select,
> Checkbox, Toggle) and overlay/feedback primitives (Dialog, Popover, Tooltip,
> Toast). Treat findings below against the 1.7.0 baseline, not current `main`.

> **Delivery status.** Track B (package build-out) started: foundational tokens
> + form-control primitives + CK2/CK4 shipped in PR #31. Follow-ups tracked as
> issues: overlay/feedback primitives + runtime-hooks convention (#32) and the
> Track A downstream adoption sweep (#33).

## 1. Scope & method

Audited every directory in the workspace for how it relates to the shared design-system package `@kontourai/ui` ("Console Kit"): the `--k-*` token contract, 11 React primitives, mirrored web-component elements, 4 product theme classes, and product icons.

| Product | Type | Consumes `@kontourai/ui`? | Model |
|---|---|---|---|
| **console** (`console-ui`) | React app | ✅ | Direct npm import |
| **station** (`src-ui`) | React app | ✅ | Direct npm import |
| **survey** | Web component | ✅ (tokens only) | Vendored sync (devDep) |
| **flow** | Vanilla-JS console | ✅ (tokens+CSS) | Vendored sync |
| **surface** | Data lib + web UIs | ✅ (tokens only) | Manual token copy |
| **kontourai.io** | Astro marketing site | ❌ (duplicates marks) | Own brand system |
| **veritas** (`.site-src`) | Jekyll docs site | ❌ | Own minimal CSS |
| **flow-agents** | CLI | — | Out of scope (no UI) |
| **ephemeris** | Backend daemon | — | Out of scope (no UI) |

## 2. Headline findings

### F1 — Version fragmentation (no coordinated upgrade) — HIGH
Every consumer is pinned to an **old major/minor** while the package is at **1.7.0**:
- console `^1.1.0`, station `^1.4.1`, survey `^1.1.0` (devDep), flow `^1.1.0` (installs 1.7.0), surface `^1.1.0`.

Nobody is deliberately on current. There's no shared "renovate/dependabot" or pinned-version policy across the family, so each repo drifts independently and adopter-facing changes land unevenly.

### F2 — Three different consumption models — HIGH
- **Direct npm import**: console, station (use React primitives + tokens) — the healthy path.
- **Vendored token sync**: flow, survey (copy `tokens/` + sometimes `react/styles.css` into a `vendor/` dir).
- **Manual token copy**: surface (hand-maintained `01-tokens.css`).

Three models means three drift surfaces and three mental models. The non-React products (flow vanilla-JS, survey/surface web-components) only consume **tokens**, never primitives — yet they pull the whole package or hand-copy.

### F3 — Drift enforcement is inconsistent — HIGH
- **surface**: has a real CI gate — `check:console-token-drift` with an explicit `ALLOWED_VALUE_DRIFTS` registry (rem-vs-px, custom fonts). Best-in-class.
- **flow**: CI runs the sync script **without `--check`**, so it **silently re-syncs instead of failing**. Vendor is ~9 days stale and is **missing newer tokens** (`--k-elevation-overlay`, `--k-radius-control`, `--k-radius-overlay`, light-theme `--k-brand`).
- **survey**: vendored tokens are reference-only (real defaults are embedded in the web component) — drift check is low-value.
- **surface docs-site**: syncs a vendor copy that is **never imported** (dead sync).

### F4 — Package is missing whole component & token categories — HIGH (this is the build-out opportunity)
Token gaps: **z-index scale, focus/focus-visible tokens, border-width, line-height, letter-spacing, breakpoints** (all currently hard-coded in component CSS).

Primitive gaps (each product re-implements these today): **Input, Textarea, Select, Checkbox, Radio, Toggle, Modal/Dialog, Tooltip, Popover/Menu, Toast, Tabs, Table styles, Card, Avatar, Spinner.** The current 11 primitives are display-oriented; there are **zero form controls and zero overlays**.

### F5 — Duplication that should converge — MEDIUM
- **kontourai.io** re-draws all 7 product-mark SVGs (`ProductMark.astro`) with paths identical to `@kontourai/ui` `ProductIcon` — no shared source, will drift.
- **console** has pure pass-through re-export shims (`Badge.tsx`, `Panel.tsx`, `Metric.tsx`, `Empty.tsx`, `Progress.tsx`, `StatusBadge.tsx`) that just re-export the package — needless indirection.
- **station-tones.ts** wraps `toneForValue` with Veritas/Surface vocabulary — this is *sanctioned* product-semantic mapping, but it signals the package's tone matchers lack family vocabulary (already filed as CK4).

### F6 — Existing upstream-proposal process is underused — MEDIUM (good news)
station already files structured proposals (`docs/strategy/upstream-proposals.md`): **CK2** (Panel `actions` slot + aria), **CK3** (Empty accepts ReactNode), **CK4** (tone-matcher vocabulary for `satisfied/failing/missing/disputed/unverified/...`), **SV1** (browser-safe packaging / `sideEffects`). These are real, concrete, and shovel-ready — but stuck as issues.

## 3. What "good" looks like (Hermes-inspired unification thesis)

The team's own strategy docs cite Hermes's **gateway pattern — "one command definition drives all surfaces (CLI, UI, messaging)"** (`station/docs/strategy/competitive-landscape.md:204`) and the **AI↔UI bridge** vision (`station/docs/strategy/vision/ai-ui-bridge.md`). Note: Hermes's *actual* shared UI is thin (a CLI `skin_engine.py` + an open design-system issue), so the inspiration is the **principle**, not the implementation — Console Kit is already more mature.

Applied to the design system, the north star is **one contract → every surface**:

```
                 @kontourai/ui  (single source of truth)
   ┌───────────────┬───────────────┬───────────────┬──────────────┐
   tokens        primitives      elements        icons         (future)
   --k-*         React           web-components   product marks  chat UIBlocks
   │               │                │                │              │
 flow/surface   console/station  survey          kontourai.io   station MCP-UI
 (vanilla/WC)   (React apps)     (web component)  (marketing)    (ai-ui-bridge)
```

Today the left two columns are healthy; the rest is hand-rolled or duplicated. Unification = collapse the three consumption models into **one import path per surface type**, with **one enforced version** and **one drift gate**.

## 4. Recommendations (prioritized)

### Track A — Consistency & hygiene (low effort, high leverage)
1. **A1. Coordinated version bump** to `^1.7.0` across console/station/survey/flow/surface; add a shared dependency-update policy (renovate config or a family `check:ui-version` script).
2. **A2. Fix flow's drift gate** — run `sync-ui-assets.mjs --check` in CI (currently silently auto-syncs) and re-sync to pick up missing `--k-elevation-overlay` / `--k-radius-*` tokens.
3. **A3. Delete dead paths** — surface docs-site unused vendor sync; console pass-through re-export shims (import from `@kontourai/ui/react` directly).
4. **A4. De-dupe product marks** — kontourai.io consumes `@kontourai/ui/icons/*` (or a CI parity check) instead of hand-drawn `ProductMark.astro`.

### Track B — Package build-out (the design-system work)
5. **B1. Foundational tokens first** (unblocks everything): z-index scale, focus tokens, border-width, line-height, letter-spacing. ~1 file, no breaking changes.
6. **B2. Form controls**: Input, Textarea, Select, Checkbox, Radio, Toggle — highest ROI; every React product re-implements these.
7. **B3. Overlays**: Modal/Dialog → Tooltip → Popover/Menu (depends on B1 z-index). Modal alone removes the most duplicated code.
8. **B4. Feedback**: Toast/Notification stack, Spinner.
9. **B5. Land the filed proposals** CK2/CK3/CK4/SV1 — already specced, just need implementation.

### Track C — Unification architecture (structural)
10. **C1. Split a token-only entry** (`@kontourai/ui/tokens` already exists, but formalize a zero-JS, zero-React consumption contract) so flow/surface/survey can import-not-vendor. Kills two of the three consumption models.
11. **C2. Make elements first-class** for the vanilla/web-component consumers (flow, survey) so they stop hand-rolling badges/pills/panels in local CSS.
12. **C3. Adopt a discoverability surface** — the static `gallery.html` is good; consider a published gallery so every product team can see what exists before re-building it.
13. **C4. (Forward-looking) Chat UIBlock vocabulary** — station's ai-ui-bridge wants agents to return interactive UI; those blocks should render from the *same* primitives, making Console Kit the substrate for the AI↔UI bridge.

## 5. Per-product action list

- **console**: bump to 1.7.0; remove 6 re-export shims. (Token compliance already excellent.)
- **station**: bump to 1.7.0; land CK2/CK3/CK4 so it stops needing local `actions`-row and tone hacks. (Best React consumer.)
- **flow**: add `--check` drift gate; re-sync; bump dep; long-term import token-only entry instead of vendoring.
- **surface**: keep the (excellent) drift gate; delete unused docs vendor; bump dep.
- **survey**: bump devDep; document that vendored tokens are reference-only.
- **kontourai.io**: adopt `@kontourai/ui/icons` for product marks (Phase 1); keep distinct brand palette by design (no token adoption forced).
- **veritas / flow-agents / ephemeris**: out of scope (docs site / CLI / daemon). Revisit veritas only if a web dashboard ships.
