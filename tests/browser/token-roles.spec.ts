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
  }
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
// below <html>. Each placement's derived tokens must match the scope that
// applies at <body>.
const PLACEMENTS = [
  { name: "html[data-theme=light] > body.theme-flow", html: { theme: "light" }, body: { className: "theme-flow" }, focus: "#1f6f88" },
  { name: "html.theme-flow > body[data-theme=light]", html: { className: "theme-flow" }, body: { theme: "light" }, focus: "#0e7c64" },
  { name: "html.theme-flow[data-theme=light]", html: { className: "theme-flow", theme: "light" }, body: {}, focus: "#1f6f88" },
  { name: "html[data-theme=light] > body.theme-console", html: { theme: "light" }, body: { className: "theme-console" }, focus: "#6c9400" },
  { name: "html.theme-console > body[data-theme=light]", html: { className: "theme-console" }, body: { theme: "light" }, focus: "#0e7c64" },
] as const;

for (const placement of PLACEMENTS) {
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
        focus: style.getPropertyValue("--k-focus").trim(),
        action: style.getPropertyValue("--k-action").trim(),
        ring: style.getPropertyValue("--k-focus-ring").trim(),
        soft: Object.fromEntries(["positive", "caution", "negative", "active"].map((tone) => [tone, soft(tone)])),
      };
    }, { html: placement.html, body: placement.body });

    expect(resolved.brand).toBe(placement.focus);
    expect(resolved.ring, "--k-focus-ring must equal the scope's --k-focus").toBe(placement.focus);
    expect(resolved.focus).toBe(placement.focus);
    expect(resolved.action).toBe(placement.focus);
    for (const [tone, { token, local }] of Object.entries(resolved.soft)) {
      expect(token, `--k-${tone}-soft must mix the scope's --k-${tone}`).toBe(local);
    }
  });
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
