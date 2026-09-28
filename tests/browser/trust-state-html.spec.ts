import { expect, test, type Page } from "@playwright/test";

// renderTrustStateHtml (@kontourai/ui/trust-state) is for consumers that build
// markup as strings. It must produce the markup <k-trust-state> renders, and
// the standalone @kontourai/ui/trust-state.css plus the tokens must style it
// as react/styles.css styles the element. The states are pinned here,
// independently of the source, so a dropped state fails instead of shrinking
// the loop.
const STATES = ["unknown", "proposed", "assumed", "verified", "stale", "disputed", "superseded", "rejected", "revoked"];
const MODULE = "/dist/react/trust-states.js";

type Case = { state: string; label?: string; detail?: string; className?: string };

// Cases whose serialization is canonical: the string must equal the element's
// innerHTML byte for byte.
const EXACT: Case[] = [
  ...STATES.map((state) => ({ state })),
  ...STATES.map((state) => ({ state, detail: `Detail for ${state}` })),
  { state: "stale", label: "Expired", detail: "Verification expired 3 days ago" },
  { state: "verified", label: "VERIFIED" },
  { state: "verified", label: "   " },
  { state: " VERIFIED " },
  { state: "verified", className: "extra classes" },
  { state: "pending" },
  { state: "pending", label: "Awaiting" },
  { state: "" },
];

// Cases with characters the serializer and the renderer may spell
// differently (a quote in text, a < in an attribute): compared after the
// browser parses the string, and nothing in them may become markup.
const ESCAPED: Case[] = [
  { state: "stale", label: '<img src=x onerror="window.__pwned = 1">', detail: "a & b <i>not italic</i> \"quoted\" 'single'" },
  { state: "verified", className: 'x" onclick="window.__pwned = 1' },
  { state: "<b>pending</b>" },
  { state: "disputed", label: "Tom & Jerry's <script>window.__pwned = 1</script>" },
];

async function compare(page: Page, cases: Case[], exact: boolean) {
  return page.evaluate(async ({ cases, exact, module }) => {
    const { renderTrustStateHtml } = await import(module);
    const host = document.createElement("div");
    document.querySelector("main")!.append(host);
    const elements = cases.map((entry) => {
      const element = document.createElement("k-trust-state");
      element.setAttribute("state", entry.state);
      if (entry.label !== undefined) element.setAttribute("label", entry.label);
      if (entry.detail !== undefined) element.setAttribute("detail", entry.detail);
      if (entry.className !== undefined) element.setAttribute("class-name", entry.className);
      host.append(element);
      return element;
    });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const results = cases.map((entry, index) => {
      const html = renderTrustStateHtml(entry.state, { label: entry.label, detail: entry.detail, className: entry.className });
      const parsed = document.createElement("template");
      parsed.innerHTML = html;
      return {
        entry,
        element: elements[index].innerHTML,
        string: exact ? html : parsed.innerHTML,
        injected: parsed.content.querySelectorAll("img, script, i, b").length + [...parsed.content.querySelectorAll("*")].filter((node) => node.hasAttribute("onclick") || node.hasAttribute("onerror")).length,
      };
    });
    host.remove();
    return { results, pwned: (window as unknown as { __pwned?: number }).__pwned ?? null };
  }, { cases, exact, module: MODULE });
}

test("renderTrustStateHtml returns the markup k-trust-state renders, for every state", async ({ page }) => {
  const errors = await load(page, "/docs/gallery.html");
  const { results } = await compare(page, EXACT, true);
  expect(results.filter((result) => !result.entry.detail && !result.entry.label && !result.entry.className && STATES.includes(result.entry.state)).map((result) => result.entry.state)).toEqual(STATES);
  for (const result of results) {
    expect(result.element, `${JSON.stringify(result.entry)}: element rendered a chip`).toContain('class="trust-state__chip"');
    expect(result.string, JSON.stringify(result.entry)).toBe(result.element);
  }
  // Every state carries its glyph; the element and the string agree on it above.
  for (const state of STATES) {
    const result = results.find((entry) => entry.entry.state === state && !entry.entry.detail)!;
    expect(result.string, `${state}: glyph`).toMatch(/<svg class="trust-state__glyph"[^>]*><path d="M[^"]+"><\/path><\/svg>/);
  }
  expect(errors).toEqual([]);
});

test("renderTrustStateHtml escapes labels, details, class names, and unrecognized states as the element does", async ({ page }) => {
  const errors = await load(page, "/docs/gallery.html");
  const { results, pwned } = await compare(page, ESCAPED, false);
  for (const result of results) {
    expect(result.string, JSON.stringify(result.entry)).toBe(result.element);
    expect(result.injected, `${JSON.stringify(result.entry)}: no injected element or handler`).toBe(0);
  }
  expect(pwned).toBeNull();
  expect(errors).toEqual([]);
});

// The chip's own look, as read from computed style.
async function chipStyles(page: Page, render: "element" | "string") {
  return page.evaluate(async ({ states, render, module }) => {
    const host = document.createElement("div");
    document.querySelector("main")!.append(host);
    if (render === "string") {
      const { renderTrustStateHtml } = await import(module);
      host.innerHTML = states.map((state: string) => renderTrustStateHtml(state, { label: `${state} override`, detail: "detail" })).join("");
    } else {
      for (const state of states) {
        const element = document.createElement("k-trust-state");
        element.setAttribute("state", state);
        element.setAttribute("label", `${state} override`);
        element.setAttribute("detail", "detail");
        host.append(element);
      }
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    await document.fonts.ready;
    const pick = (node: Element | null, props: string[]) => {
      if (!node) return null;
      const style = getComputedStyle(node);
      return Object.fromEntries(props.map((prop) => [prop, style.getPropertyValue(prop)]));
    };
    const result = [...host.querySelectorAll(".trust-state")].map((root) => ({
      state: root.getAttribute("data-trust-state"),
      root: pick(root, ["display", "flex-wrap", "column-gap", "row-gap", "vertical-align"]),
      chip: pick(root.querySelector(".trust-state__chip"), ["display", "color", "background-color", "border-top-color", "border-top-style", "border-top-width", "border-radius", "font-family", "font-size", "font-weight", "letter-spacing", "text-transform", "min-height", "padding-left"]),
      glyph: pick(root.querySelector(".trust-state__glyph"), ["width", "height", "fill", "stroke", "stroke-width", "stroke-linecap"]),
      hidden: pick(root.querySelector(".trust-state__hidden"), ["position", "width", "height", "overflow", "clip-path"]),
      detail: pick(root.querySelector(".trust-state__detail"), ["color", "font-size", "overflow-wrap"]),
    }));
    host.remove();
    return result;
  }, { states: STATES, render, module: MODULE });
}

test("trust-state.css and the tokens alone style a string-rendered chip as react/styles.css styles k-trust-state", async ({ browser }) => {
  const gallery = await browser.newPage();
  const galleryErrors = await load(gallery, "/docs/gallery.html");
  const expected = await chipStyles(gallery, "element");
  const consumer = await browser.newPage();
  const consumerErrors = await load(consumer, "/tests/browser/fixtures/trust-state-string.html");
  // The consumer page has no react/styles.css and no custom elements.
  expect(await consumer.evaluate(() => [...document.styleSheets].map((sheet) => new URL(sheet.href!).pathname))).toEqual(["/tokens/index.css", "/react/trust-state.css"]);
  expect(await consumer.evaluate(() => customElements.get("k-trust-state") ?? null)).toBeNull();
  const actual = await chipStyles(consumer, "string");

  expect(expected.map((entry) => entry.state)).toEqual(STATES);
  expect(actual).toEqual(expected);
  // Guard against a vacuous match: the states really are styled apart.
  expect(new Set(actual.map((entry) => entry.chip!["border-top-style"])).size).toBeGreaterThan(1);
  expect(new Set(actual.map((entry) => entry.chip!.color)).size).toBe(STATES.length);
  expect(actual[0].hidden!.position).toBe("absolute");
  expect([...galleryErrors, ...consumerErrors]).toEqual([]);
  await gallery.close();
  await consumer.close();
});

async function load(page: Page, url: string): Promise<string[]> {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url);
  if (url.includes("gallery")) await expect(page.locator("[data-theme-matrix] k-trust-state .trust-state").first()).toBeVisible();
  return errors;
}
