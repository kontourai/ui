import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

// Runs check:marks as a child process against a copy of the repo's marks with
// one injected change, so every rejection path keeps running (ui#75).
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const work = mkdtempSync(path.join(tmpdir(), "kui-check-marks-"));
after(() => rmSync(work, { recursive: true, force: true }));

const FRAME = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">';
const PRODUCT_PATHS = "react/src/product-icon-paths.ts";

let copies = 0;
/** Copies the marks, applies `mutate(dir)`, and runs the check there. */
function runCheck(mutate = () => {}, args = []) {
  const dir = path.join(work, String(copies++));
  for (const entry of ["scripts/check-marks.mjs", "icons", PRODUCT_PATHS, "react/src/brand-mark-paths.ts"]) cpSync(path.join(root, entry), path.join(dir, entry), { recursive: true });
  symlinkSync(path.join(root, "node_modules"), path.join(dir, "node_modules"), "dir");
  mutate(dir);
  const result = spawnSync(process.execPath, [path.join(dir, "scripts/check-marks.mjs"), ...args], { encoding: "utf8" });
  return { ...result, dir };
}
/** Replaces the bearing mark's file with `body` inside the product frame. */
const withBearing = (body, frame = FRAME) => (dir) => writeFileSync(path.join(dir, "icons/bearing.svg"), `${frame}${body}</svg>\n`);
const rejects = (result, pattern) => {
  assert.equal(result.status, 1, `expected the check to fail; stdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  assert.match(result.stderr, pattern);
};
const CIRCLE = '<circle cx="12" cy="12" r="8.5"/>';

test("the shipped marks pass, and the count is the pinned 22 product + 3 brand", () => {
  const result = runCheck();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Marks check passed: 25 marks \(22 product, 3 brand\)/);
  // Pinned separately from the path modules the check derives its list from.
  assert.equal(readdirSync(path.join(root, "icons")).length, 25);
});

test("rejects gradients, filters and other effects", () => {
  rejects(runCheck(withBearing(`<linearGradient x1="0" x2="1"><stop/></linearGradient>${CIRCLE}`)), /bearing\.svg: <linearGradient> is not allowed: marks use no filters, gradients/);
  rejects(runCheck(withBearing(`<filter><feGaussianBlur/></filter>${CIRCLE}`)), /bearing\.svg: <filter> is not allowed: marks use no filters/);
  rejects(runCheck(withBearing('<circle cx="12" cy="12" r="8.5" filter="url(#blur)"/>')), /attribute filter on <circle> is not allowed: marks use no filters/);
  rejects(runCheck(withBearing('<circle cx="12" cy="12" r="8.5" opacity="0.5"/>')), /attribute opacity on <circle> is not allowed/);
});

test("rejects scripts, raster embeds, external references and styles", () => {
  rejects(runCheck(withBearing(`<script>fetch("https://example.com")</script>${CIRCLE}`)), /bearing\.svg: not a valid SVG document: unexpected text/);
  rejects(runCheck(withBearing(`<script href="https://example.com/x.js"/>${CIRCLE}`)), /<script> is not allowed: marks carry no scripts/);
  rejects(runCheck(withBearing('<circle cx="12" cy="12" r="8.5" onload="alert(1)"/>')), /attribute onload on <circle> is not allowed: marks carry no scripts/);
  rejects(runCheck(withBearing(`<image href="data:image/png;base64,iVBORw0KGgo="/>${CIRCLE}`)), /<image> is not allowed: marks carry no raster embeds/);
  rejects(runCheck(withBearing(`<use href="https://example.com/sprite.svg#a"/>${CIRCLE}`)), /<use> is not allowed: marks carry no raster embeds or external references/);
  rejects(runCheck(withBearing('<circle cx="12" cy="12" r="8.5" xlink:href="https://example.com"/>')), /attribute xlink:href on <circle> is not allowed: marks carry no raster embeds or external references/);
  rejects(runCheck(withBearing(`<style>@import url("https://example.com/a.css");</style>${CIRCLE}`)), /not a valid SVG document: unexpected text/);
  rejects(runCheck(withBearing('<circle cx="12" cy="12" r="8.5" style="stroke:red"/>')), /attribute style on <circle> is not allowed: marks carry no styles/);
  rejects(runCheck(withBearing(`<text x="2" y="12">K</text>${CIRCLE}`)), /not a valid SVG document: unexpected text/);
  rejects(runCheck(withBearing(`<text x="2" y="12"/>${CIRCLE}`)), /<text> is not allowed: marks carry no live text/);
});

test("rejects any paint other than currentColor or none", () => {
  rejects(runCheck(withBearing('<circle cx="12" cy="12" r="8.5" stroke="#5ce0c6"/>')), /stroke="#5ce0c6" on <circle>: a mark's only paint is currentColor/);
  rejects(runCheck(withBearing('<circle cx="12" cy="12" r="8.5" fill="url(#g)"/>')), /fill="url\(#g\)" on <circle>/);
  // No fill anywhere above the shape: SVG would paint it black.
  rejects(runCheck(withBearing(CIRCLE, FRAME.replace(' fill="none"', ""))), /<circle> inherits no fill, so it would paint black rather than currentColor/);
  rejects(runCheck(withBearing(CIRCLE, FRAME.replace(' stroke="currentColor"', ""))), /<circle> has neither a fill nor a stroke, so it paints nothing/);
});

test("rejects a document that is not a valid, scalable, self-contained SVG", () => {
  rejects(runCheck(withBearing(CIRCLE, FRAME.replace(' viewBox="0 0 24 24"', ""))), /bearing\.svg: the root has no viewBox/);
  rejects(runCheck(withBearing(CIRCLE, FRAME.replace('viewBox="0 0 24 24"', 'viewBox="2 2 20 20"'))), /viewBox "2 2 20 20" must be "0 0 <width> <height>"/);
  rejects(runCheck(withBearing(CIRCLE, FRAME.replace('viewBox="0 0 24 24" width="24"', 'viewBox="0 0 48 24" width="48"'))), /a product mark must be square/);
  rejects(runCheck(withBearing(CIRCLE, FRAME.replace(' xmlns="http://www.w3.org/2000/svg"', ""))), /the root needs xmlns=/);
  rejects(runCheck(withBearing(CIRCLE, FRAME.replace(' width="24"', ' width="100%"'))), /width="100%" must equal the viewBox width \(24\)/);
  rejects(runCheck(withBearing('<path d="M4 4h16">')), /not a valid SVG document: <\/svg> does not close <path>/);
  rejects(runCheck(withBearing(CIRCLE, `<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/hosts">]>${FRAME}`)), /not a valid SVG document: declarations, comments and processing instructions are not allowed/);
  rejects(runCheck(withBearing('<circle cx="12" cy="12" r="8.5" stroke="&#99;urrentColor"/>')), /contains "<" or a character reference/);
  rejects(runCheck((dir) => writeFileSync(path.join(dir, "icons/bearing.svg"), "")), /not a valid SVG document: the file is empty/);
});

test("rejects a mark that draws nothing or exceeds its ceilings", () => {
  rejects(runCheck(withBearing("")), /bearing\.svg: draws nothing/);
  rejects(runCheck(withBearing(CIRCLE.repeat(13))), /13 shapes; the ceiling for a square mark is 12/);
  // 12 shapes is the ceiling itself, and is accepted: only the sync gate objects.
  assert.doesNotMatch(runCheck(withBearing(CIRCLE.repeat(12))).stderr, /shapes; the ceiling/);
  rejects(runCheck(withBearing(`<path d="M1 1${" L2 2".repeat(200)}"/>`)), /bytes; the ceiling for a square mark is 1024/);
});

test("rejects files and path modules that disagree", () => {
  rejects(runCheck(withBearing(CIRCLE)), /bearing\.svg: differs from the markup in the path modules/);
  rejects(runCheck((dir) => rmSync(path.join(dir, "icons/bearing.svg"))), /bearing\.svg: declared in the path modules but missing/);
  rejects(runCheck((dir) => writeFileSync(path.join(dir, "icons/rogue.svg"), `${FRAME}${CIRCLE}</svg>\n`)), /rogue\.svg: no mark of that name is declared/);
  rejects(runCheck((dir) => writeFileSync(path.join(dir, "icons/concept.png"), "")), /concept\.png: only \.svg marks belong in icons/);
});

test("--write regenerates the files from the path modules, and an edit to a path module is gated", () => {
  const edit = (to) => (dir) => {
    const file = path.join(dir, PRODUCT_PATHS);
    const source = readFileSync(file, "utf8");
    const from = '<circle cx="12" cy="12" r="8.5"/><path d="M15 9l-2 4.5L9 15l2-4.5Z"/>';
    assert.equal(source.split(from).length, 2, "bearing's markup anchor must appear once");
    writeFileSync(file, source.replace(from, to));
  };
  const stale = runCheck(edit(CIRCLE));
  rejects(stale, /bearing\.svg: differs from the markup in the path modules/);
  const written = spawnSync(process.execPath, [path.join(stale.dir, "scripts/check-marks.mjs"), "--write"], { encoding: "utf8" });
  assert.equal(written.status, 0, written.stderr);
  assert.equal(readFileSync(path.join(stale.dir, "icons/bearing.svg"), "utf8"), `${FRAME}${CIRCLE}</svg>\n`);
  assert.equal(spawnSync(process.execPath, [path.join(stale.dir, "scripts/check-marks.mjs")], { encoding: "utf8" }).status, 0);

  // A gradient written into the path module reaches the file through --write and is still rejected.
  const gradient = runCheck(edit(`<linearGradient/>${CIRCLE}`), ["--write"]);
  assert.equal(gradient.status, 0, gradient.stderr);
  rejects(spawnSync(process.execPath, [path.join(gradient.dir, "scripts/check-marks.mjs")], { encoding: "utf8" }), /<linearGradient> is not allowed/);
});

test("refuses to pass when no marks are declared", () => {
  const result = runCheck((dir) => {
    writeFileSync(path.join(dir, PRODUCT_PATHS), "export const productIconPaths = {};\n");
    writeFileSync(path.join(dir, "react/src/brand-mark-paths.ts"), "export const BRAND_MARK_HEIGHT = 24;\nexport const brandMarkPaths = {};\n");
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /No marks are declared/);
});
