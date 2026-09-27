import { expect, test, type Page } from "@playwright/test";

// Trust states (ui#73) are Surface's TRUST_STATUSES with Surface's display
// names (owner decision, 2026-09-27; check:surface-parity ties the source to
// the published @kontourai/surface). Pinned here, independently of the
// component source, so a state or label dropped from the implementation fails
// instead of shrinking the loop.
const LABELS: Record<string, string> = {
  unknown: "No evidence",
  proposed: "Pending review",
  assumed: "Assumed",
  verified: "Verified",
  stale: "Needs refresh",
  disputed: "Disputed",
  superseded: "Superseded",
  rejected: "Rejected",
  revoked: "Revoked",
};
const STATES = Object.keys(LABELS);
// The line style groups states; the glyph tells states within a group apart.
const LINE_STYLES: Record<string, string> = {
  verified: "solid",
  rejected: "solid",
  proposed: "dashed",
  assumed: "dashed",
  unknown: "dotted",
  stale: "dotted",
  superseded: "dotted",
  revoked: "dotted",
  disputed: "double",
};

type Probe = {
  scope: string;
  state: string;
  dataState: string | null;
  label: string;
  visible: boolean;
  glyph: string | null;
  glyphHidden: string | null;
  borderStyle: string;
  color: string;
  fill: string;
  brand: string;
  action: string;
};

async function probe(page: Page, scopeSelector: string): Promise<Probe[]> {
  return page.locator(scopeSelector).evaluateAll((scopes) => scopes.flatMap((scope) => {
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
      const glyph = host.querySelector("svg.trust-state__glyph");
      if (!root || !chip || !label) throw new Error(`k-trust-state[state=${host.getAttribute("state")}] rendered no chip.`);
      const chipStyle = getComputedStyle(chip);
      const box = (label as HTMLElement).getBoundingClientRect();
      return {
        scope: scope.getAttribute("data-theme-matrix") ?? `page:${document.documentElement.dataset.theme}`,
        state: host.getAttribute("state") ?? "",
        dataState: root.getAttribute("data-trust-state"),
        label: (label as HTMLElement).innerText.trim(),
        visible: box.width > 0 && box.height > 0 && getComputedStyle(label).visibility !== "hidden",
        glyph: glyph?.querySelector("path")?.getAttribute("d") ?? null,
        glyphHidden: glyph?.getAttribute("aria-hidden") ?? null,
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
    expect(inScope.map((entry) => entry.state), `${scope}: states rendered in Surface's order`).toEqual(STATES);
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
  expect(probes.map((entry) => entry.state)).toEqual(STATES);

  for (const entry of probes) {
    expect(entry.borderStyle, `${entry.state}: line style`).toBe(LINE_STYLES[entry.state]);
    expect(entry.glyph, `${entry.state}: glyph path`).toBeTruthy();
  }
  // The glyph alone tells every state apart, so a grayscale or color-blind
  // reading never depends on hue. Assumed in particular never shares
  // verified's line or glyph.
  expect(new Set(probes.map((entry) => entry.glyph)).size).toBe(STATES.length);
  const byState = Object.fromEntries(probes.map((entry) => [entry.state, entry]));
  expect(byState.assumed.borderStyle).not.toBe(byState.verified.borderStyle);
  expect(byState.stale.borderStyle).not.toBe(byState.verified.borderStyle);
  expect(errors).toEqual([]);
});

test("k-trust-state keeps a text label, keeps the state audible, and does not invent a state", async ({ page }) => {
  const errors = await load(page);
  const result = await page.evaluate(async () => {
    const host = document.createElement("div");
    host.id = "trust-fixture";
    host.innerHTML = [
      '<k-trust-state id="empty-label" state="verified" label="  "></k-trust-state>',
      '<k-trust-state id="custom" state="stale" label="Expired" detail="Verification expired 3 days ago"></k-trust-state>',
      '<k-trust-state id="same" state="stale" label="Needs refresh"></k-trust-state>',
      '<k-trust-state id="cased" state=" VERIFIED "></k-trust-state>',
      '<k-trust-state id="unrecognized" state="pending"></k-trust-state>',
      '<k-trust-state id="linked" state="verified"><a href="#evidence">12 source records</a></k-trust-state>',
    ].join("");
    document.querySelector("main")!.append(host);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    document.querySelector("#linked")!.setAttribute("state", "rejected");
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const read = (id: string) => {
      const root = document.querySelector(`#${id} .trust-state`)!;
      const hidden = root.querySelector(".trust-state__hidden");
      return {
        className: root.className,
        state: root.getAttribute("data-trust-state"),
        label: root.querySelector(".trust-state__label")?.textContent,
        hidden: hidden?.textContent ?? null,
        hiddenWidth: hidden ? hidden.getBoundingClientRect().width : null,
        glyphs: root.querySelectorAll("svg").length,
        detail: root.querySelector(".trust-state__detail")?.innerHTML ?? null,
      };
    };
    return {
      empty: read("empty-label"),
      custom: read("custom"),
      same: read("same"),
      cased: read("cased"),
      unrecognized: read("unrecognized"),
      linked: read("linked"),
    };
  });

  expect(result.empty).toMatchObject({ state: "verified", label: "Verified", hidden: null, detail: null });
  // An override keeps Surface's label for assistive tech, visually hidden.
  expect(result.custom).toMatchObject({ state: "stale", label: "Expired", hidden: " (Needs refresh)", detail: "Verification expired 3 days ago" });
  expect(result.custom.hiddenWidth).toBeLessThanOrEqual(1);
  expect(result.same).toMatchObject({ label: "Needs refresh", hidden: null });
  expect(result.cased).toMatchObject({ state: "verified", label: "Verified" });
  // An unrecognized word shows as itself: no state class, attribute, or glyph box.
  expect(result.unrecognized).toMatchObject({ className: "trust-state", state: null, label: "pending", hidden: null, glyphs: 0 });
  // Child content is the detail, and survives a re-render.
  expect(result.linked).toMatchObject({ state: "rejected", label: "Rejected", detail: '<a href="#evidence">12 source records</a>' });
  // The accessible text carries the default label; the glyph is not announced.
  expect(await page.locator("#custom").ariaSnapshot()).toContain("Expired (Needs refresh)");
  expect(errors).toEqual([]);
});

test("k-trust-state keeps parser-created child detail inside the chip", async ({ page }) => {
  const errors = await load(page);
  // document.write after load reopens the document in the same window, so the
  // element is already defined when the parser creates it and its children:
  // the path where connectedCallback runs before the children exist.
  const result = await page.evaluate(async () => {
    const defined = Boolean(customElements.get("k-trust-state"));
    document.open();
    document.write('<!doctype html><body><k-trust-state id="parsed" state="verified"><a href="#evidence">12 source records</a></k-trust-state></body>');
    document.close();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const host = document.querySelector("#parsed")!;
    const first = { children: host.children.length, detail: host.querySelector(".trust-state__detail")?.innerHTML ?? null };
    host.setAttribute("state", "stale");
    await new Promise((resolve) => setTimeout(resolve, 0));
    return {
      defined,
      upgraded: host instanceof customElements.get("k-trust-state")!,
      first,
      after: {
        children: host.children.length,
        state: host.querySelector(".trust-state")?.getAttribute("data-trust-state"),
        detail: host.querySelector(".trust-state__detail")?.innerHTML ?? null,
      },
    };
  });
  expect(result.defined).toBe(true);
  expect(result.upgraded).toBe(true);
  expect(result.first).toEqual({ children: 1, detail: '<a href="#evidence">12 source records</a>' });
  expect(result.after).toEqual({ children: 1, state: "stale", detail: '<a href="#evidence">12 source records</a>' });
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
