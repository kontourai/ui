import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

// Runs check:design as a child process against a copy of the repo whose DESIGN.md
// carries one injected edit, so the override-selector check's rejection path keeps
// running (ui#103). The copy holds only what the check reads; node_modules is linked.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DESIGN = "DESIGN.md";
const pristine = readFileSync(path.join(root, DESIGN), "utf8");
const work = mkdtempSync(path.join(tmpdir(), "kui-check-design-"));
after(() => rmSync(work, { recursive: true, force: true }));

let copies = 0;
function runCheck(design) {
  const dir = path.join(work, String(copies++));
  for (const entry of ["scripts", "tokens", "react/styles.css"]) cpSync(path.join(root, entry), path.join(dir, entry), { recursive: true });
  writeFileSync(path.join(dir, DESIGN), design);
  symlinkSync(path.join(root, "node_modules"), path.join(dir, "node_modules"), "dir");
  const result = spawnSync(process.execPath, [path.join(dir, "scripts/generate-design-md.mjs"), "--check"], { encoding: "utf8" });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

// Replaces exactly one occurrence, so an injection whose anchor moved fails here
// instead of silently checking the unmodified document.
function replaceOnce(text, from, to) {
  const at = text.indexOf(from);
  assert.notEqual(at, -1, `anchor not found: ${from}`);
  assert.equal(text.indexOf(from, at + 1), -1, `anchor not unique: ${from}`);
  return text.slice(0, at) + to + text.slice(at + from.length);
}

const ISLAND = '[data-theme="dark"]:where(.theme-<theme> *):where([data-theme="light"] *):where(:not(...))';
const ROOT_ROW = '| `:root` (no theme class) | add `[data-theme="dark"]:where([data-theme="light"] *)` |';

test("the shipped DESIGN.md passes (control)", () => {
  const result = runCheck(pristine);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /white-label overrides name \d+ selectors; all are shipped/);
});

test("rejects a theme selector typo in the Migrating overrides table", () => {
  const typo = ISLAND.replace(":where(.theme-<theme> *)", ":where(.theme-<theme>)");
  const result = runCheck(replaceOnce(pristine, `\`${ISLAND}\``, `\`${typo}\``));
  assert.notEqual(result.status, 0);
  assert.ok(result.stderr.includes(`\`${typo}\` is not a shipped selector`), result.stderr);
});

test("rejects a :root reset typo (light -> ligth)", () => {
  const typo = '[data-theme="dark"]:where([data-theme="ligth"] *)';
  const result = runCheck(replaceOnce(pristine, ROOT_ROW, ROOT_ROW.replace('"light"', '"ligth"')));
  assert.notEqual(result.status, 0);
  assert.ok(result.stderr.includes(`\`${typo}\` is not a shipped selector`), result.stderr);
});

test("rejects a light form without its shipped tail", () => {
  const full = '`[data-theme="light"] .theme-<theme>:where(:not(...))`;';
  const result = runCheck(replaceOnce(pristine, full, '`[data-theme="light"] .theme-<theme>`;'));
  assert.notEqual(result.status, 0);
  assert.ok(result.stderr.includes('`[data-theme="light"] .theme-<theme>` is not a shipped selector'), result.stderr);
});

test('rejects "..." anywhere but a whole :not() argument', () => {
  const elided = ISLAND.replace(":where([data-theme=\"light\"] *)", ":where(...)");
  const result = runCheck(replaceOnce(pristine, `\`${ISLAND}\``, `\`${elided}\``));
  assert.notEqual(result.status, 0);
  assert.ok(result.stderr.includes(`\`${elided}\`: "..." may only elide a whole :not() argument`), result.stderr);
});

test("exempts the Earlier selector column", () => {
  const result = runCheck(replaceOnce(pristine, "| `:where(.theme-<theme>) [data-theme=\"light\"]` |", "| `:where(.theme-<theme>) [data-theme=\"retired\"]` |"));
  assert.equal(result.status, 0, result.stderr);
});

// A tail written out in full is compared exactly; only a literal `:not(...)` elides.
const LIGHT_CELL = '`[data-theme="light"] .theme-<theme>:where(:not(...))`;';
const LIGHT_TAIL = '[data-theme="dark"], [data-theme="light"] [data-theme="dark"] *';
const withLightTail = (tail) => replaceOnce(pristine, LIGHT_CELL, `\`[data-theme="light"] .theme-<theme>:where(:not(${tail}))\`;`);

test("accepts a tail written out exactly as shipped", () => {
  const result = runCheck(withLightTail(LIGHT_TAIL));
  assert.equal(result.status, 0, result.stderr);
});

test("rejects a typo inside a written-out tail", () => {
  const typo = LIGHT_TAIL.replace('"dark"', '"drak"');
  const result = runCheck(withLightTail(typo));
  assert.notEqual(result.status, 0);
  assert.ok(result.stderr.includes(`\`[data-theme="light"] .theme-<theme>:where(:not(${typo}))\` is not a shipped selector`), result.stderr);
});

test("rejects a unicode ellipsis in place of :not(...)", () => {
  const result = runCheck(withLightTail("…"));
  assert.notEqual(result.status, 0);
  assert.ok(result.stderr.includes('`[data-theme="light"] .theme-<theme>:where(:not(…))`'), result.stderr);
});

test("rejects a selector that ships for some themes but not all", () => {
  // Flow's own tail, with the theme name as the placeholder: it ships only for flow.
  const others = ".theme-survey, .theme-console, .theme-surface, .theme-station";
  const cell = '`:where(.theme-<theme>) [data-theme="light"]:where(:not(...))`, copying';
  const flowOnly = `:where(.theme-<theme>) [data-theme="light"]:where(:not(${others}, .theme-<theme> :is(${others}) *))`;
  const result = runCheck(replaceOnce(pristine, cell, `\`${flowOnly}\`, copying`));
  assert.notEqual(result.status, 0);
  assert.ok(result.stderr.includes(`\`${flowOnly}\` is not a shipped selector`), result.stderr);
  assert.match(result.stderr, /missing: :where\(\.theme-survey\) /);
  assert.doesNotMatch(result.stderr, /missing[^\n]*:where\(\.theme-flow\) /);
});

test("rejects a code span that wraps onto the next line", () => {
  const span = '`[data-theme="dark"]:where([data-theme="light"] *)` beside';
  const result = runCheck(replaceOnce(pristine, span, '`[data-theme="dark"]:where(\n  [data-theme="light"] *)` beside'));
  assert.notEqual(result.status, 0);
  assert.ok(result.stderr.includes('a code span wraps onto the next line (odd number of backticks); keep each selector on one line so it is checked: add the dark reset `[data-theme="dark"]:where('), result.stderr);
});

test("rejects a missing section", () => {
  const result = runCheck(replaceOnce(pristine, "\n### White-label overrides\n", "\n### White-label theming\n"));
  assert.notEqual(result.status, 0);
  assert.ok(result.stderr.includes('has no "### White-label overrides" section'), result.stderr);
});

test("rejects a section that names no selectors", () => {
  const result = runCheck(replaceOnce(pristine, "\n### White-label overrides\n", "\n### White-label overrides\n\nSee below.\n\n### White-label theming\n"));
  assert.notEqual(result.status, 0);
  assert.ok(result.stderr.includes('"### White-label overrides" names no selectors'), result.stderr);
});
