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

test("rejects attribute values that are not plain, in-frame geometry", () => {
  const circle = (attributes) => withBearing(`<circle cx="12" cy="12" r="8.5" ${attributes}/>`);
  // Values that parse as SVG but draw nothing, or draw something else, while still counting as a painted shape.
  rejects(runCheck(circle('stroke-width="0"')), /stroke-width="0" on <circle> must be a plain number from 1 to 3/);
  rejects(runCheck(circle('stroke-width="0.84"')), /stroke-width="0.84" on <circle> must be a plain number from 1 to 3/);
  rejects(runCheck(circle('stroke-width="12"')), /stroke-width="12" on <circle> must be a plain number from 1 to 3/);
  rejects(runCheck(circle('stroke-width="var(--x)"')), /stroke-width="var\(--x\)" on <circle>: var\(\), url\(\) and data: values are not allowed/);
  rejects(runCheck(circle('stroke-width="1.75px"')), /stroke-width="1.75px" on <circle> must be a plain number/);
  rejects(runCheck(withBearing('<circle cx="12" cy="12" r="0"/>')), /r="0" on <circle> must be a plain number above 0 to 24/);
  rejects(runCheck(withBearing('<circle cx="12" cy="12" r="50%"/>')), /r="50%" on <circle> must be a plain number/);
  rejects(runCheck(withBearing('<circle cx="9999" cy="12" r="8.5"/>')), /cx="9999" on <circle> must be a plain number from 0 to 24/);
  rejects(runCheck(withBearing('<rect x="-40" y="4" width="16" height="16"/>')), /x="-40" on <rect> must be a plain number from 0 to 24/);
  rejects(runCheck(withBearing('<rect x="4" y="4" width="0" height="16"/>')), /width="0" on <rect> must be a plain number above 0/);
  rejects(runCheck(withBearing(`<g transform="translate(9999 9999)">${CIRCLE}</g>`)), /transform="translate\(9999 9999\)": only translate\(x y\) with offsets from 0 to 24/);
  rejects(runCheck(withBearing(`<g transform="scale(0)">${CIRCLE}</g>`)), /transform="scale\(0\)": only translate/);
  rejects(runCheck(withBearing('<path d="M9999 9999h4"/>')), /path data on <path> has a coordinate beyond the frame's extent \(24\)/);
  rejects(runCheck(withBearing('<path d="M4 4h1e9"/>')), /path data on <path> contains characters that are not path commands/);
  rejects(runCheck(withBearing('<polyline points="4,4 9999,12"/>')), /points on <polyline> must be plain numbers within the frame's extent/);
  rejects(runCheck(circle('stroke-linecap="url(#a)"')), /stroke-linecap="url\(#a\)" on <circle>: var\(\), url\(\) and data: values/);
  rejects(runCheck(circle('stroke-linejoin="arcs"')), /stroke-linejoin="arcs" on <circle> must be one of round, miter, bevel/);
  rejects(runCheck(circle('fill-rule="data:x"')), /fill-rule="data:x" on <circle>: var\(\), url\(\) and data: values/);
  // In-range values the marks really use stay accepted: only the sync gate objects to this edited file.
  const accepted = runCheck(withBearing('<circle cx="12" cy="12" r="8.5" stroke-width="2" stroke-linecap="butt"/><rect x="0" y="0" width="24" height="24" rx="0"/>'));
  assert.doesNotMatch(accepted.stderr, /must be|not allowed|beyond/);
  assert.match(accepted.stderr, /differs from the markup in the path modules/);
});

test("rejects a namespace declared below the root", () => {
  // The subtree leaves the SVG namespace: it would count as two shapes and draw nothing.
  rejects(runCheck(withBearing(`<g xmlns="urn:x">${CIRCLE}<path d="M15 9l-2 4.5L9 15l2-4.5Z"/></g>`)), /bearing\.svg: xmlns on <g> is not allowed: only the root declares a namespace/);
  rejects(runCheck(withBearing('<circle xmlns="http://www.w3.org/1999/xhtml" cx="12" cy="12" r="8.5"/>')), /xmlns on <circle> is not allowed/);
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

// Writes `inner` as bearing's markup in the path module and regenerates the
// files, so the sync gate is satisfied and only the markup itself is judged.
function runCheckWithBearingSource(inner) {
  const generated = runCheck((dir) => {
    const file = path.join(dir, PRODUCT_PATHS);
    const source = readFileSync(file, "utf8");
    const from = '<circle cx="12" cy="12" r="8.5"/><path d="M15 9l-2 4.5L9 15l2-4.5Z"/>';
    assert.equal(source.split(from).length, 2, "bearing's markup anchor must appear once");
    writeFileSync(file, source.replace(from, inner));
  }, ["--write"]);
  assert.equal(generated.status, 0, generated.stderr);
  return spawnSync(process.execPath, [path.join(generated.dir, "scripts/check-marks.mjs")], { encoding: "utf8" });
}
const failureLines = (result) => result.stderr.split("\n").filter((line) => line.startsWith("  - "));

test("accepts arcs whose radii or rotation exceed the frame, and compact arc flags", () => {
  // A radius of 30 draws a shallow curve wholly inside the 24-unit frame; the
  // rotation is in degrees; "0116" is the flags 0, 1 and the x coordinate 16.
  for (const d of ["M4 16A30 30 0 0 1 20 16", "M4 16A8 5 45 0 1 20 16", "M4 16a8 8 0 0116 0"]) {
    const result = runCheckWithBearingSource(`<path d="${d}"/>`);
    assert.equal(result.status, 0, `${d}\n${result.stderr}`);
    assert.match(result.stdout, /Marks check passed: 25 marks/);
  }
});

test("a mark that deviates from a passing one by a single property fails on exactly that property", () => {
  const valid = '<path d="M4 16A30 30 0 0 1 20 16"/><circle cx="12" cy="9" r="3"/>';
  assert.equal(runCheckWithBearingSource(valid).status, 0, "the baseline must pass for the deviations to mean anything");
  const deviations = [
    ['<path d="M4 16A30 30 0 0 1 9999 16"/><circle cx="12" cy="9" r="3"/>', /bearing\.svg: path data on <path> has a coordinate beyond the frame's extent \(24\)/],
    ['<path d="M4 16A30 30 0 2 1 20 16"/><circle cx="12" cy="9" r="3"/>', /bearing\.svg: path data on <path> is malformed: an arc flag must be 0 or 1/],
    ['<path d="M4 16A30 30 0 0 1 20"/><circle cx="12" cy="9" r="3"/>', /bearing\.svg: path data on <path> is malformed: "a" needs 7 numbers/],
    ['<path d="M4 16A30 30 0 0 1 20 16"/><circle cx="12" cy="9" r="3" opacity="0.5"/>', /bearing\.svg: attribute opacity on <circle> is not allowed/],
    ['<path d="M4 16A30 30 0 0 1 20 16"/><circle cx="12" cy="9" r="3" stroke="#5ce0c6"/>', /bearing\.svg: stroke="#5ce0c6" on <circle>: a mark's only paint is currentColor/],
    ['<path d="M4 16A30 30 0 0 1 20 16"/><circle cx="12" cy="9" r="3" stroke-width="0.5"/>', /bearing\.svg: stroke-width="0.5" on <circle> must be a plain number from 1 to 3/],
  ];
  for (const [inner, pattern] of deviations) {
    const result = runCheckWithBearingSource(inner);
    rejects(result, pattern);
    assert.equal(failureLines(result).length, 1, `exactly one failure expected for ${inner}:\n${result.stderr}`);
  }
});
