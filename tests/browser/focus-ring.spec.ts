import { expect, test, type Page } from "@playwright/test";

// ui#82: a keyboard-focused button must show a ring that reaches 3:1 against
// the colors beside it. The ring is an outline offset from the button, so its
// neighbours on both sides are the surface the button sits on (the offset gap
// and the outside); the button's own fill is not beside it. A ring drawn as a
// border only (offset 0, inside the button) would sit on the fill, which for a
// primary button is usually the focus color itself.

type Ring = {
  id: string;
  focusVisible: boolean;
  style: string;
  width: number;
  offset: number;
  ring: string;
  surface: string;
  fill: string;
};

async function focusAndRead(page: Page, selector: string, index: number, id: string): Promise<Ring> {
  const button = page.locator(selector).nth(index);
  await button.focus();
  await settleTransitions(page);
  return button.evaluate((node, id) => {
    const style = getComputedStyle(node);
    // The surface is the nearest ancestor that paints an opaque background.
    let surface = "";
    for (let element = node.parentElement; element; element = element.parentElement) {
      const background = getComputedStyle(element).backgroundColor;
      const alpha = /rgba\([^)]*,\s*([\d.]+)\)/.exec(background)?.[1];
      if (background !== "transparent" && (alpha === undefined || Number(alpha) === 1)) { surface = background; break; }
    }
    return {
      id,
      focusVisible: node.matches(":focus-visible"),
      style: style.outlineStyle,
      width: Number.parseFloat(style.outlineWidth),
      offset: Number.parseFloat(style.outlineOffset),
      ring: style.outlineColor,
      surface,
      fill: style.backgroundColor,
    };
  }, id);
}

function assertRing(ring: Ring): void {
  expect(ring.focusVisible, `${ring.id}: not :focus-visible`).toBe(true);
  expect(ring.style, `${ring.id}: focused button shows no outline`).toBe("solid");
  expect(ring.width, `${ring.id}: ring width`).toBeGreaterThanOrEqual(2);
  // The offset is what makes the surface, not the fill, the ring's neighbour.
  expect(ring.offset, `${ring.id}: ring must be offset from the button`).toBeGreaterThanOrEqual(1);
  expect(ring.surface, `${ring.id}: no opaque surface found`).not.toBe("");
  expect(contrast(ring.ring, ring.surface), `${ring.id}: ring ${ring.ring} on surface ${ring.surface}`).toBeGreaterThanOrEqual(3);
}

test("every focused button variant shows a ring with 3:1 against its surface in both page modes", async ({ page }) => {
  await loadGallery(page);
  const variants = "k-panel[title='Actions'] k-button button";
  const count = await page.locator(variants).count();
  expect(count).toBe(5);
  for (const mode of ["dark", "light"]) {
    await page.evaluate((mode) => { document.documentElement.dataset.theme = mode; }, mode);
    // A key press first, so programmatic focus counts as keyboard focus.
    await page.keyboard.press("Tab");
    for (let index = 0; index < count; index += 1) {
      const variant = await page.locator(variants).nth(index).evaluate((node) => node.className);
      assertRing(await focusAndRead(page, variants, index, `page:${mode} ${variant}`));
    }
  }
});

test("a focused primary button shows a ring with 3:1 against its surface in every theme and mode", async ({ page }) => {
  await loadGallery(page);
  for (const pageMode of ["dark", "light"]) {
    await page.evaluate((mode) => { document.documentElement.dataset.theme = mode; }, pageMode);
    await page.keyboard.press("Tab");
    const selector = "[data-theme-matrix] k-button button";
    const ids = await page.locator(selector).evaluateAll((nodes) => nodes.map((node) => node.closest("[data-theme-matrix]")!.getAttribute("data-theme-matrix")!));
    expect(ids.length).toBe(10);
    for (const [index, id] of ids.entries()) {
      const ring = await focusAndRead(page, selector, index, `page:${pageMode} > ${id}`);
      assertRing(ring);
    }
  }
});

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
  await expect(page.locator("k-panel[title='Actions'] k-button button").first()).toBeVisible();
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
