# Console Kit Context

Console Kit is `@kontourai/ui`, the shared presentation layer for Kontour console products. It owns the `--k-*` design-token contract, framework-specific primitives that consume those tokens, and package artifacts that downstream products import or vendor.

## Product Vocabulary

- **Token contract**: CSS custom properties under `tokens/`. Product surfaces should style with `--k-*` variables instead of hard-coded local design values. Token changes are cross-product changes.
- **Theme classes**: Product identity classes in `tokens/themes.css`: `theme-console`, `theme-flow`, `theme-survey`, and `theme-surface`. Apply one theme class on a stable root; use `[data-theme="light"]` for light-mode overrides.
- **React primitives**: Components exported from `react/` through `@kontourai/ui/react`. Display primitives (`Badge`, `Button`, `Panel`, `Metric`, `Progress`, `Skeleton`, `Spinner`, `StatusBadge`, `StatusBar`, `Topbar`, `Empty`, `ProductIcon`), form controls (`Field`, `Input`, `Textarea`, `Select`, `Checkbox`, `Toggle`), and overlays/feedback (`Dialog`, `Toast`, `ToastHost`). They are class-driven and read the shared token contract.
- **Stateful-primitive convention**: Most primitives are pure element factories. Stateful ones (e.g. `Dialog`) may use React hooks — they run under the consumer's real React runtime. The package verifies their behavior through the mirrored web component (e.g. `k-dialog`) in the browser harness, not the factory-call smoke check; both share the same class contract.
- **Web components**: Light-DOM custom elements in `elements/`, exported through `@kontourai/ui/elements`. They reuse the same class/style contract as the React primitives.
- **Generated `dist/`**: Build output for package exports and declarations. Do not hand-edit `dist/`; regenerate it with package checks when code changes require it.
- **Semantic scale**: Product-specific status words map to shared UI tones: `positive`, `caution`, `negative`, `active`, and `neutral`.

## Boundaries

Console Kit defines shared console presentation. It does not own product domain workflows, copy strategy, data fetching, routing, or app-specific state machines in downstream products.

Downstream adopters may import package exports or vendor copied assets, but they remain responsible for their own build, drift checks, and product-specific verification. When changing tokens, themes, primitive class names, package exports, or generated package shape, treat the change as adopter-facing and run the repo checks that match that surface.

## Source Map

- `AGENTS.md` - agent-facing repo instructions and verification commands.
- `README.md` - package overview, installation shape, theme list, and consumer examples.
- `docs/consumer-guide.md` - adopter guidance for React, custom elements, static HTML, theme classes, and vendored assets.
- `docs/release-readiness.md` - package and adopter verification matrix.
- `tokens/` - token contract, fonts, themes, and aggregate CSS entry points.
- `react/` - React primitive styles and source.
- `elements/` - web-component wrappers and demo.
- `dist/` - generated package output.
