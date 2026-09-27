import { expect, test, type Page } from "@playwright/test";

// Trust states (ui#73). Pinned here, independently of the component source, so
// a state or label dropped from the implementation fails instead of shrinking
// the loop.
const LABELS: Record<string, string> = {
  verified: "Verified",
  known: "Known",
  inferred: "Inferred",
  estimated: "Estimated",
  uncertain: "Uncertain",
  conflicting: "Conflicting",
  failed: "Failed",
  unavailable: "Unavailable",
  "not-checked": "Not checked",
};
const STATES = Object.keys(LABELS);
// The line style groups states by how established they are; the glyph tells
// states within a group apart.
const LINE_STYLES: Record<string, string> = {
  verified: "solid",
  known: "solid",
  failed: "solid",
  inferred: "dashed",
  estimated: "dashed",
  uncertain: "dotted",
  unavailable: "dotted",
  "not-checked": "dotted",
  conflicting: "double",
};

type Probe = {
  scope: string;
  state: string;
  dataState: string | null;
  label: string;
  visible: boolean;
  glyph: string;
  glyphHidden: string | null;
  borderStyle: string;
  color: string;
  fill: string;
  brand: string;
  action: string;
};

async function probe(page: Page, scopeSelector: string): Promise<Probe[]> {
  return page.locator(scopeSelector).evaluateAll((scopes) => scopes.flatMap((scope) => {
    const scopeStyle = getComputedStyle(scope);
    const paint = (token: string) => {
      const probeNode = document.createElement("span");
      probeNode.style.color = `var(${token})`;
      scope.append(probeNode);
      const value = getComputedStyle(probeNode).color;
      probeNode.remove();
      return value;
    };
    const brand = paint("--k-brand");
    const action = paint("--k-action");
    return Array.from(scope.querySelectorAll("k-trust-state")).map((host) => {
      const root = host.querySelector(".trust-state");
      const chip = host.querySelector(".trust-state__chip");
      const label = host.querySelector(".trust-state__label");
      const glyph = host.querySelector(".trust-state__glyph");
      if (!root || !chip || !label || !glyph) throw new Error(`k-trust-state[state=${host.getAttribute("state")}] rendered no chip.`);
      const chipStyle = getComputedStyle(chip);
      const box = (label as HTMLElement).getBoundingClientRect();
      return {
        scope: scope.getAttribute("data-theme-matrix") ?? `page:${document.documentElement.dataset.theme ?? scopeStyle.colorScheme}`,
        state: host.getAttribute("state") ?? "",
        dataState: root.getAttribute("data-trust-state"),
        label: (label as HTMLElement).innerText.trim(),
        visible: box.width > 0 && box.height > 0 && getComputedStyle(label).visibility !== "hidden",
        glyph: getComputedStyle(glyph, "::before").content,
        glyphHidden: glyph.getAttribute("aria-hidden"),
        borderStyle: chipStyle.borderTopStyle,
        color: chipStyle.color,
        fill: chipStyle.backgroundColor,
        brand,
        action,
      };
    });
  }));
}

test("every trust state renders its visible text label in every theme and both modes", async ({ page }) => {
  const errors = await load(page);

  const probes: Probe[] = [];
  for (const mode of ["dark", "light"]) {
    await page.evaluate((mode) => { document.documentElement.dataset.theme = mode; }, mode);
    probes.push(...await probe(page, "[data-trust-gallery]"));
  }
  probes.push(...await probe(page, "[data-theme-matrix]"));

  const scopes = new Set(probes.map((entry) => entry.scope));
  // Two page modes plus five themes x two modes in the matrix.
  expect([...scopes].sort()).toEqual([
    "page:dark", "page:light",
    ...["console", "flow", "station", "surface", "survey"].flatMap((theme) => [`theme-${theme}:dark`, `theme-${theme}:light`]),
  ].sort());
  for (const scope of scopes) {
    const inScope = probes.filter((entry) => entry.scope === scope);
    expect(inScope.map((entry) => entry.state).sort(), `${scope}: states rendered`).toEqual([...STATES].sort());
    for (const entry of inScope) {
      // innerText applies the chip's uppercase transform, so compare case-free.
      expect(entry.label.toLowerCase(), `${scope} ${entry.state}: visible label text`).toBe(LABELS[entry.state].toLowerCase());
      expect(entry.visible, `${scope} ${entry.state}: label has a rendered box`).toBe(true);
      expect(entry.dataState, `${scope} ${entry.state}: data-trust-state`).toBe(entry.state);
      expect(entry.glyphHidden, `${scope} ${entry.state}: glyph is decorative`).toBe("true");
      expect(entry.color, `${scope} ${entry.state}: ink is not the brand`).not.toBe(entry.brand);
      expect(entry.color, `${scope} ${entry.state}: ink is not the action role`).not.toBe(entry.action);
      expect(contrast(entry.color, entry.fill), `${scope} ${entry.state}: label on fill`).toBeGreaterThanOrEqual(4.5);
    }
    // No two states collapse into one color.
    expect(new Set(inScope.map((entry) => entry.color)).size, `${scope}: distinct inks`).toBe(STATES.length);
  }
  expect(errors).toEqual([]);
});

test("each trust state carries its own non-color cue", async ({ page }) => {
  const errors = await load(page);
  const probes = await probe(page, "[data-trust-gallery]");
  expect(probes.map((entry) => entry.state).sort()).toEqual([...STATES].sort());

  for (const entry of probes) {
    expect(entry.borderStyle, `${entry.state}: line style`).toBe(LINE_STYLES[entry.state]);
    expect(entry.glyph, `${entry.state}: glyph`).toMatch(/^".+"$/);
  }
  // The glyph alone tells every state apart, so a grayscale or color-blind
  // reading never depends on hue.
  expect(new Set(probes.map((entry) => entry.glyph)).size).toBe(STATES.length);
  expect(new Set(probes.map((entry) => `${entry.glyph}|${entry.borderStyle}`)).size).toBe(STATES.length);
  expect(errors).toEqual([]);
});

test("k-trust-state keeps a text label and does not invent a state", async ({ page }) => {
  const errors = await load(page);
  const result = await page.evaluate(async () => {
    const host = document.createElement("div");
    host.innerHTML = [
      '<k-trust-state id="empty-label" state="verified" label="  "></k-trust-state>',
      '<k-trust-state id="custom" state="uncertain" label="Needs refresh" detail="Verification expired 3 days ago"></k-trust-state>',
      '<k-trust-state id="spelled" state="NOT_CHECKED"></k-trust-state>',
      '<k-trust-state id="unknown" state="stale"></k-trust-state>',
      '<k-trust-state id="linked" state="verified"><a href="#evidence">12 source records</a></k-trust-state>',
    ].join("");
    document.querySelector("main")!.append(host);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const read = (id: string) => {
      const root = document.querySelector(`#${id} .trust-state`)!;
      return {
        className: root.className,
        state: root.getAttribute("data-trust-state"),
        label: root.querySelector(".trust-state__label")?.textContent,
        detail: root.querySelector(".trust-state__detail")?.innerHTML ?? null,
      };
    };
    const linked = document.querySelector("#linked")!;
    linked.setAttribute("state", "failed");
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const out = {
      empty: read("empty-label"),
      custom: read("custom"),
      spelled: read("spelled"),
      unknown: read("unknown"),
      linked: read("linked"),
    };
    host.remove();
    return out;
  });

  expect(result.empty).toMatchObject({ state: "verified", label: "Verified", detail: null });
  expect(result.custom).toMatchObject({ state: "uncertain", label: "Needs refresh", detail: "Verification expired 3 days ago" });
  expect(result.spelled).toMatchObject({ state: "not-checked", label: "Not checked" });
  // An unrecognized word shows as itself, with no state class or attribute.
  expect(result.unknown).toEqual({ className: "trust-state", state: null, label: "stale", detail: null });
  // Child content is the detail, and survives a re-render.
  expect(result.linked).toMatchObject({ state: "failed", label: "Failed", detail: '<a href="#evidence">12 source records</a>' });
  expect(errors).toEqual([]);
});

async function load(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/docs/gallery.html");
  await expect(page.locator("[data-theme-matrix] k-trust-state .trust-state").first()).toBeVisible();
  return errors;
}

function contrast(a: string, b: string): number {
  const lum = (value: string) => {
    const [r, g, bl] = (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number).map((c) => {
      const v = c / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
