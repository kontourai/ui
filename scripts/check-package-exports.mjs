import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

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
  ["./contrast types", "contrast/index.d.ts", pkg.exports["./contrast"]?.types],
  ["./contrast import", "contrast/index.js", pkg.exports["./contrast"]?.import],
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
  "dist/elements/elements/src/k-trust-state.js",
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

// TrustState always renders a visible label and names its state in an
// attribute; an override keeps the default label as hidden text; an
// unrecognized word keeps its text and claims no state.
const { TrustState, trustStateFor, trustStates } = await import("@kontourai/ui/react");
const reactIndexExports = await import("@kontourai/ui/react");
assert.equal("trustStatePresentation" in reactIndexExports, false, "trustStatePresentation is internal; do not export it.");
assert.deepEqual([...trustStates], ["unknown", "proposed", "assumed", "verified", "stale", "disputed", "superseded", "rejected", "revoked"]);
const chipParts = (element) => element.props.children[0].props.children.filter(Boolean);
const part = (element, className) => chipParts(element).find((child) => child.props.className === className);
const verified = TrustState({ state: "verified", detail: "12 source records matched" });
assert.equal(verified.type, "span");
assert.equal(verified.props.className, "trust-state trust-state--verified");
assert.equal(verified.props["data-trust-state"], "verified");
assert.equal(part(verified, "trust-state__label").props.children, "Verified");
assert.equal(part(verified, "trust-state__glyph").type, "svg");
assert.equal(part(verified, "trust-state__glyph").props["aria-hidden"], "true");
assert.equal(part(verified, "trust-state__hidden"), undefined);
assert.equal(verified.props.children[1].props.children, "12 source records matched");
assert.equal(TrustState({ state: "verified", detail: 0 }).props.children[1]?.props.children, 0, "detail={0} must render.");
assert.equal(part(TrustState({ state: "unknown", label: " " }), "trust-state__label").props.children, "No evidence");
const overridden = TrustState({ state: "stale", label: "Expired" });
assert.equal(part(overridden, "trust-state__label").props.children, "Expired");
assert.deepEqual(part(overridden, "trust-state__hidden").props.children, [" (", "Needs refresh", ")"]);
assert.equal(part(TrustState({ state: "verified", label: "verified" }), "trust-state__hidden"), undefined, "A case-only override adds no hidden label.");
const unrecognized = TrustState({ state: "pending" });
assert.equal(unrecognized.props.className, "trust-state");
assert.equal(unrecognized.props["data-trust-state"], undefined);
assert.equal(part(unrecognized, "trust-state__label").props.children, "pending");
assert.equal(part(unrecognized, "trust-state__glyph"), undefined, "An unrecognized state renders no glyph box.");
assert.equal(trustStateFor(" Verified "), "verified");
assert.equal(trustStateFor("not checked"), null);

// @kontourai/ui/contrast runs in a browser and a Node server alike, so it may
// import nothing, and its hand-written declarations must cover exactly its
// runtime exports.
const contrastSource = readFile("contrast/index.js");
assert.ok(!/^\s*import\b|\bimport\s*\(|\brequire\s*\(/m.test(contrastSource), "contrast/index.js must stay dependency-free: no import or require.");
const contrast = await import("@kontourai/ui/contrast");
const contrastDeclarations = ts.createSourceFile("contrast/index.d.ts", readFile("contrast/index.d.ts"), ts.ScriptTarget.Latest, true);
const declaredValues = contrastDeclarations.statements.flatMap((node) => {
  const exported = node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
  if (!exported) return [];
  if (ts.isFunctionDeclaration(node)) return [node.name.text];
  if (ts.isVariableStatement(node)) return node.declarationList.declarations.map((declaration) => declaration.name.text);
  return [];
});
assert.deepEqual([...new Set(declaredValues)].sort(), Object.keys(contrast).sort(), "contrast/index.d.ts must declare exactly the runtime exports of contrast/index.js.");
assert.deepEqual(contrast.validateBrandOverride({ base: "flow", overrides: { dark: { "--k-action": "#a8e6d8", "--k-action-contrast": "#ffffff" } } }).violations.map((violation) => violation.kind), ["contrast"]);

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
for (const tag of ["k-badge", "k-panel", "k-status-badge", "k-metric", "k-progress", "k-empty", "k-button", "k-topbar", "k-product-icon", "k-trust-state"]) {
  assert.ok(registry.has(tag), `${tag} should be registered.`);
}

console.log("Kontour UI package export smoke check passed.");

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
