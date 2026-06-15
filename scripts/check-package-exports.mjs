import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

assertEqual(pkg.name, "@kontourai/ui", "Package name must stay @kontourai/ui.");
assertNoLegacyScope(JSON.stringify(pkg, null, 2), "package.json");

const requiredExports = [
  ["./tokens", "tokens/index.css", pkg.exports["./tokens"]],
  ["./tokens.css", "tokens/tokens.css", pkg.exports["./tokens.css"]],
  ["./themes.css", "tokens/themes.css", pkg.exports["./themes.css"]],
  ["./fonts.css", "tokens/fonts.css", pkg.exports["./fonts.css"]],
  ["./react types", "dist/react/index.d.ts", pkg.exports["./react"]?.types],
  ["./react import", "dist/react/index.js", pkg.exports["./react"]?.import],
  ["./react/styles.css", "react/styles.css", pkg.exports["./react/styles.css"]],
  ["./elements types", "dist/elements/elements/src/index.d.ts", pkg.exports["./elements"]?.types],
  ["./elements import", "dist/elements/elements/src/index.js", pkg.exports["./elements"]?.import],
];

for (const [label, relativePath, exportTarget] of requiredExports) {
  assertEqual(normalizeExportPath(exportTarget), relativePath, `Incorrect package export target: ${label}.`);
  assertFile(relativePath, `Missing package export target: ${label}`);
}

const reactIndex = readFile("dist/react/index.js");
const elementsIndex = readFile("dist/elements/elements/src/index.js");
const elementFiles = [
  "dist/elements/elements/src/k-badge.js",
  "dist/elements/elements/src/k-button.js",
  "dist/elements/elements/src/k-empty.js",
  "dist/elements/elements/src/k-metric.js",
  "dist/elements/elements/src/k-panel.js",
  "dist/elements/elements/src/k-progress.js",
  "dist/elements/elements/src/k-status-badge.js",
  "dist/elements/elements/src/k-topbar.js",
];

assertIncludes(reactIndex, "Badge", "React index should export Badge.");
assertIncludes(reactIndex, "StatusBadge", "React index should export StatusBadge.");
assertIncludes(reactIndex, "ProductIcon", "React index should export ProductIcon.");
assertIncludes(reactIndex, "productIcons", "React index should export the productIcons map.");
assertIncludes(elementsIndex, "k-badge", "Elements index should register k-badge.");
assertIncludes(elementsIndex, "k-topbar", "Elements index should register k-topbar.");
assertNoLegacyScope(reactIndex, "dist/react/index.js");
assertNoLegacyScope(elementsIndex, "dist/elements/elements/src/index.js");

for (const file of elementFiles) {
  const source = readFile(file);
  assertNoLegacyScope(source, file);
  assertExcludes(source, "from \"react", `${file} must not import React.`);
  assertExcludes(source, "from 'react", `${file} must not import React.`);
}

const tones = await import(pathToFileURL(path.join(root, "dist/react/tones.js")));
assert.equal(tones.toneForValue("verified"), "positive");
assert.equal(tones.toneForValue("disconnected"), "negative");
assert.equal(tones.normalizedClassSuffix("In Review"), "in-review");

const { Badge } = await import("@kontourai/ui/react");
const badge = Badge({ value: "verified" });
assert.equal(badge.type, "span");
assert.equal(badge.props.className, "badge tone-positive");
assert.equal(badge.props.children, "verified");

const registry = new Map();
globalThis.HTMLElement = class HTMLElement {};
globalThis.customElements = {
  define(name, constructor) {
    registry.set(name, constructor);
  },
  get(name) {
    return registry.get(name);
  }
};
await import("@kontourai/ui/elements");
for (const tag of ["k-badge", "k-panel", "k-status-badge", "k-metric", "k-progress", "k-empty", "k-button", "k-topbar", "k-product-icon"]) {
  assert.ok(registry.has(tag), `${tag} should be registered.`);
}

console.log("Console Kit package export smoke check passed.");

function readFile(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function assertFile(relativePath, message) {
  if (!existsSync(path.join(root, relativePath))) {
    throw new Error(message);
  }
}

function assertIncludes(content, expected, message) {
  if (!content.includes(expected)) {
    throw new Error(message);
  }
}

function assertExcludes(content, unexpected, message) {
  if (content.includes(unexpected)) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message} Found: ${actual}`);
  }
}

function assertNoLegacyScope(content, label) {
  assertExcludes(content, "@kontour/console-kit", `${label} must not reference @kontour/console-kit.`);
}

function normalizeExportPath(value) {
  return typeof value === "string" ? value.replace(/^\.\//, "") : value;
}
