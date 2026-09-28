import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

// Trust basis (ui#87). Surface's claimBasisView owns the summary; Kontour UI
// renders the view it is given. The fixture views were produced by
// @kontourai/surface 3.3.0 (check:surface-parity recomputes them with the
// installed Surface), so these tests render what Surface actually emits.
type Facet = { field: string; code: string; label: string; caveat: boolean };
type Row = { label: string; value: string };
type View = { state: string; facets?: Facet[]; label?: string; detail?: Row[] };
type Case = { name: string; view: View };

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture: { cases: Case[] } = JSON.parse(readFileSync(path.join(here, "fixtures/trust-basis-views.json"), "utf8"));
const cases = new Map(fixture.cases.map((entry) => [entry.name, entry.view]));
const MISSING = ["not-recorded", "restricted", "unavailable", "not-available"];
const FALLBACK = "Basis not available";

type Rendered = {
  state: string | null;
  tag: string;
  prefix: { text: string; width: number; first: boolean } | null;
  facets: Array<Facet & { decorationLine: string; decorationStyle: string; decorationColor: string; color: string }>;
  separators: Array<{ text: string; ariaHidden: string | null }>;
  lineText: string;
  missing: string | null;
  rows: Row[];
  visible: boolean;
  muted: string;
};

// Reads what one k-trust-basis host rendered.
async function readHost(page: Page, selector: string): Promise<Rendered> {
  return page.locator(selector).evaluate((host) => {
    const root = host.querySelector(".trust-basis");
    if (!root) throw new Error("k-trust-basis rendered no .trust-basis root.");
    const line = root.querySelector(".trust-basis__line")!;
    const prefix = line.querySelector(".trust-basis__hidden");
    const probe = document.createElement("span");
    probe.style.color = "var(--k-text-muted)";
    host.append(probe);
    const muted = getComputedStyle(probe).color;
    probe.remove();
    const box = line.getBoundingClientRect();
    return {
      state: root.getAttribute("data-basis-state"),
      tag: root.tagName.toLowerCase(),
      prefix: prefix && prefix.textContent === "Basis: "
        ? { text: prefix.textContent, width: prefix.getBoundingClientRect().width, first: line.firstElementChild === prefix }
        : null,
      facets: Array.from(line.querySelectorAll<HTMLElement>(".trust-basis__facet")).map((node) => {
        const style = getComputedStyle(node);
        return {
          field: node.dataset.field ?? "",
          code: node.dataset.code ?? "",
          caveat: node.dataset.caveat === "true",
          label: node.textContent ?? "",
          decorationLine: style.textDecorationLine,
          decorationStyle: style.textDecorationStyle,
          decorationColor: style.textDecorationColor,
          color: style.color,
        };
      }),
      separators: Array.from(line.querySelectorAll(".trust-basis__sep")).map((node) => ({ text: node.textContent ?? "", ariaHidden: node.getAttribute("aria-hidden") })),
      lineText: line.textContent ?? "",
      missing: line.querySelector(".trust-basis__missing")?.textContent ?? null,
      rows: Array.from(root.querySelectorAll(".trust-basis__row")).map((row) => ({
        label: row.querySelector("dt")?.textContent ?? "",
        value: row.querySelector("dd")?.textContent ?? "",
      })),
      visible: box.width > 0 && box.height > 0,
      muted,
    };
  });
}

// The rendering contract for one view, from the view alone.
function expectRendersView(rendered: Rendered, view: View, density: "inline" | "inspector", where: string) {
  expect(rendered.visible, `${where}: line has a rendered box`).toBe(true);
  expect(rendered.lineText.trim(), `${where}: never blank`).not.toBe("");
  expect(rendered.tag, `${where}: root element`).toBe(density === "inline" ? "span" : "div");
  expect(rendered.state, `${where}: data-basis-state`).toBe(view.state);
  if (view.state === "recorded") {
    const facets = view.facets!;
    expect(rendered.prefix, `${where}: visually hidden "Basis:" prefix first`).toMatchObject({ text: "Basis: ", first: true });
    expect(rendered.prefix!.width, `${where}: prefix is visually hidden`).toBeLessThanOrEqual(1);
    // Exactly the view's facets, order, labels, codes, fields, and caveat flags.
    expect(rendered.facets.map(({ field, code, label, caveat }) => ({ field, code, label, caveat })), `${where}: facets`).toEqual(facets);
    // Nothing else on the line: the prefix, the labels, and the separators.
    expect(rendered.lineText, `${where}: line text`).toBe(`Basis: ${facets.map((facet) => facet.label).join(",  · ")}`);
    expect(rendered.separators, `${where}: separators hidden from assistive tech`).toEqual(facets.slice(1).map(() => ({ text: "·", ariaHidden: "true" })));
    for (const facet of rendered.facets) {
      expect(facet.color, `${where} ${facet.code}: muted text`).toBe(rendered.muted);
      if (facet.caveat) {
        expect([facet.decorationLine, facet.decorationStyle], `${where} ${facet.code}: caveat is underlined, dashed`).toEqual(["underline", "dashed"]);
        // The underline is the text's own color: a line-style cue, never a hue.
        expect(facet.decorationColor, `${where} ${facet.code}: underline color`).toBe(facet.color);
      } else {
        expect(facet.decorationLine, `${where} ${facet.code}: non-caveat is not decorated`).toBe("none");
      }
    }
    expect(rendered.missing).toBeNull();
  } else {
    expect(rendered.missing, `${where}: missing-state label`).toBe(view.label);
    expect(rendered.lineText, `${where}: only the label`).toBe(view.label);
    expect(rendered.facets).toEqual([]);
  }
  expect(rendered.rows, `${where}: inspector rows`).toEqual(density === "inspector" ? view.detail ?? [] : []);
}

test("the gallery renders every fixture view after its status chip, in both densities", async ({ page }) => {
  const messages = await load(page);
  const examples = await page.locator("[data-basis-gallery] [data-fixture]").evaluateAll((nodes) => nodes.map((node) => {
    const basis = node.querySelector("k-trust-basis")!;
    return {
      name: node.getAttribute("data-fixture")!,
      density: node.getAttribute("data-density")!,
      json: basis.getAttribute("basis-json"),
      // The basis line follows the chip; it is never a second chip.
      afterChip: basis.previousElementSibling?.tagName.toLowerCase() === "k-trust-state",
      chips: node.querySelectorAll(".trust-state__chip").length,
    };
  }));
  expect(new Set(examples.map((entry) => entry.density))).toEqual(new Set(["inline", "inspector"]));
  // Every missing state, a caveat-heavy line (more than 3 caveats, none dropped),
  // and the linked-check case are shown.
  for (const name of [...MISSING, "caveat-heavy", "linked-check-only", "extracted", "model-derived", "reviewed"]) {
    expect(examples.some((entry) => entry.name === name), `gallery shows ${name}`).toBe(true);
  }
  expect(cases.get("caveat-heavy")!.facets!.filter((facet) => facet.caveat).length).toBeGreaterThan(3);
  for (const [index, entry] of examples.entries()) {
    // The gallery shows Surface's views, not hand-made ones.
    expect(JSON.parse(entry.json!), `gallery ${entry.name} is the fixture view`).toEqual(cases.get(entry.name));
    expect(entry.afterChip, `${entry.name}: follows a k-trust-state`).toBe(true);
    expect(entry.chips, `${entry.name}: one chip only`).toBe(1);
    const host = page.locator("[data-basis-gallery] [data-fixture] k-trust-basis").nth(index);
    const view = cases.get(entry.name)!;
    expectRendersView(await readHostLocator(host), view, entry.density as "inline" | "inspector", `gallery ${entry.name} (${entry.density})`);
  }
  expect(messages.errors).toEqual([]);
  expect(messages.warnings, "Surface's views are all valid").toEqual([]);
});

test("the element renders every Surface view through the property, both densities, in light and dark", async ({ page }) => {
  const messages = await load(page);
  for (const mode of ["dark", "light"]) {
    await page.evaluate((mode) => { document.documentElement.dataset.theme = mode; }, mode);
    for (const density of ["inline", "inspector"] as const) {
      await mount(page, fixture.cases.map((entry) => ({ id: `p-${entry.name}`, basis: entry.view, density })));
      for (const entry of fixture.cases) {
        expectRendersView(await readHost(page, `#p-${entry.name}`), entry.view, density, `${mode} ${density} ${entry.name}`);
      }
    }
  }
  expect(messages.errors).toEqual([]);
  expect(messages.warnings).toEqual([]);
});

test("only evidence linked to the claim reaches the line: a failed execution-trail call does not", async ({ page }) => {
  await load(page);
  // Surface's view for a claim with one passing linked check and one failed,
  // unlinked execution-trail tool call (see the fixture inputs).
  const view = cases.get("linked-check-only")!;
  await mount(page, [{ id: "linked", basis: view }]);
  const rendered = await readHost(page, "#linked");
  expectRendersView(rendered, view, "inline", "linked-check-only");
  expect(rendered.lineText).toBe("Basis: Checked against expectations,  · 1 entails the claim");
  expect(rendered.facets.some((facet) => facet.caveat)).toBe(false);
});

test("the line is exactly the view: no reordering, truncation, relabelling, or added facets", async ({ page }) => {
  const messages = await load(page);
  // Labels and codes Surface would never emit, with a caveat after a
  // non-caveat and more than three facets. If Kontour UI recomputed, sorted,
  // capped, or looked up labels, this would not render verbatim.
  const view = {
    state: "recorded",
    facets: [
      { field: "method", code: "zz-one", label: "Sentinel one", caveat: false },
      { field: "result", code: "zz-two", label: "Sentinel two", caveat: true },
      { field: "reviewerAuthority", code: "zz-three", label: "Sentinel three", caveat: false },
      { field: "counterevidence", code: "zz-four", label: "Sentinel four", caveat: true },
      { field: "supportStrength", code: "zz-five", label: "Sentinel five", caveat: false },
    ],
    detail: [{ label: "Sentinel row", value: "Sentinel value" }],
  };
  await mount(page, [{ id: "sentinel", basis: view, density: "inspector" }]);
  expectRendersView(await readHost(page, "#sentinel"), view, "inspector", "sentinel");
  expect(messages.warnings).toEqual([]);
});

test("the line is never blank: unusable input renders \"Basis not available\" and warns", async ({ page }) => {
  const messages = await load(page);
  const bad: Array<{ id: string; basis?: unknown; json?: string }> = [
    { id: "none" },
    { id: "null", basis: null },
    { id: "empty-object", basis: {} },
    { id: "no-facets", basis: { state: "recorded", facets: [] } },
    { id: "blank-facets", basis: { state: "recorded", facets: [{ field: "method", code: "x", label: "  ", caveat: false }] } },
    { id: "empty-label", basis: { state: "not-recorded", label: "" } },
    { id: "unknown-state", basis: { state: "pending", label: "Pending" } },
    // One malformed facet makes the whole line unusable: rendering the rest
    // would silently drop the caveat (here Model-derived).
    {
      id: "blank-caveat-beside-valid",
      basis: { state: "recorded", facets: [
        { field: "derivationMethod", code: "model", label: "", caveat: true },
        { field: "method", code: "extraction", label: "Extracted from a source", caveat: false },
      ] },
    },
    {
      id: "string-caveat-beside-valid",
      basis: { state: "recorded", facets: [
        { field: "derivationMethod", code: "model", label: "Model-derived", caveat: "true" },
        { field: "method", code: "extraction", label: "Extracted from a source", caveat: false },
      ] },
    },
    {
      id: "bad-detail-row",
      basis: { state: "recorded", facets: [{ field: "method", code: "extraction", label: "Extracted from a source", caveat: false }], detail: [{ label: "How", value: "Extracted (1)" }, { label: "Support", value: "" }] },
    },
    { id: "detail-not-array", basis: { state: "not-recorded", label: "Basis not recorded", detail: { label: "How", value: "x" } } },
    { id: "bad-json", json: "{not json" },
    { id: "empty-json", json: "" },
  ];
  await mount(page, bad);
  for (const entry of bad) {
    const rendered = await readHost(page, `#${entry.id}`);
    expect(rendered.state, `${entry.id}: state`).toBe("not-available");
    expect(rendered.missing, `${entry.id}: text`).toBe(FALLBACK);
    expect(rendered.visible, `${entry.id}: visible`).toBe(true);
  }
  // Warnings are de-duplicated by message, so there are fewer than inputs.
  expect(messages.warnings.length, "unusable input warns").toBeGreaterThan(0);
  expect(messages.warnings.every((message) => message.startsWith("[@kontourai/ui TrustBasis]"))).toBe(true);
  expect(messages.errors).toEqual([]);
});

test("k-trust-basis: basis-json from the parser, property before upgrade, property over attribute", async ({ page }) => {
  const messages = await load(page);
  const extracted = cases.get("extracted")!;
  const restricted = cases.get("restricted")!;
  const result = await page.evaluate(async ({ extracted, restricted }) => {
    const text = (host: Element) => host.querySelector(".trust-basis__line")?.textContent ?? null;
    const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

    // A property set before the element is upgraded (here: created in a
    // document with no registry) must not be shadowed by an own property.
    const inert = document.implementation.createHTMLDocument("");
    const early = inert.createElement("k-trust-basis") as HTMLElement & { basis?: unknown };
    early.id = "early";
    early.basis = extracted;
    document.querySelector("main")!.append(document.adoptNode(early));
    await tick();
    const earlyText = text(document.querySelector("#early")!);

    // The property wins over basis-json; clearing it falls back to the attribute.
    const both = document.createElement("k-trust-basis") as HTMLElement & { basis?: unknown };
    both.setAttribute("basis-json", JSON.stringify(restricted));
    both.basis = extracted;
    document.querySelector("main")!.append(both);
    await tick();
    const propertyText = text(both);
    both.basis = undefined;
    await tick();
    const attributeText = text(both);
    // null clears the property the same way.
    both.basis = extracted;
    await tick();
    both.basis = null;
    await tick();
    const nullText = text(both);
    both.setAttribute("density", "inspector");
    both.basis = extracted;
    await tick();
    const rows = both.querySelectorAll(".trust-basis__row").length;

    // Parser-created element with the attribute, after the element is defined
    // (connectedCallback runs while the parser is still building the document).
    const defined = Boolean(customElements.get("k-trust-basis"));
    const markup = `<!doctype html><body><k-trust-basis id="parsed" basis-json='${JSON.stringify(extracted)}'></k-trust-basis></body>`;
    document.open();
    document.write(markup);
    document.close();
    await tick();
    const parsed = document.querySelector("#parsed")!;
    return {
      earlyText,
      propertyText,
      attributeText,
      nullText,
      rows,
      defined,
      upgraded: parsed instanceof customElements.get("k-trust-basis")!,
      parsedText: text(parsed),
      parsedChildren: parsed.children.length,
    };
  }, { extracted, restricted });
  const extractedLine = `Basis: ${extracted.facets!.map((facet) => facet.label).join(",  · ")}`;
  expect(result.earlyText).toBe(extractedLine);
  expect(result.propertyText).toBe(extractedLine);
  expect(result.attributeText).toBe(restricted.label);
  expect(result.nullText).toBe(restricted.label);
  expect(result.rows).toBe(extracted.detail!.length);
  expect(result.defined).toBe(true);
  expect(result.upgraded).toBe(true);
  expect(result.parsedText).toBe(extractedLine);
  expect(result.parsedChildren).toBe(1);
  expect(messages.errors).toEqual([]);
});

test("assistive tech hears \"Basis:\" and the facets, not the separators", async ({ page }) => {
  await load(page);
  const view = cases.get("model-derived")!;
  await mount(page, [{ id: "spoken", basis: view }]);
  const snapshot = await page.locator("#spoken").ariaSnapshot();
  const labels = view.facets!.map((facet) => facet.label);
  // Chromium's accessible text puts a space on each side of the visually
  // hidden (absolutely positioned) comma; the words and the pauses are what count.
  expect(snapshot.replace(/\s+,/g, ",")).toContain(`Basis: ${labels.join(", ")}`);
  expect(snapshot).not.toContain("·");
});

test("inspector density: assistive tech hears the line, then each labelled row", async ({ page }) => {
  await load(page);
  const view = cases.get("reviewed")!;
  await mount(page, [{ id: "spoken-inspector", basis: view, density: "inspector" }]);
  const snapshot = await page.locator("#spoken-inspector").ariaSnapshot();
  const labels = view.facets!.map((facet) => facet.label);
  const line = snapshot.split("\n").find((entry) => entry.includes("Basis:")) ?? "";
  expect(line.replace(/\s+,/g, ",")).toContain(`Basis: ${labels.join(", ")}`);
  // The line's separators are hidden; a "·" inside a detail value is Surface's own wording.
  expect(line).not.toContain("·");
  // Every detail row is exposed as a term and its definition, in order.
  const rows = await page.locator("#spoken-inspector dl").evaluate((list) => Array.from(list.querySelectorAll("dt")).map((term) => [term.textContent, term.nextElementSibling?.tagName, term.nextElementSibling?.textContent]));
  expect(rows).toEqual(view.detail!.map((row) => [row.label, "DD", row.value]));
  for (const row of view.detail!) {
    expect(snapshot).toContain(`term: ${row.label}`);
    expect(snapshot).toContain(`definition: ${row.value}`);
  }
});

async function mount(page: Page, entries: Array<{ id: string; basis?: unknown; json?: string; density?: string }>) {
  await page.evaluate(async (entries) => {
    document.querySelector("#basis-fixture")?.remove();
    const holder = document.createElement("div");
    holder.id = "basis-fixture";
    holder.className = "panel";
    for (const entry of entries) {
      const host = document.createElement("k-trust-basis") as HTMLElement & { basis?: unknown };
      host.id = entry.id;
      if (entry.density) host.setAttribute("density", entry.density);
      if (entry.json !== undefined) host.setAttribute("basis-json", entry.json);
      if ("basis" in entry) host.basis = entry.basis;
      holder.append(host);
    }
    document.querySelector("main")!.append(holder);
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }, entries);
}

async function readHostLocator(host: ReturnType<Page["locator"]>): Promise<Rendered> {
  const id = await host.evaluate((node) => {
    if (!node.id) node.id = `basis-host-${Math.random().toString(36).slice(2)}`;
    return node.id;
  });
  return readHost(host.page(), `#${id}`);
}

async function load(page: Page): Promise<{ errors: string[]; warnings: string[] }> {
  const messages = { errors: [] as string[], warnings: [] as string[] };
  page.on("console", (message) => {
    if (message.type() === "error") messages.errors.push(message.text());
    if (message.type() === "warning") messages.warnings.push(message.text());
  });
  page.on("pageerror", (error) => messages.errors.push(error.message));
  await page.goto("/docs/gallery.html");
  await expect(page.locator("[data-basis-gallery] k-trust-basis .trust-basis").first()).toBeVisible();
  return messages;
}
