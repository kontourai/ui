import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

// Interaction roles (--k-action, --k-action-contrast, --k-focus) are separate
// from the brand slot, so overriding only the brand — as a white-label
// deployment or a product theme may — cannot make a primary action
// unreadable. The pale brand below fails contrast with every shipped
// --k-brand-contrast on purpose.
const PALE_BRAND = "#f7f3a1";
const PALE_RGB = "rgb(247, 243, 161)";

test("a brand-only override leaves primary actions readable in every theme and mode", async ({ page }) => {
  await loadGallery(page);

  await page.locator("[data-theme-matrix]").evaluateAll((nodes, pale) => {
    for (const sample of nodes) {
      (sample as HTMLElement).style.setProperty("--k-brand", pale);
      // A probe that paints with the brand proves the override reached the
      // sample's descendants; without it a no-op override would pass.
      const probe = document.createElement("span");
      probe.dataset.brandProbe = "";
      probe.style.color = "var(--k-brand)";
      sample.append(probe);
    }
  }, PALE_BRAND);
  await settleTransitions(page);

  const samples = await page.locator("[data-theme-matrix]").evaluateAll((nodes) => nodes.map((sample) => {
    const button = sample.querySelector("k-button button");
    const probe = sample.querySelector("[data-brand-probe]");
    if (!button || !probe) throw new Error("Theme matrix sample has no primary button or brand probe.");
    const style = getComputedStyle(button);
    return {
      id: sample.getAttribute("data-theme-matrix"),
      probe: getComputedStyle(probe).color,
      text: style.color,
      fill: style.backgroundColor,
    };
  }));

  expect(samples.length).toBeGreaterThanOrEqual(10);
  for (const sample of samples) {
    expect(sample.probe, `${sample.id}: brand override did not apply`).toBe(PALE_RGB);
    expect(sample.fill, `${sample.id}: primary fill followed the brand`).not.toBe(PALE_RGB);
    expect(contrast(sample.text, sample.fill), `${sample.id}: primary text on fill`).toBeGreaterThanOrEqual(4.5);
  }
});

test("a brand-slot override on the root keeps actions, focus, and status text readable", async ({ page }) => {
  await loadGallery(page);

  for (const mode of ["dark", "light"]) {
    await page.evaluate(([mode, pale]) => {
      const root = document.documentElement;
      root.dataset.theme = mode;
      root.style.setProperty("--k-brand", pale);
      // A dark-brand deployment would pair its brand with white text; that
      // choice must not reach status badges.
      root.style.setProperty("--k-brand-contrast", mode === "dark" ? "#ffffff" : "#000000");
    }, [mode, PALE_BRAND]);
    // Buttons transition background and border for --k-dur; reading mid-flight
    // rates a blend of the old and new fills instead of what users see.
    await settleTransitions(page);

    const eyebrow = page.locator("k-topbar .eyebrow");
    await expect(eyebrow).toHaveCSS("color", PALE_RGB);

    const primary = page.locator("k-topbar .btn-primary");
    const [text, fill] = await primary.evaluate((node) => [getComputedStyle(node).color, getComputedStyle(node).backgroundColor]);
    expect(fill, `${mode}: primary fill followed the brand`).not.toBe(PALE_RGB);
    expect(contrast(text, fill), `${mode}: primary text on fill`).toBeGreaterThanOrEqual(4.5);

    const tones = await page.locator("main > .grid .badge[class*='tone-']:not(.tone-neutral)").evaluateAll((nodes) =>
      nodes.map((node) => ({ tone: node.className, text: getComputedStyle(node).color, fill: getComputedStyle(node).backgroundColor })));
    expect(tones.length).toBeGreaterThanOrEqual(4);
    for (const tone of tones) expect(contrast(tone.text, tone.fill), `${mode}: ${tone.tone}`).toBeGreaterThanOrEqual(4.5);

    await page.keyboard.press("Tab");
    const checkbox = page.locator("k-panel k-checkbox input").first();
    await checkbox.focus();
    const ring = await checkbox.evaluate((node) => {
      const role = document.createElement("span");
      role.style.color = "var(--k-focus)";
      node.parentElement!.append(role);
      const style = getComputedStyle(node);
      const result = { style: style.outlineStyle, color: style.outlineColor, role: getComputedStyle(role).color };
      role.remove();
      return result;
    });
    expect(ring.style, `${mode}: focused checkbox shows no ring`).toBe("solid");
    expect(ring.color, `${mode}: focus ring followed the brand`).not.toBe(PALE_RGB);
    expect(ring.color, `${mode}: focus ring is not the --k-focus role`).toBe(ring.role);

    // Button and toggle focus, and button hover, read the roles too.
    const ghost = page.locator("k-topbar .btn-ghost");
    await page.keyboard.press("Tab");
    await ghost.focus();
    // Outside the theme matrix: its samples set their own brand, so the root
    // override would not reach a toggle there.
    const toggle = page.locator("main > .grid k-toggle input.toggle").first();
    const focused = { button: await focusedState(page, ghost), toggle: undefined as FocusState | undefined };
    await toggle.focus();
    focused.toggle = await focusedState(page, toggle);
    await toggle.blur();
    for (const [name, state] of Object.entries(focused)) {
      expect(state!.focusVisible, `${mode}: ${name} is not :focus-visible`).toBe(true);
      const painted = name === "button" ? state!.border : state!.outline;
      expect(painted, `${mode}: focused ${name} followed the brand`).not.toBe(PALE_RGB);
      expect(painted, `${mode}: focused ${name} is not the --k-focus role`).toBe(state!.focus);
    }
    await ghost.hover();
    const hovered = await focusedState(page, ghost);
    expect(hovered.border, `${mode}: hovered button followed the brand`).not.toBe(PALE_RGB);
    expect(hovered.border, `${mode}: hovered button is not the --k-action role`).toBe(hovered.action);
    await page.mouse.move(0, 0);
  }
});

// The documented white-label contract: per-mode values, set with the same
// selectors the theme uses, in a stylesheet loaded after the tokens. A
// :root override loses to [data-theme="light"].theme-x, and one inline value
// cannot differ per mode, so neither is the contract.
const WHITE_LABEL = {
  dark: { brand: "#f0a868", action: "#f0a868", actionContrast: "#06080b", focus: "#f0a868" },
  light: { brand: "#9a4418", action: "#9a4418", actionContrast: "#ffffff", focus: "#9a4418" },
};

test("a white-label override on the theme's selectors applies per mode and keeps actions readable", async ({ page }) => {
  await loadGallery(page);
  await page.evaluate((values) => {
    const decl = (v: typeof values.dark) =>
      `--k-brand: ${v.brand}; --k-action: ${v.action}; --k-action-contrast: ${v.actionContrast}; --k-focus: ${v.focus};`;
    const style = document.createElement("style");
    style.textContent = `.theme-flow { ${decl(values.dark)} }
[data-theme="light"].theme-flow, [data-theme="light"] .theme-flow, :where(.theme-flow) [data-theme="light"] { ${decl(values.light)} }`;
    document.head.append(style);
    document.documentElement.className = "theme-flow";
  }, WHITE_LABEL);

  for (const mode of ["dark", "light"] as const) {
    await page.evaluate((mode) => { document.documentElement.dataset.theme = mode; }, mode);
    await settleTransitions(page);
    const expected = WHITE_LABEL[mode];
    await expect(page.locator("k-topbar .eyebrow")).toHaveCSS("color", hexToRgb(expected.brand));
    const primary = page.locator("k-topbar .btn-primary");
    const [text, fill] = await primary.evaluate((node) => [getComputedStyle(node).color, getComputedStyle(node).backgroundColor]);
    expect(fill, `${mode}: primary fill is not the override action`).toBe(hexToRgb(expected.action));
    expect(text, `${mode}: primary text is not the override action contrast`).toBe(hexToRgb(expected.actionContrast));
    expect(contrast(text, fill), `${mode}: primary text on fill`).toBeGreaterThanOrEqual(4.5);
    const ring = await page.locator("main").evaluate((node) => getComputedStyle(node).getPropertyValue("--k-focus-ring").trim());
    expect(ring, `${mode}: --k-focus-ring does not follow the override focus`).toBe(expected.focus);
  }

  // The other two documented placements: the light attribute below the theme
  // class, and the theme class below the light attribute. The scoping
  // exclusions (ui#80, ui#84) keep the shipped selectors' weights, so an
  // override written with the same selectors still wins in both.
  for (const placement of ["attribute below class", "class below attribute"] as const) {
    const brand = await page.evaluate((placement) => {
      const html = document.documentElement;
      const body = document.body;
      if (placement === "attribute below class") {
        html.className = "theme-flow";
        delete html.dataset.theme;
        body.className = "";
        body.dataset.theme = "light";
      } else {
        html.className = "";
        html.dataset.theme = "light";
        body.className = "theme-flow";
        delete body.dataset.theme;
      }
      const brand = getComputedStyle(document.querySelector("main")!).getPropertyValue("--k-brand").trim();
      body.className = "";
      delete body.dataset.theme;
      return brand;
    }, placement);
    expect(brand, `${placement}: light override`).toBe(WHITE_LABEL.light.brand);
  }
});

// Dark islands (ui#80): a data-theme="dark" element below a light one now
// really resolves dark, so a white-label override reaches it only through the
// selectors DESIGN.md documents ("Migrating overrides"). Selectors are pinned
// here as literals, not read from the CSS: the light forms and the dark-island
// form as tokens/themes.css spells them (the docs name the island block and
// point there), and the no-theme reset as DESIGN.md names it.
const FLOW_OTHERS = ".theme-survey, .theme-console, .theme-surface, .theme-station";
const DOCUMENTED = {
  flowDark: `.theme-flow,\n[data-theme="dark"]:where(.theme-flow *):where([data-theme="light"] *):where(:not(${FLOW_OTHERS}, .theme-flow :is(${FLOW_OTHERS}) *))`,
  flowLight: `[data-theme="light"].theme-flow,\n[data-theme="light"] .theme-flow:where(:not([data-theme="dark"], [data-theme="light"] [data-theme="dark"] *)),\n:where(.theme-flow) [data-theme="light"]:where(:not(${FLOW_OTHERS}, .theme-flow :is(${FLOW_OTHERS}) *))`,
  rootDark: `:root,\n[data-theme="dark"]:where([data-theme="light"] *)`,
  rootLight: `[data-theme="light"]`,
  // main's documented light forms, before the scoping tails.
  oldFlowLight: `[data-theme="light"].theme-flow, [data-theme="light"] .theme-flow, :where(.theme-flow) [data-theme="light"]`,
};
const ISLANDS = [
  { name: "theme on a light root, dark island below", html: { className: "theme-flow", theme: "light" }, island: { theme: "dark" }, dark: "flowDark", light: "flowLight" },
  { name: "dark theme element on a light page", html: { theme: "light" }, island: { className: "theme-flow", theme: "dark" }, dark: "flowDark", light: "flowLight" },
  { name: "no theme class, dark island on a light page", html: { theme: "light" }, island: { theme: "dark" }, dark: "rootDark", light: "rootLight" },
] as const;

async function islandRoles(page: Page, css: string, html: { className?: string; theme?: string }, island: { className?: string; theme?: string }) {
  return page.evaluate(({ css, html, island }) => {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.append(style);
    const root = document.documentElement;
    root.className = html.className ?? "";
    root.dataset.theme = html.theme ?? "dark";
    const section = document.createElement("section");
    section.className = island.className ?? "";
    if (island.theme) section.dataset.theme = island.theme;
    document.body.append(section);
    const probe = document.createElement("span");
    probe.style.cssText = "color: var(--k-brand); background: var(--k-bg); border-color: var(--k-panel)";
    section.append(probe);
    const computed = getComputedStyle(section);
    const painted = getComputedStyle(probe);
    const read = (name: string) => computed.getPropertyValue(name).trim();
    const result = { brand: read("--k-brand"), action: read("--k-action"), actionContrast: read("--k-action-contrast"), focus: read("--k-focus"), bg: read("--k-bg"), brandPaint: painted.color, bgPaint: painted.backgroundColor, panelPaint: painted.borderTopColor };
    section.remove();
    style.remove();
    return result;
  }, { css, html, island });
}

for (const placement of ISLANDS) {
  test(`a white-label override reaches a dark island with the documented selectors: ${placement.name}`, async ({ page }) => {
    await loadGallery(page);
    const decl = (v: typeof WHITE_LABEL.dark) =>
      `--k-brand: ${v.brand}; --k-action: ${v.action}; --k-action-contrast: ${v.actionContrast}; --k-focus: ${v.focus};`;
    const css = `${DOCUMENTED[placement.dark]} { ${decl(WHITE_LABEL.dark)} }\n${DOCUMENTED[placement.light]} { ${decl(WHITE_LABEL.light)} }`;
    const roles = await islandRoles(page, css, placement.html, placement.island);
    const expected = WHITE_LABEL.dark;
    expect(roles.brand, `${placement.name}: brand`).toBe(expected.brand);
    expect(roles.action, `${placement.name}: action`).toBe(expected.action);
    expect(roles.actionContrast, `${placement.name}: action contrast`).toBe(expected.actionContrast);
    expect(roles.focus, `${placement.name}: focus`).toBe(expected.focus);
    expect(roles.bg, `${placement.name}: the island's page is the dark page`).toBe("#0a0e13");
    expect(contrast(roles.brandPaint, roles.bgPaint), `${placement.name}: brand on the island's page`).toBeGreaterThanOrEqual(3);
    expect(contrast(roles.brandPaint, roles.panelPaint), `${placement.name}: brand on the island's panel`).toBeGreaterThanOrEqual(3);
  });
}

// The consumer guide's white-label example, loaded from the guide itself (its
// first fenced css block that names .theme-flow), must be complete: copied
// verbatim, it resolves the override in each dark-island placement and in
// light mode, never the shipped Flow values.
test("the consumer guide's white-label example is complete for dark islands", async ({ page }) => {
  const guide = readFileSync(path.join(test.info().config.rootDir, "../../docs/consumer-guide.md"), "utf8");
  const css = [...guide.matchAll(/```css\n([\s\S]*?)```/g)].map((match) => match[1]).find((block) => block.includes(".theme-flow"));
  expect(css, "no css example naming .theme-flow in docs/consumer-guide.md").toBeTruthy();
  await loadGallery(page);
  const placements = [
    { name: "theme on a light root, dark island below", html: { className: "theme-flow", theme: "light" }, island: { theme: "dark" }, mode: "dark" },
    { name: "dark theme element on a light page", html: { theme: "light" }, island: { className: "theme-flow", theme: "dark" }, mode: "dark" },
    { name: "light element inside a dark theme root", html: { className: "theme-flow", theme: "dark" }, island: { theme: "light" }, mode: "light" },
  ] as const;
  for (const placement of placements) {
    const roles = await islandRoles(page, css!, placement.html, placement.island);
    const expected = WHITE_LABEL[placement.mode];
    expect(roles.brand, `${placement.name}: brand`).toBe(expected.brand);
    expect(roles.action, `${placement.name}: action`).toBe(expected.action);
    expect(roles.actionContrast, `${placement.name}: action contrast`).toBe(expected.actionContrast);
    expect(roles.focus, `${placement.name}: focus`).toBe(expected.focus);
    expect(contrast(roles.brandPaint, roles.bgPaint), `${placement.name}: brand on the page`).toBeGreaterThanOrEqual(3);
  }
});

// Migration hazard, pinned on purpose: main's documented class-below-attribute
// light form has no tail, weighs 0-2-0, and still matches a dark theme element
// on a light page, so an override left on the old selectors paints its LIGHT
// values onto the dark island. DESIGN.md "Migrating overrides" tells consumers
// to add the tail. If this starts failing, the hazard is gone: update the docs.
test("migration hazard: an override on main's old light selectors lands on a dark theme element under a light page", async ({ page }) => {
  await loadGallery(page);
  const decl = (v: typeof WHITE_LABEL.dark) =>
    `--k-brand: ${v.brand}; --k-action: ${v.action}; --k-action-contrast: ${v.actionContrast}; --k-focus: ${v.focus};`;
  const css = `.theme-flow { ${decl(WHITE_LABEL.dark)} }\n${DOCUMENTED.oldFlowLight} { ${decl(WHITE_LABEL.light)} }`;
  const roles = await islandRoles(page, css, { theme: "light" }, { className: "theme-flow", theme: "dark" });
  expect(roles.bg, "the island itself is dark").toBe("#0a0e13");
  expect(roles.brand, "old selectors apply the light override inside the dark island").toBe(WHITE_LABEL.light.brand);
});

// A theme scope nested under another theme's scope (the gallery's matrix
// samples under a themed <html>) must carry its own action text color: a scope
// that set only the action fill would inherit the outer scope's text onto it.
test("nested theme scopes keep a readable primary action under every root theme and mode", async ({ page }) => {
  await loadGallery(page);
  const themes = await page.locator("[data-theme-matrix]").evaluateAll((nodes) =>
    [...new Set(nodes.map((node) => node.getAttribute("data-theme-matrix")!.split(":")[0]))]);
  expect(themes.length).toBeGreaterThanOrEqual(5);

  for (const rootTheme of ["", ...themes]) for (const mode of ["dark", "light"]) {
    await page.evaluate(([rootTheme, mode]) => {
      document.documentElement.className = rootTheme;
      document.documentElement.dataset.theme = mode;
    }, [rootTheme, mode]);
    await settleTransitions(page);
    const buttons = await page.locator("[data-theme-matrix] k-button button").evaluateAll((nodes) => nodes.map((node) => ({
      id: node.closest("[data-theme-matrix]")!.getAttribute("data-theme-matrix"),
      text: getComputedStyle(node).color,
      fill: getComputedStyle(node).backgroundColor,
    })));
    expect(buttons.length).toBe(themes.length * 2);
    for (const button of buttons) {
      expect(contrast(button.text, button.fill), `root ${rootTheme || "default"}:${mode} > ${button.id}: primary text on fill`)
        .toBeGreaterThanOrEqual(4.5);
    }
  }
});

// Issue 78: a var()-derived token declared once on :root resolves there and is
// inherited as a computed value, so it ignored theme and mode scopes placed
// below <html>. Every placement of a theme class and data-theme must resolve
// to that theme's values for the mode in effect at <body>, including the
// derived ring and soft fills. Values are pinned here, not read from the CSS.
const THEME_VALUES = {
  survey: { dark: ["#5ce0c6", "#5ce0c6", "#06080b", "#5ce0c6"], light: ["#107e6d", "#16806f", "#ffffff", "#16806f"] },
  console: { dark: ["#c9ff4a", "#c9ff4a", "#11120f", "#c9ff4a"], light: ["#577800", "#6c9400", "#11120f", "#6c9400"] },
  flow: { dark: ["#3890ae", "#2f88a6", "#06080b", "#2f88a6"], light: ["#1f6f88", "#1f6f88", "#ffffff", "#1f6f88"] },
  surface: { dark: ["#14a37a", "#14a37a", "#06080b", "#14a37a"], light: ["#0f6b52", "#0f6b52", "#ffffff", "#0f6b52"] },
  station: { dark: ["#966aff", "#7c3aed", "#ffffff", "#9364ff"], light: ["#7c3aed", "#7c3aed", "#ffffff", "#7c3aed"] },
} as const; // [brand, action, action-contrast, focus]

type Scope = { className?: string; theme?: string };
const placementsFor = (theme: string) => [
  { name: `html > body.theme-${theme}`, html: {}, body: { className: `theme-${theme}` }, mode: "dark" },
  { name: `html.theme-${theme} > body`, html: { className: `theme-${theme}` }, body: {}, mode: "dark" },
  { name: `html[data-theme=light] > body.theme-${theme}`, html: { theme: "light" }, body: { className: `theme-${theme}` }, mode: "light" },
  { name: `html.theme-${theme} > body[data-theme=light]`, html: { className: `theme-${theme}` }, body: { theme: "light" }, mode: "light" },
  { name: `html.theme-${theme}[data-theme=light]`, html: { className: `theme-${theme}`, theme: "light" }, body: {}, mode: "light" },
] as { name: string; html: Scope; body: Scope; mode: "dark" | "light" }[];

// A theme class on the light element itself keeps its own identity under an
// ancestor that carries a different theme.
const NESTED = [
  { name: "html.theme-flow > body.theme-console[data-theme=light]", html: { className: "theme-flow" }, body: { className: "theme-console", theme: "light" }, theme: "console", mode: "light" },
  { name: "html.theme-flow[data-theme=light] > body.theme-station", html: { className: "theme-flow", theme: "light" }, body: { className: "theme-station" }, theme: "station", mode: "light" },
  { name: "html.theme-console > body.theme-surface", html: { className: "theme-console" }, body: { className: "theme-surface" }, theme: "surface", mode: "dark" },
] as { name: string; html: Scope; body: Scope; theme: keyof typeof THEME_VALUES; mode: "dark" | "light" }[];

const CASES = [
  ...Object.keys(THEME_VALUES).flatMap((theme) => placementsFor(theme).map((placement) => ({ ...placement, theme: theme as keyof typeof THEME_VALUES }))),
  ...NESTED,
];

for (const placement of CASES) {
  test(`derived tokens follow the scope at ${placement.name}`, async ({ page }) => {
    await loadGallery(page);

    const resolved = await page.evaluate(({ html, body }) => {
      const apply = (element: HTMLElement, scope: { className?: string; theme?: string }) => {
        element.className = scope.className ?? "";
        if (scope.theme) element.dataset.theme = scope.theme;
        else delete element.dataset.theme;
      };
      apply(document.documentElement, html);
      apply(document.body, body);

      const probe = document.createElement("div");
      document.body.append(probe);
      const paint = (background: string) => {
        const swatch = document.createElement("span");
        swatch.style.background = background;
        probe.append(swatch);
        return getComputedStyle(swatch).backgroundColor;
      };
      const style = getComputedStyle(probe);
      const soft = (tone: string) => ({
        token: paint(`var(--k-${tone}-soft)`),
        local: paint(`color-mix(in oklab, var(--k-${tone}) 14%, transparent)`),
      });
      return {
        brand: style.getPropertyValue("--k-brand").trim(),
        action: style.getPropertyValue("--k-action").trim(),
        actionContrast: style.getPropertyValue("--k-action-contrast").trim(),
        focus: style.getPropertyValue("--k-focus").trim(),
        ring: style.getPropertyValue("--k-focus-ring").trim(),
        soft: Object.fromEntries(["positive", "caution", "negative", "active"].map((tone) => [tone, soft(tone)])),
      };
    }, { html: placement.html, body: placement.body });

    const [brand, action, actionContrast, focus] = THEME_VALUES[placement.theme][placement.mode];
    expect(resolved.brand, `--k-brand should be ${placement.theme} ${placement.mode}`).toBe(brand);
    expect(resolved.action, `--k-action should be ${placement.theme} ${placement.mode}`).toBe(action);
    expect(resolved.actionContrast, `--k-action-contrast should be ${placement.theme} ${placement.mode}`).toBe(actionContrast);
    expect(resolved.focus, `--k-focus should be ${placement.theme} ${placement.mode}`).toBe(focus);
    expect(resolved.ring, "--k-focus-ring must equal the scope's --k-focus").toBe(focus);
    for (const [tone, { token, local }] of Object.entries(resolved.soft)) {
      expect(token, `--k-${tone}-soft must mix the scope's --k-${tone}`).toBe(local);
    }
  });
}

type FocusState = { focusVisible: boolean; border: string; outline: string; focus: string; action: string };

// Reads a control's painted focus/hover colors beside the role values
// resolved at the same element, after its transitions settle.
async function focusedState(page: Page, locator: ReturnType<Page["locator"]>): Promise<FocusState> {
  await settleTransitions(page);
  return locator.evaluate((node) => {
    const role = (name: string) => {
      const swatch = document.createElement("span");
      swatch.style.color = `var(${name})`;
      node.parentElement!.append(swatch);
      const color = getComputedStyle(swatch).color;
      swatch.remove();
      return color;
    };
    const style = getComputedStyle(node);
    return {
      focusVisible: node.matches(":focus-visible"),
      border: style.borderTopColor,
      outline: style.outlineColor,
      focus: role("--k-focus"),
      action: role("--k-action"),
    };
  });
}

function hexToRgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

// Waits for every running CSS transition to finish so computed colors are the
// settled values. Reading layout first flushes style, which starts any
// transition the preceding change triggered; infinite animations (spinner,
// skeleton) are CSSAnimations and are not awaited.
async function settleTransitions(page: Page): Promise<void> {
  await page.evaluate(async () => {
    void document.documentElement.offsetHeight;
    const transitions = document.getAnimations().filter((animation) => animation instanceof CSSTransition);
    await Promise.all(transitions.map((transition) => transition.finished.catch(() => undefined)));
  });
}

async function loadGallery(page: Page): Promise<void> {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/docs/gallery.html");
  await expect(page.locator("[data-theme-matrix]").first()).toBeVisible();
  await expect(page.locator("k-topbar .btn-primary")).toBeVisible();
  expect(errors).toEqual([]);
}

function contrast(foreground: string, background: string): number {
  const luminance = (color: string) => {
    const channels = /rgba?\(([^)]+)\)/.exec(color)?.[1].split(",").map((part) => Number.parseFloat(part));
    if (!channels || channels.length < 3) throw new Error(`Unparseable color: ${color}`);
    if (channels.length === 4 && channels[3] !== 1) throw new Error(`Translucent color cannot be rated: ${color}`);
    const [r, g, b] = channels.slice(0, 3).map((value) => {
      const c = value / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [hi, lo] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}
