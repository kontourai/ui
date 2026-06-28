import { expect, test, type Page } from "@playwright/test";

test("renders the package gallery with tokens, themes, and primitive components", async ({ page }) => {
  const consoleErrors = await loadKitPage(page, "/docs/gallery.html");

  await expect(page).toHaveTitle("Kontour Console Kit Gallery");
  await expect(page.getByRole("main")).toContainText("Primitive Gallery");
  await expect(page.getByRole("main")).toContainText("@kontourai/ui");
  await expect(page.getByRole("main")).toContainText("theme-console");
  await expect(page.getByRole("main")).toContainText("theme-flow light");
  await expect(page.getByRole("main")).toContainText("theme-survey");
  await expect(page.getByRole("main")).toContainText("theme-surface light");
  await expect(page.getByRole("main")).toContainText("Badge parity");
  await expect(page.getByRole("main")).toContainText("Metrics and progress");
  await expect(page.locator("#react-badge-mount .badge")).toHaveText("verified");
  await assertTokenStylesResolved(page);
  expect(consoleErrors).toEqual([]);
});

test("renders the element demo from built custom elements and React class contracts", async ({ page }) => {
  const consoleErrors = await loadKitPage(page, "/elements/demo.html");

  await expect(page).toHaveTitle("Kontour Console Kit Elements Demo");
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

test("keeps gallery layout within the mobile viewport", async ({ page }) => {
  test.skip(test.info().project.name !== "chromium-mobile", "mobile-only layout check");
  const consoleErrors = await loadKitPage(page, "/docs/gallery.html");

  const viewport = page.viewportSize();
  const mainBox = await page.locator("main").boundingBox();
  const topbarBox = await page.locator(".topbar").boundingBox();
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
