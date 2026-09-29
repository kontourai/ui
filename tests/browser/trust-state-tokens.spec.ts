import { expect, test } from "@playwright/test";

// Each state's chip paints from that state's own tokens (ui#89). The base chip
// draws a dotted neutral line, so a state whose border-style no longer reads
// its -line token still looks right for a dotted state until a theme or
// white-label override of that token is silently ignored. This overrides every
// token of every state on a wrapper and requires the chip to follow. Pinned
// independently of the source, like trust-states.spec.ts.
const STATES = ["unknown", "proposed", "assumed", "verified", "stale", "disputed", "superseded", "rejected", "revoked"];
const DOTTED = ["unknown", "stale", "superseded", "revoked"];

test("every trust chip follows an override of its state's ink, fill, and line tokens", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/docs/gallery.html");
  await expect(page.locator("[data-theme-matrix] k-trust-state .trust-state").first()).toBeVisible();

  const results = await page.evaluate(async (states) => {
    const read = (chip: Element) => {
      const style = getComputedStyle(chip);
      return { color: style.color, background: style.backgroundColor, borderColor: style.borderTopColor, borderStyle: style.borderTopStyle };
    };
    const host = document.createElement("div");
    document.querySelector("main")!.append(host);
    const pairs = states.map((state, index) => {
      const plain = document.createElement("k-trust-state");
      plain.setAttribute("state", state);
      const wrapper = document.createElement("div");
      const overridden = document.createElement("k-trust-state");
      overridden.setAttribute("state", state);
      wrapper.append(overridden);
      host.append(plain, wrapper);
      return { state, index, plain, wrapper, overridden };
    });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return pairs.map(({ state, index, plain, wrapper, overridden }) => {
      const before = read(plain.querySelector(".trust-state__chip")!);
      // A line style different from the state's own, and colors no theme uses.
      const line = before.borderStyle === "dashed" ? "solid" : "dashed";
      wrapper.style.setProperty(`--k-trust-${state}`, `rgb(${index + 1}, 2, 3)`);
      wrapper.style.setProperty(`--k-trust-${state}-fill`, `rgb(${index + 1}, 5, 6)`);
      wrapper.style.setProperty(`--k-trust-${state}-line`, line);
      return { state, before, line, after: read(overridden.querySelector(".trust-state__chip")!) };
    });
  }, STATES);

  expect(results.map((result) => result.state)).toEqual(STATES);
  for (const [index, result] of results.entries()) {
    expect(result.after, `${result.state}: chip follows its tokens`).toEqual({
      color: `rgb(${index + 1}, 2, 3)`,
      background: `rgb(${index + 1}, 5, 6)`,
      borderColor: `rgb(${index + 1}, 2, 3)`,
      borderStyle: result.line,
    });
  }
  // The dotted states are the ones the base rule would mask: before the
  // override they render dotted, after it they must not.
  for (const state of DOTTED) {
    const result = results.find((entry) => entry.state === state)!;
    expect(result.before.borderStyle, `${state}: default line`).toBe("dotted");
    expect(result.after.borderStyle, `${state}: overridden line`).toBe("dashed");
  }
  expect(errors).toEqual([]);
});

// A state's own rule may set its border width (disputed needs a wider one),
// but never hide the line: the line style is the cue that survives without
// color (ui#102). Every side of every chip keeps a visible border, and
// disputed's is wide enough to draw its double line as two strokes and a gap.
const DOUBLE_LINE_MIN_PX = 3;

test("every trust chip draws a visible border, and disputed's is wide enough for a double line", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/docs/gallery.html");
  await expect(page.locator("[data-theme-matrix] k-trust-state .trust-state").first()).toBeVisible();

  const results = await page.evaluate(async (states) => {
    const host = document.createElement("div");
    document.querySelector("main")!.append(host);
    const elements = states.map((state) => {
      const element = document.createElement("k-trust-state");
      element.setAttribute("state", state);
      host.append(element);
      return { state, element };
    });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return elements.map(({ state, element }) => {
      const style = getComputedStyle(element.querySelector(".trust-state__chip")!);
      return {
        state,
        style: style.borderTopStyle,
        widths: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth].map((width) => parseFloat(width)),
      };
    });
  }, STATES);

  expect(results.map((result) => result.state)).toEqual(STATES);
  for (const result of results) {
    expect(result.style, `${result.state}: border style`).not.toMatch(/^(?:none|hidden)$/);
    for (const width of result.widths) expect(width, `${result.state}: border width`).toBeGreaterThan(0);
  }
  const disputed = results.find((result) => result.state === "disputed")!;
  expect(disputed.style).toBe("double");
  for (const width of disputed.widths) expect(width, "disputed: double-line width").toBeGreaterThanOrEqual(DOUBLE_LINE_MIN_PX);
  expect(errors).toEqual([]);
});
