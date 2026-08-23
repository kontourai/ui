import { expect, test, type Page } from "@playwright/test";

test("renders the package gallery with tokens, themes, and primitive components", async ({ page }) => {
  const consoleErrors = await loadKitPage(page, "/docs/gallery.html");

  await expect(page).toHaveTitle("Kontour UI Gallery");
  await expect(page.getByRole("main")).toContainText("Primitive Gallery");
  await expect(page.getByRole("main")).toContainText("@kontourai/ui");
  await expect(page.getByRole("main")).toContainText("theme-console");
  await expect(page.getByRole("main")).toContainText("theme-flow light");
  await expect(page.getByRole("main")).toContainText("theme-survey");
  await expect(page.getByRole("main")).toContainText("theme-surface light");
  await expect(page.getByRole("main")).toContainText("Badge parity");
  await expect(page.getByRole("main")).toContainText("Metrics and progress");
  await expect(page.locator("#react-badge-mount .badge")).toHaveText("verified");
  await expect(page.locator("[data-explorer-id='react:Badge']")).toContainText("react-primitive");
  await expect(page.locator("[data-explorer-id='element:k-badge']")).toContainText("custom-element");
  await expect(page.locator("[data-explorer-id='react:Button'] k-button")).toBeVisible();
  for (const component of ["Input", "Select", "Textarea"]) {
    const card = page.locator(`[data-explorer-id='react:${component}']`);
    const role = component === "Select" ? "combobox" : "textbox";
    await expect(card.getByRole(role, { name: `${component} playground` })).toBeVisible();
  }
  for (const theme of ["theme-console", "theme-flow", "theme-surface", "theme-survey"])
    for (const mode of ["light", "dark"])
      await expect(page.locator(`[data-theme-matrix='${theme}:${mode}']`)).toBeVisible();
  await assertTokenStylesResolved(page);
  expect(consoleErrors).toEqual([]);
});

test("applies each product theme selector to component behavior and detects a corrupted theme rule", async ({ page }) => {
  const consoleErrors = await loadKitPage(page, "/docs/gallery.html");

  const matrix = await page.locator("[data-theme-matrix]").evaluateAll((samples) => samples.map((sample) => {
    const button = sample.querySelector("k-button button");
    const input = sample.querySelector("k-input input");
    const toggle = sample.querySelector("k-toggle input");
    if (!button || !input || !toggle) throw new Error("Theme matrix is missing a component probe.");
    const sampleStyle = getComputedStyle(sample);
    const buttonStyle = getComputedStyle(button);
    const inputStyle = getComputedStyle(input);
    const toggleStyle = getComputedStyle(toggle);
    return {
      id: sample.getAttribute("data-theme-matrix"),
      brand: sampleStyle.getPropertyValue("--k-brand").trim(),
      background: sampleStyle.getPropertyValue("--k-bg").trim(),
      panelToken: sampleStyle.getPropertyValue("--k-panel").trim(),
      raisedToken: sampleStyle.getPropertyValue("--k-panel-raised").trim(),
      panel: sampleStyle.backgroundColor,
      button: buttonStyle.backgroundColor,
      input: inputStyle.backgroundColor,
      inputBorder: inputStyle.borderTopColor,
      toggle: toggleStyle.backgroundColor,
    };
  }));

  const expected = {
    "theme-console:dark": { brand: "#c9ff4a", background: "#11120f", panel: "#191b16", raised: "#20231e" },
    "theme-console:light": { brand: "#6c9400", background: "#f3f5eb", panel: "#fbfcf7", raised: "#eef2e6" },
    "theme-flow:dark": { brand: "#2f88a6", background: "#0a0e13", panel: "#111824", raised: "#16202d" },
    "theme-flow:light": { brand: "#1f6f88", background: "#f5f4ef", panel: "#ffffff", raised: "#fbfaf7" },
    "theme-surface:dark": { brand: "#14a37a", background: "#0a0e13", panel: "#111824", raised: "#16202d" },
    "theme-surface:light": { brand: "#0f6b52", background: "#f5f4ef", panel: "#ffffff", raised: "#fbfaf7" },
    "theme-survey:dark": { brand: "#5ce0c6", background: "#06080b", panel: "#111824", raised: "#16202d" },
    "theme-survey:light": { brand: "#16806f", background: "#06080b", panel: "#ffffff", raised: "#fbfaf7" },
  };
  for (const sample of matrix) {
    const tokens = expected[sample.id as keyof typeof expected];
    expect(tokens, `missing expected tokens for ${sample.id}`).toBeDefined();
    expect(sample.brand).toBe(tokens.brand);
    expect(sample.background).toBe(tokens.background);
    expect(sample.panelToken).toBe(tokens.panel);
    expect(sample.raisedToken).toBe(tokens.raised);
    expect(sample.panel).toBe(hexToRgb(tokens.panel));
    expect(sample.button).toBe(hexToRgb(tokens.brand));
    expect(sample.input).toBe(hexToRgb(tokens.raised));
    expect(sample.toggle).toBe(hexToRgb(tokens.brand));
  }

  const probe = page.locator("[data-theme-matrix='theme-console:dark']");
  const button = probe.locator("k-button button");
  const before = await button.evaluate((node) => getComputedStyle(node).backgroundColor);
  const originalBrand = await page.evaluate(() => {
    const findThemeRule = (stylesheet: CSSStyleSheet): CSSStyleRule | undefined => {
      for (const rule of Array.from(stylesheet.cssRules)) {
        if ("selectorText" in rule && rule.selectorText === ".theme-console") return rule as CSSStyleRule;
        if ("styleSheet" in rule && rule.styleSheet) {
          const nested = findThemeRule(rule.styleSheet);
          if (nested) return nested;
        }
      }
    };
    const rule = Array.from(document.styleSheets).map(findThemeRule).find(Boolean);
    if (!rule) throw new Error("Theme-console CSS rule was not found.");
    const original = rule.style.getPropertyValue("--k-brand");
    rule.style.setProperty("--k-brand", "#010203");
    return original;
  });
  await expect(button).toHaveCSS("background-color", "rgb(1, 2, 3)");
  expect(await button.evaluate((node) => getComputedStyle(node).backgroundColor)).not.toBe(before);
  await page.evaluate((brand) => {
    const findThemeRule = (stylesheet: CSSStyleSheet): CSSStyleRule | undefined => {
      for (const rule of Array.from(stylesheet.cssRules)) {
        if ("selectorText" in rule && rule.selectorText === ".theme-console") return rule as CSSStyleRule;
        if ("styleSheet" in rule && rule.styleSheet) {
          const nested = findThemeRule(rule.styleSheet);
          if (nested) return nested;
        }
      }
    };
    const rule = Array.from(document.styleSheets).map(findThemeRule).find(Boolean);
    if (!rule) throw new Error("Theme-console CSS rule was not found while restoring it.");
    rule.style.setProperty("--k-brand", brand);
  }, originalBrand);
  await expect(button).toHaveCSS("background-color", before);

  expect(consoleErrors).toEqual([]);
});

function hexToRgb(value: string): string {
  const hex = value.slice(1);
  const channels = [hex.slice(0, 2), hex.slice(2, 4), hex.slice(4, 6)].map((channel) => Number.parseInt(channel, 16));
  return `rgb(${channels.join(", ")})`;
}

test("renders the element demo from built custom elements and React class contracts", async ({ page }) => {
  const consoleErrors = await loadKitPage(page, "/elements/demo.html");

  await expect(page).toHaveTitle("Kontour UI Elements Demo");
  await expect(page.getByRole("main")).toContainText("Elements Parity");
  await expect(page.getByRole("main")).toContainText("React contract comparison");
  await expect(page.locator("#react-badge-mount .badge")).toHaveText("verified");
  await expect(page.locator("k-badge").first().locator(".badge")).toBeVisible();
  await expect(page.locator("k-status-badge").first().locator(".status")).toBeVisible();
  await expect(page.locator("k-button").filter({ hasText: "Accept" }).locator("button")).toHaveClass(/btn-positive/);
  await assertTokenStylesResolved(page);
  expect(consoleErrors).toEqual([]);
});

test("opens and dismisses the k-dialog modal overlay", async ({ page }) => {
  const consoleErrors = await loadKitPage(page, "/elements/demo.html");

  const dialog = page.locator("k-dialog .dialog");
  await expect(dialog).toBeHidden();

  await page.getByRole("button", { name: "Open dialog" }).click();
  // Native <dialog> opened modally is matched by the :modal/open dialog role.
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("Confirm merge");

  // Esc dismisses and fires the native close path.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  expect(consoleErrors).toEqual([]);
});

test("fires and dismisses a k-toast-host notification", async ({ page }) => {
  const consoleErrors = await loadKitPage(page, "/elements/demo.html");

  const toast = page.locator("#demo-toast-host .toast");
  await expect(toast).toHaveCount(0);

  await page.getByRole("button", { name: "Notify" }).click();
  await expect(toast).toHaveCount(1);
  await expect(toast).toHaveClass(/toast--positive/);
  await expect(toast).toContainText("Readiness met");

  await toast.getByRole("button", { name: "Dismiss" }).click();
  await expect(toast).toHaveCount(0);

  expect(consoleErrors).toEqual([]);
});

test("shows a k-tooltip on hover and toggles a k-popover on click", async ({ page }) => {
  const consoleErrors = await loadKitPage(page, "/elements/demo.html");

  // Tooltip: hidden until the trigger is hovered.
  const tip = page.locator("k-tooltip .tooltip");
  await expect(tip).toBeHidden();
  await page.getByRole("button", { name: "Hover me" }).hover();
  await expect(tip).toBeVisible();

  // Popover: click opens the panel, an outside click dismisses it.
  const panel = page.locator("k-popover .popover__panel");
  await expect(panel).toBeHidden();
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("View evidence");
  await page.mouse.click(5, 5);
  await expect(panel).toBeHidden();

  expect(consoleErrors).toEqual([]);
});

test("keeps gallery layout within the mobile viewport", async ({ page }) => {
  test.skip(test.info().project.name !== "chromium-mobile", "mobile-only layout check");
  const consoleErrors = await loadKitPage(page, "/docs/gallery.html");

  const viewport = page.viewportSize();
  const mainBox = await page.locator("main").boundingBox();
  const topbarBox = await page.getByTitle("Primitive Gallery").locator(".topbar").boundingBox();
  expect(viewport).not.toBeNull();
  expect(mainBox).not.toBeNull();
  expect(topbarBox).not.toBeNull();

  if (viewport && mainBox && topbarBox) {
    expect(mainBox.x).toBeGreaterThanOrEqual(0);
    expect(topbarBox.x).toBeGreaterThanOrEqual(0);
    expect(mainBox.x + mainBox.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(topbarBox.x + topbarBox.width).toBeLessThanOrEqual(viewport.width + 1);
  }

  expect(consoleErrors).toEqual([]);
});

async function loadKitPage(page: Page, path: string): Promise<string[]> {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
  });

  await page.goto(path);
  await expect(page.locator("body")).toBeVisible();
  return consoleErrors;
}

async function assertTokenStylesResolved(page: Page): Promise<void> {
  const styles = await page.locator("body").evaluate((body) => {
    const computed = getComputedStyle(body);
    return {
      background: computed.backgroundColor,
      color: computed.color,
      fontFamily: computed.fontFamily,
    };
  });

  expect(styles.background).not.toBe("rgba(0, 0, 0, 0)");
  expect(styles.color).not.toBe("rgba(0, 0, 0, 0)");
  expect(styles.fontFamily).not.toBe("");
}
