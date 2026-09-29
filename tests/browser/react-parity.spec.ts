import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, test, type Page } from "@playwright/test";

// React primitives and their light-DOM elements must render the same DOM
// (ui#96). React renders here with react-dom/server's renderToStaticMarkup,
// from the built dist/react, the entry consumers import. The browser parses
// that markup and compares it to what the element rendered with isEqualNode,
// so every element, attribute, and text node counts, including the
// whitespace-only text nodes around the trust-basis separators.
//
// TrustState: React, the element, and renderTrustStateHtml share
// trustStatePresentation (the classes, label, hidden label, and glyph), but
// each still builds its own markup, and trust-state-html.spec.ts only ties the
// string renderer to the element. So React is compared here too.
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
type Facet = { field: string; code: string; label: string; caveat: boolean };
type View = { state: string; facets?: Facet[]; label?: string; detail?: Array<{ label: string; value: string }> };
const fixture: { cases: Array<{ name: string; view: View }> } = JSON.parse(readFileSync(path.join(here, "fixtures/trust-basis-views.json"), "utf8"));
const DENSITIES = ["inline", "inspector"] as const;

type Rendered = { id: string; html: string };
type Mismatch = { id: string; react: string; element: string };

async function renderReact() {
  const react = await import("react");
  const server = await import("react-dom/server");
  const ui = await import(pathToFileURL(path.join(repo, "dist/react/index.js")).href);
  const createElement = react.createElement ?? react.default.createElement;
  const renderToStaticMarkup = server.renderToStaticMarkup ?? server.default.renderToStaticMarkup;
  return { ui, render: (component: unknown, props: Record<string, unknown>) => renderToStaticMarkup(createElement(component as never, props as never)), createElement };
}

// Builds each case's element in the page (attributes, then the basis
// property, then child markup) and compares it to the React rendering.
async function compare(page: Page, tag: string, cases: Array<Rendered & { setup: Record<string, unknown> }>): Promise<{ compared: number; mismatches: Mismatch[] }> {
  return page.evaluate(async ({ tag, cases }) => {
    const host = document.createElement("div");
    document.querySelector("main")!.append(host);
    const elements = cases.map((entry) => {
      const element = document.createElement(tag) as HTMLElement & { basis?: unknown };
      const setup = entry.setup as { attributes?: Record<string, string>; basis?: unknown; children?: string };
      for (const [name, value] of Object.entries(setup.attributes ?? {})) element.setAttribute(name, value);
      if ("basis" in setup) element.basis = setup.basis;
      if (setup.children !== undefined) element.innerHTML = setup.children;
      host.append(element);
      return element;
    });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const mismatches = [];
    for (const [index, entry] of cases.entries()) {
      const parsed = document.createElement("template");
      parsed.innerHTML = entry.html;
      const element = elements[index];
      const same = parsed.content.childNodes.length === 1
        && element.childNodes.length === 1
        && parsed.content.firstChild!.isEqualNode(element.firstChild);
      if (!same) mismatches.push({ id: entry.id, react: entry.html, element: element.innerHTML });
    }
    host.remove();
    return { compared: cases.length, mismatches };
  }, { tag, cases });
}

async function load(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/docs/gallery.html");
  await expect(page.locator("k-trust-basis .trust-basis").first()).toBeVisible();
  return errors;
}

test("React TrustBasis renders the same DOM as k-trust-basis, for every fixture and both densities", async ({ page }) => {
  const errors = await load(page);
  const { ui, render } = await renderReact();
  // Two views the component cannot use: none at all, and one malformed facet
  // beside a valid caveat (all or nothing, so both render the fallback).
  const unusable: Array<{ name: string; basis: unknown }> = [
    { name: "unusable-undefined", basis: undefined },
    {
      name: "unusable-blank-label",
      basis: { state: "recorded", facets: [{ field: "derivationMethod", code: "model", label: "Model-derived", caveat: true }, { field: "method", code: "x", label: "", caveat: false }] },
    },
  ];
  const views = [...fixture.cases.map((entry) => ({ name: entry.name, basis: entry.view as unknown })), ...unusable];
  expect(fixture.cases.length, "fixture views").toBe(10);
  const cases = views.flatMap(({ name, basis }) => DENSITIES.flatMap((density) => [
    {
      id: `${name} (${density})`,
      html: render(ui.TrustBasis, { basis, density }),
      setup: { attributes: { density }, ...(basis === undefined ? {} : { basis }) },
    },
    {
      id: `${name} (${density}, className)`,
      html: render(ui.TrustBasis, { basis, density, className: "extra classes" }),
      setup: { attributes: { density, "class-name": "extra classes" }, ...(basis === undefined ? {} : { basis }) },
    },
  ]));
  const result = await compare(page, "k-trust-basis", cases);
  expect(result.compared).toBe(48);
  expect(result.mismatches).toEqual([]);
  // The comparison reached rendered facets, separators, and detail rows.
  expect(cases.filter((entry) => entry.html.includes('class="trust-basis__sep"')).length).toBeGreaterThan(0);
  expect(cases.filter((entry) => entry.html.includes('class="trust-basis__detail"')).length).toBeGreaterThan(0);
  const fallbacks = cases.filter((entry) => entry.id.startsWith("unusable"));
  expect(fallbacks.length).toBe(8);
  for (const entry of fallbacks) expect(entry.html, entry.id).toContain(">Basis not available</span>");
  expect(errors).toEqual([]);
});

test("React TrustState renders the same DOM as k-trust-state", async ({ page }) => {
  const errors = await load(page);
  const { ui, render, createElement } = await renderReact();
  const STATES = ["unknown", "proposed", "assumed", "verified", "stale", "disputed", "superseded", "rejected", "revoked"];
  type Case = { state: string; label?: string; detail?: string; className?: string };
  const plain: Case[] = [
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
    { state: "disputed", label: "Tom & Jerry's <b>", detail: 'a & b "quoted"' },
  ];
  const cases = plain.map((entry) => {
    const attributes: Record<string, string> = { state: entry.state };
    if (entry.label !== undefined) attributes.label = entry.label;
    if (entry.detail !== undefined) attributes.detail = entry.detail;
    if (entry.className !== undefined) attributes["class-name"] = entry.className;
    return { id: JSON.stringify(entry), html: render(ui.TrustState, entry), setup: { attributes } };
  });
  // Detail as markup: React children, and the element's child nodes.
  cases.push({
    id: "linked detail",
    html: render(ui.TrustState, { state: "verified", detail: createElement("a", { href: "#evidence" }, "12 source records") }),
    setup: { attributes: { state: "verified" }, children: '<a href="#evidence">12 source records</a>' } as never,
  });
  const result = await compare(page, "k-trust-state", cases);
  expect(result.compared).toBe(STATES.length * 2 + 10);
  expect(result.mismatches).toEqual([]);
  expect(cases.filter((entry) => entry.html.includes('class="trust-state__glyph"')).length).toBeGreaterThanOrEqual(STATES.length * 2);
  expect(errors).toEqual([]);
});
