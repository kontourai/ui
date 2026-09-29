import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

// Runs check:contrast as a child process against a copy of the repo whose
// tokens/themes.css carries one injected change, so the scoping rules'
// rejection paths keep running (ui#80, ui#81). node_modules is linked.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const THEMES = "tokens/themes.css";
const pristine = readFileSync(path.join(root, THEMES), "utf8");
const work = mkdtempSync(path.join(tmpdir(), "kui-check-contrast-"));
after(() => rmSync(work, { recursive: true, force: true }));

let copies = 0;
function runCheck(themes) {
  const dir = path.join(work, String(copies++));
  for (const entry of ["scripts", "tokens", "contrast", "react/src/trust-states.ts"]) cpSync(path.join(root, entry), path.join(dir, entry), { recursive: true });
  writeFileSync(path.join(dir, THEMES), themes);
  symlinkSync(path.join(root, "node_modules"), path.join(dir, "node_modules"), "dir");
  return spawnSync(process.execPath, [path.join(dir, "scripts/check-contrast.mjs")], { encoding: "utf8" });
}

function replaceOnce(text, from, to) {
  const at = text.indexOf(from);
  assert.notEqual(at, -1, `anchor not found: ${from}`);
  assert.equal(text.indexOf(from, at + 1), -1, `anchor not unique: ${from}`);
  return text.slice(0, at) + to + text.slice(at + from.length);
}
// The survey light block's first declaration, a unique anchor inside it.
const SURVEY_LIGHT = `:where(.theme-survey) [data-theme="light"]`;
const surveyLightBody = (from, to) => {
  const start = pristine.indexOf(SURVEY_LIGHT);
  assert.notEqual(start, -1);
  const end = pristine.indexOf("}", start);
  return pristine.slice(0, start) + replaceOnce(pristine.slice(start, end), from, to) + pristine.slice(end);
};

test("the shipped tokens pass (control)", () => {
  const result = runCheck(pristine);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /contrast check passed/);
});

test("a light block that sets a token the dark reset does not cover fails", () => {
  // A radius set for light mode would leak into a dark island below it.
  const result = runCheck(surveyLightBody("  --k-bg: #f5f4ef;", "  --k-bg: #f5f4ef;\n  --k-radius-md: 2px;"));
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /\.theme-survey's light block sets --k-radius-md, which the dark reset does not cover/);
});

test("a light block that misses a mode token its base block sets fails (ui#81)", () => {
  const result = runCheck(surveyLightBody("  --k-bg: #f5f4ef;\n", ""));
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /\.theme-survey sets --k-bg but its light block does not/);
});

test("a dark-island block that drifts from its base block fails", () => {
  const island = pristine.indexOf(`[data-theme="dark"]:where(.theme-flow *)`);
  assert.notEqual(island, -1);
  const drifted = pristine.slice(0, island) + replaceOnce(pristine.slice(island), "  --k-brand: #3890ae;", "  --k-brand: #3890af;");
  const result = runCheck(drifted);
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /--k-brand is #3890af; the block it mirrors sets #3890ae/);
});

// Brand as text is rated at 4.5:1 on the page, the panel, and the raised panel
// in every theme and mode (ui#77). Each case restores one pre-fix brand value
// (literals pinned here) and must fail on the named pair with its ratio.
test("a brand too light to read as text on the light page fails (survey light)", () => {
  const result = runCheck(surveyLightBody("  --k-brand: #137e6e;", "  --k-brand: #16806f;"));
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /survey:light --k-brand on --k-bg = 4\.38:1 \(needs 4\.5:1/);
});

test("a brand too dark to read as text on the dark raised panel fails (station dark)", () => {
  // Both the base block and its dark-island mirror, so the mirror check stays quiet.
  const restored = pristine.split("  --k-brand: #966aff;").join("  --k-brand: #9364ff;");
  assert.equal(pristine.split("  --k-brand: #966aff;").length, 3);
  const result = runCheck(restored);
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /station:dark --k-brand on --k-panel-raised = 4\.31:1 \(needs 4\.5:1/);
  assert.doesNotMatch(result.stderr, /mirrors/);
});
