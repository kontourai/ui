import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestFile = path.join(root, "docs/explorer-manifest.json");
const generated = execFileSync(process.execPath, ["scripts/generate-explorer-manifest.mjs"], { cwd: root, encoding: "utf8" });
assert.equal(readFileSync(manifestFile, "utf8"), generated, "Explorer manifest drifted; run node scripts/generate-explorer-manifest.mjs --write.");
const manifest = JSON.parse(generated);
assert.ok(manifest.exports.length > 0 && manifest.elements.length > 0, "Explorer must cover real React and custom-element public contracts.");
assert.deepEqual(manifest.themes, ["theme-console", "theme-flow", "theme-surface", "theme-survey"], "Explorer must cover every product theme.");
const covered = new Set([...manifest.exports, ...manifest.exclusions].map((entry) => entry.id));
for (const entry of [...manifest.exports, ...manifest.elements]) {
  for (const field of ["specification", "playground", "responsive", "accessibility"])
    assert.ok(typeof entry[field] === "string" && entry[field].trim(), `${entry.id} is missing curated ${field} metadata.`);
  assert.ok(Array.isArray(entry.tokens) && entry.tokens.length && entry.tokens.every((token) => manifest.tokens.includes(token)), `${entry.id} has unresolved token usage.`);
  const target = entry.playground?.split(":")[1];
  assert.ok(target && manifest.elements.some((element) => element.name === target), `${entry.id} playground target is not a public custom element.`);
}
for (const exclusion of manifest.exclusions)
  assert.ok(exclusion.owner && exclusion.reason, `Explorer exclusion ${exclusion.id} needs owner and reason.`);
assert.equal(covered.size, manifest.exports.length + manifest.exclusions.length, "Every React public export must be represented or individually excluded exactly once.");
const gallery = readFileSync(path.join(root, "docs/gallery.html"), "utf8");
assert.ok(gallery.includes("explorer-manifest.json"), "Gallery must render the generated explorer manifest.");
for (const file of ["docs/gallery.html", "docs/explorer-manifest.json"]) {
  const source = readFileSync(path.join(root, file), "utf8");
  assert.ok(!/(#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\b(?:red|blue|green|white|black)\b)/gi.test(source), `${file} must use token styles rather than literal colors.`);
}
console.log(`Explorer check passed: ${manifest.exports.length} interactive React exports, ${manifest.elements.length} elements, ${manifest.tokens.length} concrete tokens.`);
