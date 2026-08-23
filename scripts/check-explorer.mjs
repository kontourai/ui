import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import postcss from "postcss";
import selectorParser from "postcss-selector-parser";
import ts from "typescript";
import valueParser from "postcss-value-parser";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestFile = path.join(root, "docs/explorer-manifest.json");
const generated = execFileSync(process.execPath, ["scripts/generate-explorer-manifest.mjs"], { cwd: root, encoding: "utf8" });
assert.equal(readFileSync(manifestFile, "utf8"), generated, "Explorer manifest drifted; run node scripts/generate-explorer-manifest.mjs --write.");
const manifest = JSON.parse(generated);
assert.ok(manifest.exports.length > 0 && manifest.elements.length > 0, "Explorer must cover real React and custom-element public contracts.");
assert.deepEqual(manifest.themes, ["theme-console", "theme-flow", "theme-surface", "theme-survey"], "Explorer must cover every product theme.");
const covered = new Set([...manifest.exports, ...manifest.exclusions].map((entry) => entry.id));
const classesInSelector = (selector) => {
  const names = [];
  selectorParser((selectors) => selectors.walkClasses((className) => names.push(className.value))).processSync(selector);
  return names;
};
const tokensInValue = (value) => {
  const names = new Set();
  valueParser(value).walk((node) => {
    if (node.type !== "function" || node.value !== "var") return;
    const token = node.nodes.find((child) => child.type === "word" && child.value.startsWith("--k-"));
    if (token) names.add(token.value);
  });
  return names;
};
const expectedTokensForStyleClasses = (styleClasses) => {
  const expectedClasses = new Set(styleClasses);
  const unmatchedClasses = new Set(styleClasses);
  const names = new Set();
  postcss.parse(readFileSync(path.join(root, "react/styles.css"), "utf8"), { from: "react/styles.css" }).walkRules((rule) => {
    const ruleClasses = classesInSelector(rule.selector);
    if (!ruleClasses.some((className) => expectedClasses.has(className))) return;
    for (const className of ruleClasses) unmatchedClasses.delete(className);
    rule.walkDecls((declaration) => {
      for (const token of tokensInValue(declaration.value)) names.add(token);
    });
  });
  assert.equal(unmatchedClasses.size, 0, `Explorer references missing CSS classes: ${[...unmatchedClasses].join(", ")}`);
  return [...names].sort();
};
const reactSource = ts.createSourceFile("react/src/index.ts", readFileSync(path.join(root, "react/src/index.ts"), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const reactValueExports = reactSource.statements.flatMap((node) => {
  if (!ts.isExportDeclaration(node) || !node.exportClause || !ts.isNamedExports(node.exportClause) || node.isTypeOnly) return [];
  return node.exportClause.elements.filter((item) => !item.isTypeOnly).map((item) => item.name.text);
}).sort();
const reactTypeExports = reactSource.statements.flatMap((node) => {
  if (!ts.isExportDeclaration(node) || !node.exportClause || !ts.isNamedExports(node.exportClause)) return [];
  return node.isTypeOnly ? node.exportClause.elements.map((item) => item.name.text) : node.exportClause.elements.filter((item) => item.isTypeOnly).map((item) => item.name.text);
}).sort();
const cataloguedReact = [...manifest.exports, ...manifest.exclusions].filter((entry) => entry.id.startsWith("react:")).map((entry) => entry.id.slice("react:".length)).sort();
assert.deepEqual(cataloguedReact, reactValueExports, "Explorer must inventory every runtime React export exactly once.");
for (const typeName of reactTypeExports)
  assert.ok(!covered.has(`react:${typeName}`), `Type-only export react:${typeName} must not be treated as a runtime explorer entry.`);
for (const entry of [...manifest.exports, ...manifest.elements]) {
  for (const field of ["specification", "playground", "responsive", "accessibility"])
    assert.ok(typeof entry[field] === "string" && entry[field].trim(), `${entry.id} is missing curated ${field} metadata.`);
  assert.ok(Array.isArray(entry.styleClasses) && entry.styleClasses.length, `${entry.id} is missing its CSS class contract.`);
  assert.ok(Array.isArray(entry.tokens) && entry.tokens.length && entry.tokens.every((token) => manifest.tokens.includes(token)), `${entry.id} has unresolved token usage.`);
  assert.deepEqual(entry.tokens, expectedTokensForStyleClasses(entry.styleClasses), `${entry.id} must list the complete token contract derived from its CSS classes.`);
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
