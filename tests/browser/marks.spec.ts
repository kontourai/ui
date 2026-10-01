import { readdirSync } from "node:fs";
import nodePath from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { contrastRatio } from "../../contrast/index.js";

// Pixel gates for the production marks (ui#75). The static gates (allowlisted
// markup, currentColor only, ceilings) are scripts/check-marks.mjs; these need
// a renderer.
//
// Each icons/*.svg is loaded the way a favicon or <img> loads it: as a
// standalone document with no page styles. It is drawn to a canvas at each
// size and the alpha channel is read back, so the measurements do not depend
// on the device pixel ratio or the project's viewport.

// Pinned here, not read from the path modules, so a mark cannot leave or join
// the set without this list changing.
const PRODUCT = ["bearing", "cli", "conduit", "console", "datum", "dispatch", "evals", "fieldwork", "flow", "flow-agents", "forage", "hachure", "kit-research", "lookout", "plumb", "relay", "station", "surface", "survey", "traverse", "ui", "veritas"];
const BRAND = ["kontour-lockup-horizontal", "kontour-symbol", "kontour-wordmark"];
// Square marks: the ones that can be a favicon.
const SQUARE = [...PRODUCT, "kontour-symbol"];
const MARKS = [...BRAND, ...PRODUCT].sort();
const SIZES = [16, 24, 32];
const SURFACES = ["light:bg", "light:panel", "dark:bg", "dark:panel"];

// WCAG 1.4.11: a graphical object needs 3:1 against what is behind it.
const MIN_CONTRAST = 3;
// Share of a mark's frame that must be ink at 3:1 or better, and the most ink
// a frame may hold. The shipped marks sit between 0.10 and 0.42 at every size
// and on every surface; a blank or hairline mark falls below the floor, and a
// filled-in blob rises above the ceiling.
const MIN_LEGIBLE_INK = 0.04;
const MAX_INK = 0.6;
// The ink must span at least half the frame in its longer direction (the
// shipped minimum is 0.63): a mark shrunk into a corner is not legible even
// when its pixel count is.
const MIN_SPAN = 0.5;
// Two marks must differ in at least this share of the frame's pixels. The
// closest shipped pair (cli and console) differs in 0.11.
const MIN_DIFFERENCE = 0.03;

interface Raster {
  slug: string;
  size: number;
  width: number;
  height: number;
  /** One alpha byte per pixel, row-major. */
  alpha: number[];
}

test("icons/ holds exactly the pinned marks", () => {
  expect(readdirSync(nodePath.join(import.meta.dirname, "../../icons")).map((name) => name.replace(/\.svg$/, "")).sort()).toEqual(MARKS);
});

test.describe("mark files", () => {
  let rasters: Raster[];
  let documents: { slug: string; parseError: boolean; rootName: string; namespace: string | null; naturalWidth: number; naturalHeight: number; viewBox: string | null }[];
  let colours: Record<string, { ink: string; surface: string }>;

  test.beforeEach(async ({ page }) => {
    const consoleErrors = await loadKitPage(page, "/docs/gallery.html");
    await expect(page.locator("[data-marks-surface]")).toHaveCount(SURFACES.length);
    ({ rasters, documents } = await page.evaluate(async ({ marks, sizes }) => {
      const rasters = [];
      const documents = [];
      for (const slug of marks) {
        const url = `/icons/${slug}.svg`;
        const parsed = new DOMParser().parseFromString(await (await fetch(url)).text(), "image/svg+xml");
        const image = new Image();
        image.src = url;
        await image.decode();
        documents.push({
          slug,
          parseError: Boolean(parsed.querySelector("parsererror")),
          rootName: parsed.documentElement.localName,
          namespace: parsed.documentElement.namespaceURI,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          viewBox: parsed.documentElement.getAttribute("viewBox"),
        });
        const [, , boxWidth, boxHeight] = (parsed.documentElement.getAttribute("viewBox") ?? "0 0 1 1").split(" ").map(Number);
        for (const size of sizes) {
          const canvas = document.createElement("canvas");
          canvas.height = size;
          canvas.width = Math.round((size * boxWidth) / boxHeight);
          const context = canvas.getContext("2d")!;
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
          const alpha = [];
          for (let index = 3; index < data.length; index += 4) alpha.push(data[index]);
          rasters.push({ slug, size, width: canvas.width, height: canvas.height, alpha });
        }
      }
      return { rasters, documents };
    }, { marks: MARKS, sizes: SIZES }));
    // The ink and surface colours the gallery really paints, per mode and surface.
    colours = await page.evaluate((surfaces) => {
      const hex = (value: string) => {
        const channels = /^rgb\((\d+), (\d+), (\d+)\)$/.exec(value);
        if (!channels) throw new Error(`expected an opaque rgb() colour, got ${value}`);
        return `#${channels.slice(1).map((channel) => Number(channel).toString(16).padStart(2, "0")).join("")}`;
      };
      return Object.fromEntries(surfaces.map((id) => {
        const surface = document.querySelector(`[data-marks-surface="${id}"]`);
        const svg = surface?.querySelector("svg");
        if (!surface || !svg) throw new Error(`gallery has no marks on ${id}`);
        return [id, { ink: hex(getComputedStyle(svg).color), surface: hex(getComputedStyle(surface).backgroundColor) }];
      }));
    }, SURFACES);
    expect(consoleErrors).toEqual([]);
  });

  test("each is a standalone SVG image with the intrinsic size of its viewBox", () => {
    expect(documents.map((entry) => entry.slug)).toEqual(MARKS);
    for (const entry of documents) {
      expect(entry.parseError, `${entry.slug} parses as SVG`).toBe(false);
      expect(entry.rootName, entry.slug).toBe("svg");
      expect(entry.namespace, entry.slug).toBe("http://www.w3.org/2000/svg");
      const [, , width, height] = entry.viewBox!.split(" ").map(Number);
      expect(entry.naturalHeight, `${entry.slug} intrinsic height`).toBe(height);
      expect(Math.abs(entry.naturalWidth - width), `${entry.slug} intrinsic width`).toBeLessThanOrEqual(1);
    }
  });

  test("each is legible at 16, 24 and 32px on bg and panel, light and dark", () => {
    expect(rasters).toHaveLength(MARKS.length * SIZES.length);
    expect(Object.keys(colours).sort()).toEqual([...SURFACES].sort());
    for (const [id, { ink, surface }] of Object.entries(colours)) {
      expect(contrastRatio(ink, surface), `mark ink ${ink} on ${id} ${surface}`).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
    for (const raster of rasters) {
      const label = `${raster.slug} at ${raster.size}px`;
      const area = raster.width * raster.height;
      const ink = raster.alpha.reduce((sum, value) => sum + value, 0) / 255 / area;
      expect(ink, `${label}: ink coverage`).toBeLessThanOrEqual(MAX_INK);

      const { spanX, spanY } = span(raster);
      expect(Math.max(spanX, spanY), `${label}: ink spans the frame`).toBeGreaterThanOrEqual(MIN_SPAN);

      for (const [id, pair] of Object.entries(colours)) {
        // A pixel counts when the ink, antialiased onto this surface, still
        // holds 3:1 against it. A hairline stroke never does.
        const legible = raster.alpha.filter((value) => contrastRatio(blend(pair.ink, pair.surface, value / 255), pair.surface) >= MIN_CONTRAST).length / area;
        expect(legible, `${label} on ${id}: share of the frame at ${MIN_CONTRAST}:1 or better`).toBeGreaterThanOrEqual(MIN_LEGIBLE_INK);
      }
    }
  });

  test("no two marks render alike at any size", () => {
    for (const size of SIZES) {
      const atSize = rasters.filter((raster) => raster.size === size);
      for (let first = 0; first < atSize.length; first += 1) {
        for (let second = first + 1; second < atSize.length; second += 1) {
          const a = atSize[first];
          const b = atSize[second];
          // Marks of different widths cannot be mistaken for each other.
          if (a.width !== b.width) continue;
          const differing = a.alpha.filter((value, index) => Math.abs(value - b.alpha[index]) > 64).length / a.alpha.length;
          expect(differing, `${a.slug} and ${b.slug} at ${size}px: share of pixels that differ`).toBeGreaterThanOrEqual(MIN_DIFFERENCE);
        }
      }
    }
  });

  test("every square mark works as a favicon", () => {
    // A favicon is the file alone, at 16px in a tab and 32px on high-density
    // screens: square, self-sized, and still drawn when nothing styles it.
    for (const slug of SQUARE) {
      const entry = documents.find((candidate) => candidate.slug === slug)!;
      expect(entry.naturalWidth, `${slug} is square`).toBe(entry.naturalHeight);
      for (const size of [16, 32]) {
        const raster = rasters.find((candidate) => candidate.slug === slug && candidate.size === size)!;
        const solid = raster.alpha.filter((value) => value >= 128).length / raster.alpha.length;
        expect(solid, `${slug} favicon at ${size}px: solid pixels`).toBeGreaterThanOrEqual(MIN_LEGIBLE_INK);
      }
    }
  });
});

test.describe("corporate marks", () => {
  test("k-brand-mark renders each mark with currentColor paint only", async ({ page }) => {
    const consoleErrors = await loadKitPage(page, "/elements/demo.html");
    await expect(page.getByRole("main")).toContainText("Corporate Marks");

    const expectedWidth = { "kontour-symbol": 24, "kontour-wordmark": 72.24, "kontour-lockup-horizontal": 102.24 } as const;
    for (const [mark, width] of Object.entries(expectedWidth)) {
      const svg = page.locator(`#brand-marks-mount k-brand-mark[mark="${mark}"] svg`);
      await expect(svg).toBeVisible();
      await expect(svg).toHaveAttribute("viewBox", `0 0 ${width} 24`);
      await expect(svg).toHaveClass(new RegExp(`brand-mark-${mark}`));
      const paints = await svg.evaluate((node) => [...node.querySelectorAll("[fill], [stroke]")].flatMap((element) => [element.getAttribute("fill"), element.getAttribute("stroke")]).filter((value) => value !== null));
      expect(paints.length).toBeGreaterThan(0);
      expect(paints.every((paint) => paint === "currentColor" || paint === "none")).toBe(true);
    }
    // size is the height; the width keeps the mark's aspect ratio.
    const lockup = page.locator('#brand-marks-mount k-brand-mark[mark="kontour-lockup-horizontal"] svg');
    await expect(lockup).toHaveAttribute("height", "32");
    await expect(lockup).toHaveAttribute("width", "136.32");

    const labelled = page.locator('#brand-marks-mount k-brand-mark[mark="kontour-symbol"] svg');
    await expect(labelled).toHaveAttribute("role", "img");
    await expect(labelled).toHaveAttribute("aria-label", "Kontour");
    await expect(page.locator('#brand-marks-mount k-brand-mark[mark="kontour-wordmark"] svg')).toHaveAttribute("aria-hidden", "true");
    // The wordmark is outlines: no text node, so no font is needed to draw it.
    expect(await page.locator("#brand-marks-mount k-brand-mark svg text").count()).toBe(0);
    expect(consoleErrors).toEqual([]);
  });

  test("React BrandMark returns the same markup the element renders", async ({ page }) => {
    const consoleErrors = await loadKitPage(page, "/elements/demo.html");
    const results = await page.evaluate(async (marks) => {
      const mod = await import("../dist/react/BrandMark.js");
      return marks.map((mark) => {
        const element = mod.BrandMark({ mark, title: mark, size: 48 });
        const children = Array.isArray(element.props.children) ? element.props.children : [element.props.children];
        const group = children.find((child: { type?: string } | null) => child && child.type === "g");
        const rendered = document.querySelector(`#brand-marks-mount k-brand-mark[mark="${mark}"] svg > g`);
        // Parse React's string the way the element does, so both sides are serialized alike.
        const parsed = document.createElementNS("http://www.w3.org/2000/svg", "g");
        parsed.innerHTML = group?.props?.dangerouslySetInnerHTML?.__html ?? "";
        return {
          mark,
          viewBox: element.props.viewBox,
          height: element.props.height,
          role: element.props.role,
          keyed: mod.brandMarks[mark].displayName,
          sameMarkup: parsed.innerHTML.length > 0 && parsed.innerHTML === rendered?.innerHTML,
        };
      });
    }, BRAND);
    expect(results).toEqual([
      { mark: "kontour-lockup-horizontal", viewBox: "0 0 102.24 24", height: 48, role: "img", keyed: "KontourLockup", sameMarkup: true },
      { mark: "kontour-symbol", viewBox: "0 0 24 24", height: 48, role: "img", keyed: "KontourSymbol", sameMarkup: true },
      { mark: "kontour-wordmark", viewBox: "0 0 72.24 24", height: 48, role: "img", keyed: "KontourWordmark", sameMarkup: true },
    ]);
    expect(consoleErrors).toEqual([]);
  });
});

test("the gallery shows every mark at 16, 24 and 32px in light and dark", async ({ page }) => {
  const consoleErrors = await loadKitPage(page, "/docs/gallery.html");
  await expect(page.locator("[data-marks-surface]")).toHaveCount(SURFACES.length);
  const shown = await page.evaluate(() => [...document.querySelectorAll("[data-marks-surface]")].map((surface) => ({
    id: surface.getAttribute("data-marks-surface"),
    mode: surface.getAttribute("data-theme"),
    marks: [...surface.querySelectorAll("[data-mark]")].map((cell) => ({
      slug: cell.getAttribute("data-mark"),
      heights: [...cell.querySelectorAll("svg")].map((svg) => svg.getBoundingClientRect().height),
    })),
  })));
  expect(shown.map((surface) => surface.id).sort()).toEqual([...SURFACES].sort());
  for (const surface of shown) {
    expect(surface.id!.split(":")[0]).toBe(surface.mode);
    expect(surface.marks.map((mark) => mark.slug).sort(), surface.id!).toEqual(MARKS);
    for (const mark of surface.marks) expect(mark.heights, `${mark.slug} on ${surface.id}`).toEqual(SIZES);
  }
  expect(consoleErrors).toEqual([]);
});

function span(raster: Raster) {
  let minX = raster.width, maxX = -1, minY = raster.height, maxY = -1;
  raster.alpha.forEach((value, index) => {
    if (value < 128) return;
    const x = index % raster.width;
    const y = Math.floor(index / raster.width);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  });
  if (maxX < 0) return { spanX: 0, spanY: 0 };
  return { spanX: (maxX - minX + 1) / raster.width, spanY: (maxY - minY + 1) / raster.height };
}

/** `ink` at `alpha` over `surface`, composited in sRGB as a browser does. */
function blend(ink: string, surface: string, alpha: number) {
  const channel = (hex: string, offset: number) => Number.parseInt(hex.slice(offset, offset + 2), 16);
  return `#${[1, 3, 5].map((offset) => Math.round(channel(ink, offset) * alpha + channel(surface, offset) * (1 - alpha)).toString(16).padStart(2, "0")).join("")}`;
}

async function loadKitPage(page: Page, path: string): Promise<string[]> {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await page.goto(path);
  await expect(page.locator("body")).toBeVisible();
  return consoleErrors;
}
