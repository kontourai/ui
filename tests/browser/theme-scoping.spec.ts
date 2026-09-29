import { expect, test, type Page } from "@playwright/test";

// The scoping rule (DESIGN.md, "Theme and mode scoping"): the nearest
// data-theme picks the mode and the nearest theme class picks the product
// values, at any depth (ui#80, ui#84). Each case builds a real nested tree and
// compares the probe's computed tokens and painted colors with a reference
// element that carries the expected theme class and data-theme itself (the
// placement that has always resolved correctly), and pins a few literals so a
// reference that broke the same way cannot hide a failure. A data-theme element
// resets to its mode and nearest theme, so every mode token is compared.
// Accepted gap (DESIGN.md): a theme class below a mode that switches back
// (light > dark > light > .theme-x) is not covered by the selectors.

type Node = { className?: string; theme?: "dark" | "light" };
type Case = {
  name: string;
  chain: Node[]; // outermost first; the last node is the probe. chain[0] is <html>.
  expect: Node; // the (theme, mode) the probe must resolve to
  tokens: string[];
  pinned: Record<string, string>;
};

const MODE_TOKENS = [
  "--k-bg", "--k-panel", "--k-panel-raised", "--k-text", "--k-text-muted", "--k-text-faint",
  "--k-brand", "--k-brand-contrast", "--k-action", "--k-action-contrast", "--k-focus",
  "--k-positive", "--k-caution", "--k-negative", "--k-active", "--k-status-contrast",
  "--k-trust-verified", "--k-trust-verified-fill", "--k-trust-disputed", "--k-trust-disputed-fill",
];

const CASES: Case[] = [
  // ui#80: modes nest both ways.
  { name: "dark inside light", chain: [{ theme: "light" }, { theme: "dark" }], expect: { theme: "dark" }, tokens: MODE_TOKENS, pinned: { "--k-bg": "#0a0e13", "--k-text": "#eef3f8", "--k-brand": "#5ce0c6" } },
  { name: "light inside dark", chain: [{ theme: "dark" }, { theme: "light" }], expect: { theme: "light" }, tokens: MODE_TOKENS, pinned: { "--k-bg": "#f5f4ef", "--k-text": "#202124", "--k-brand": "#0e7c64" } },
  { name: "dark inside console light", chain: [{ className: "theme-console", theme: "light" }, { theme: "dark" }], expect: { className: "theme-console", theme: "dark" }, tokens: MODE_TOKENS, pinned: { "--k-bg": "#11120f", "--k-brand": "#c9ff4a" } },
  { name: "light inside console dark", chain: [{ className: "theme-console", theme: "dark" }, { theme: "light" }], expect: { className: "theme-console", theme: "light" }, tokens: MODE_TOKENS, pinned: { "--k-bg": "#f3f5eb", "--k-brand": "#577800" } },
  { name: "survey dark theme element inside light", chain: [{ theme: "light" }, { className: "theme-survey", theme: "dark" }], expect: { className: "theme-survey", theme: "dark" }, tokens: MODE_TOKENS, pinned: { "--k-bg": "#06080b", "--k-brand": "#5ce0c6" } },
  { name: "flow class below dark below light", chain: [{ theme: "light" }, { theme: "dark" }, { className: "theme-flow" }], expect: { className: "theme-flow", theme: "dark" }, tokens: MODE_TOKENS, pinned: { "--k-bg": "#0a0e13", "--k-brand": "#3890ae" } },
  { name: "station class below light below dark", chain: [{ theme: "dark" }, { theme: "light" }, { className: "theme-station" }], expect: { className: "theme-station", theme: "light" }, tokens: MODE_TOKENS, pinned: { "--k-bg": "#f5f4ef", "--k-brand": "#7c3aed" } },
  { name: "dark theme element inside a dark island", chain: [{ theme: "light" }, { theme: "dark" }, { className: "theme-console", theme: "dark" }], expect: { className: "theme-console", theme: "dark" }, tokens: MODE_TOKENS, pinned: { "--k-bg": "#11120f" } },
  { name: "dark inside station light below flow", chain: [{ className: "theme-flow" }, { className: "theme-station", theme: "light" }, { theme: "dark" }], expect: { className: "theme-station", theme: "dark" }, tokens: MODE_TOKENS, pinned: { "--k-brand": "#966aff", "--k-action": "#7c3aed" } },
  // ui#84: light below a nested theme takes the nearest theme's values.
  { name: "station > flow > light", chain: [{ className: "theme-station" }, { className: "theme-flow" }, { theme: "light" }], expect: { className: "theme-flow", theme: "light" }, tokens: MODE_TOKENS, pinned: { "--k-brand": "#1f6f88", "--k-action": "#1f6f88" } },
  { name: "flow > station > light", chain: [{ className: "theme-flow" }, { className: "theme-station" }, { theme: "light" }], expect: { className: "theme-station", theme: "light" }, tokens: MODE_TOKENS, pinned: { "--k-brand": "#7c3aed" } },
  { name: "console > survey > light", chain: [{ className: "theme-console" }, { className: "theme-survey" }, { theme: "light" }], expect: { className: "theme-survey", theme: "light" }, tokens: MODE_TOKENS, pinned: { "--k-brand": "#137e6e", "--k-bg": "#f5f4ef", "--k-panel": "#ffffff" } },
  { name: "survey > console > light", chain: [{ className: "theme-survey" }, { className: "theme-console" }, { theme: "light" }], expect: { className: "theme-console", theme: "light" }, tokens: MODE_TOKENS, pinned: { "--k-brand": "#577800", "--k-bg": "#f3f5eb" } },
];

for (const scenario of CASES) {
  test(`scoping: ${scenario.name} resolves to ${scenario.expect.className ?? "default"} ${scenario.expect.theme}`, async ({ page }) => {
    await loadGallery(page);
    const result = await page.evaluate(({ chain, expected, tokens }) => {
      const apply = (element: HTMLElement, node: { className?: string; theme?: string }) => {
        element.className = node.className ?? "";
        if (node.theme) element.dataset.theme = node.theme;
        else delete element.dataset.theme;
      };
      const html = document.documentElement;
      apply(html, chain[0]);
      document.body.className = "";
      delete document.body.dataset.theme;
      let parent: HTMLElement = document.body;
      for (const node of chain.slice(1)) {
        const child = document.createElement("div");
        apply(child, node);
        parent.append(child);
        parent = child;
      }
      const probe = parent;
      // The reference sits in a fresh subtree whose chain carries no theme or
      // mode, so only its own class and attribute decide it. <html> still
      // carries chain[0]; the reference's own attributes outrank it.
      const reference = document.createElement("div");
      apply(reference, expected);
      document.body.append(reference);
      const read = (element: HTMLElement) => {
        const style = getComputedStyle(element);
        const swatch = document.createElement("span");
        swatch.style.cssText = "color: var(--k-text); background: var(--k-bg); outline-color: var(--k-focus); border-color: var(--k-positive-soft)";
        element.append(swatch);
        const painted = getComputedStyle(swatch);
        const values = Object.fromEntries(tokens.map((token) => [token, style.getPropertyValue(token).trim()]));
        const paint = { text: painted.color, bg: painted.backgroundColor, focus: painted.outlineColor, soft: painted.borderTopColor };
        swatch.remove();
        return { values, paint, ring: style.getPropertyValue("--k-focus-ring").trim(), focus: style.getPropertyValue("--k-focus").trim(), scheme: style.colorScheme };
      };
      return { probe: read(probe), reference: read(reference) };
    }, { chain: scenario.chain, expected: scenario.expect, tokens: scenario.tokens });

    for (const token of scenario.tokens) {
      expect(result.probe.values[token], `${scenario.name}: ${token}`).toBe(result.reference.values[token]);
    }
    for (const [token, value] of Object.entries(scenario.pinned)) {
      expect(result.probe.values[token] ?? result.reference.values[token], `${scenario.name}: pinned ${token}`).toBe(value);
      expect(result.reference.values[token], `${scenario.name}: reference ${token}`).toBe(value);
    }
    expect(result.probe.ring, `${scenario.name}: --k-focus-ring follows the scope's --k-focus`).toBe(result.probe.focus);
    expect(result.probe.paint, `${scenario.name}: painted text, page, focus and soft fill`).toEqual(result.reference.paint);
    expect(result.probe.scheme, `${scenario.name}: color-scheme`).toBe(scenario.expect.theme);
  });
}

// The gallery's matrix swatches carry data-theme="dark" under whatever the page
// mode is; under a light page they used to render light (ui#80).
test("theme matrix dark swatches stay dark under a light page", async ({ page }) => {
  await loadGallery(page);
  await page.evaluate(() => { document.documentElement.dataset.theme = "light"; });
  const swatches = await page.locator("[data-theme-matrix$=':dark']").evaluateAll((nodes) => nodes.map((node) => {
    const style = getComputedStyle(node);
    return { id: node.getAttribute("data-theme-matrix"), panel: style.backgroundColor, text: style.getPropertyValue("--k-text").trim() };
  }));
  expect(swatches.length).toBe(5);
  for (const swatch of swatches) {
    expect(swatch.text, `${swatch.id}: text token`).not.toBe("#202124");
    expect(luminance(swatch.panel), `${swatch.id}: panel ${swatch.panel} is a dark surface`).toBeLessThan(0.05);
  }
});

function luminance(color: string): number {
  const channels = /rgba?\(([^)]+)\)/.exec(color)?.[1].split(",").map((part) => Number.parseFloat(part));
  if (!channels || channels.length < 3) throw new Error(`Unparseable color: ${color}`);
  const [r, g, b] = channels.slice(0, 3).map((value) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

async function loadGallery(page: Page): Promise<void> {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/docs/gallery.html");
  await expect(page.locator("[data-theme-matrix]").first()).toBeVisible();
  expect(errors).toEqual([]);
}
