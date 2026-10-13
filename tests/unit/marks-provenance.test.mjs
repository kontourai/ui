import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

// The contour marks' path data is committed in the path modules, not built,
// so nothing else can tell whether it still comes from its construction in
// scripts/marks/. Re-derive it and compare, as a child process.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const work = mkdtempSync(path.join(tmpdir(), "kui-marks-provenance-"));
after(() => rmSync(work, { recursive: true, force: true }));
// One module per mark (ui#121).
const MODULES = ["react/src/marks/station.ts", "react/src/marks/kontour-symbol-hero.ts"];

let copies = 0;
/** Copies the generator, its constructions and the path modules, applies `mutate(dir)`, and runs the generator there. */
function run(mutate, args) {
  const dir = path.join(work, String(copies++));
  for (const entry of ["scripts/generate-marks.mjs", "scripts/marks", "react/src/marks"]) cpSync(path.join(root, entry), path.join(dir, entry), { recursive: true });
  mutate(dir);
  return { ...spawnSync(process.execPath, [path.join(dir, "scripts/generate-marks.mjs"), ...args], { encoding: "utf8" }), dir };
}

test("the committed contour-mark markup is what its construction generates", () => {
  const result = spawnSync(process.execPath, [path.join(root, "scripts/generate-marks.mjs"), "--check"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Contour-mark provenance check passed: 9 constants match/);
});

test("--check rejects hand-edited markup and a missing constant; --write restores the construction", () => {
  const file = MODULES[0];
  let original;
  // One coordinate of the Station mark nudged by hand.
  const edited = run((dir) => {
    original = readFileSync(path.join(dir, file), "utf8");
    const match = /^export const STATION =\n {2}'<path stroke-width="1\.25" d="M(\d+\.\d+)/m.exec(original);
    assert.ok(match, "STATION's first coordinate must be found");
    writeFileSync(path.join(dir, file), original.replace(match[0], match[0].replace(match[1], String(Number(match[1]) + 0.01))));
  }, ["--check"]);
  assert.equal(edited.status, 1, edited.stdout);
  assert.match(edited.stderr, /marks\/station\.ts: STATION differs from the markup its construction in scripts\/marks\/ generates/);
  assert.equal(edited.stderr.split("\n").filter((line) => line.startsWith("  - ")).length, 1, edited.stderr);

  const restored = spawnSync(process.execPath, [path.join(edited.dir, "scripts/generate-marks.mjs"), "--write"], { encoding: "utf8" });
  assert.equal(restored.status, 0, restored.stderr);
  assert.match(restored.stdout, /Wrote 1 of 9/);
  assert.equal(readFileSync(path.join(edited.dir, file), "utf8"), original);

  const missing = run((dir) => {
    const brand = path.join(dir, MODULES[1]);
    writeFileSync(brand, readFileSync(brand, "utf8").replace("export const SYMBOL_HERO =", "export const SYMBOL_FINE ="));
  }, ["--check"]);
  assert.equal(missing.status, 1, missing.stdout);
  assert.match(missing.stderr, /marks\/kontour-symbol-hero\.ts: no `export const SYMBOL_HERO =` literal to compare/);
});

test("--check rejects a construction changed without regenerating", () => {
  // Moving one knot of the Headland silhouette changes all three symbol cuts and nothing else.
  const result = run((dir) => {
    const source = path.join(dir, "scripts/marks/headland.mjs");
    const from = "[14.0, 3.1]";
    assert.equal(readFileSync(source, "utf8").split(from).length, 2, "the knot must appear once");
    writeFileSync(source, readFileSync(source, "utf8").replace(from, "[14.0, 3.6]"));
  }, ["--check"]);
  assert.equal(result.status, 1, result.stdout);
  const failed = result.stderr.split("\n").filter((line) => line.startsWith("  - ")).map((line) => / (\w+) differs/.exec(line)?.[1]);
  assert.deepEqual(failed.sort(), ["SYMBOL", "SYMBOL_HERO", "SYMBOL_LOCKUP"]);
});
