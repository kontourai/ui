import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

// Renders every mark in icons/ to one PNG contact sheet for review: light and
// dark, on the page (--k-bg) and panel (--k-panel) surfaces, at 16, 24, 32 and
// 64px high. One CSS pixel is one image pixel, so the small sizes are what a
// standard-density screen shows. Colours come from the shipped tokens.
//
//   node scripts/render-marks-sheet.mjs <output.png>
//
// A review aid, not a gate: nothing in `npm run verify` runs it.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = process.argv[2];
if (!output) throw new Error("Usage: node scripts/render-marks-sheet.mjs <output.png>");

const SIZES = [16, 24, 32, 64];
const marks = readdirSync(path.join(root, "icons")).filter((name) => name.endsWith(".svg")).sort().map((name) => {
  const svg = readFileSync(path.join(root, "icons", name), "utf8");
  const [, width, height] = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
  return { slug: name.slice(0, -4), svg, aspect: Number(width) / Number(height) };
});
// Corporate marks first, then product marks; wide marks get a full-width row.
const brand = marks.filter((mark) => mark.slug.startsWith("kontour-"));
const product = marks.filter((mark) => !mark.slug.startsWith("kontour-"));

const sized = (mark, size) => mark.svg.replace(/ width="[\d.]+" height="[\d.]+"/, ` width="${Math.round(size * mark.aspect * 100) / 100}" height="${size}"`);
const strip = (mark, surface) => `<div class="strip ${surface}">${SIZES.map((size) => `<span class="cell">${sized(mark, size)}</span>`).join("")}</div>`;
const row = (mark) => `<div class="mark${mark.aspect > 1 ? " wide" : ""}"><span class="name">${mark.slug}</span>${strip(mark, "bg")}${strip(mark, "panel")}</div>`;
const block = (mode) => `<section data-theme="${mode}"><h2>${mode} · sizes ${SIZES.join(" / ")} px · left on --k-bg, right on --k-panel</h2><div class="marks">${[...brand, ...product].map(row).join("")}</div></section>`;

const html = `<!doctype html><html data-theme="dark"><head><meta charset="utf-8">
<link rel="stylesheet" href="${pathToFileURL(path.join(root, "tokens/index.css")).href}">
<style>
  body { margin: 0; font: 12px/1.2 var(--k-font-mono); }
  section { background: var(--k-bg); color: var(--k-text); padding: 20px 24px 28px; }
  h2 { margin: 0 0 14px; font: inherit; color: var(--k-text-muted); }
  .marks { display: grid; grid-template-columns: repeat(3, max-content); gap: 10px 28px; }
  .mark { display: grid; grid-template-columns: 96px max-content max-content; align-items: center; gap: 10px; }
  .mark.wide { grid-column: 1 / -1; grid-template-columns: 96px max-content; }
  .mark.wide .name { grid-row: span 2; }
  .mark.wide .strip.panel { grid-column: 2; }
  .name { color: var(--k-text-muted); }
  .strip { display: flex; align-items: center; gap: 14px; padding: 8px 12px; border: 1px solid var(--k-line); }
  .strip.bg { background: var(--k-bg); }
  .strip.panel { background: var(--k-panel); }
  .cell { display: inline-flex; }
  svg { display: block; }
</style></head><body>${block("light")}${block("dark")}</body></html>`;

const work = mkdtempSync(path.join(tmpdir(), "kui-marks-sheet-"));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1720, height: 900 }, deviceScaleFactor: 1 });
  const file = path.join(work, "sheet.html");
  writeFileSync(file, html);
  await page.goto(pathToFileURL(file).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: output, fullPage: true });
  console.log(`Wrote ${marks.length} marks (${brand.length} corporate, ${product.length} product) to ${output}`);
} finally {
  await browser.close();
  rmSync(work, { recursive: true, force: true });
}
