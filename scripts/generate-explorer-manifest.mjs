import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");
const kebab = (name) => name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
const elements = [...read("elements/src/index.ts").matchAll(/defineElement\("(k-[^"]+)"/g)].map((m) => m[1]).sort();
const reactSource = ts.createSourceFile("react/src/index.ts", read("react/src/index.ts"), ts.ScriptTarget.Latest, true);
const react = reactSource.statements.flatMap((node) => {
  if (ts.isExportDeclaration(node) && !node.exportClause) throw new Error("Explorer must explicitly handle export-all declarations.");
  if (!ts.isExportDeclaration(node) || !node.exportClause || !ts.isNamedExports(node.exportClause)) return [];
  return node.exportClause.elements.map((item) => (item.name ?? item.propertyName).text);
}).filter((n, i, a) => a.indexOf(n) === i).sort();
const tokens = [...new Set([...read("tokens/tokens.css").matchAll(/(--k-[a-z0-9-]+):/g)].map((m) => m[1]))].sort();
const themes = [...new Set([...read("tokens/themes.css").matchAll(/\.theme-([a-z]+)/g)].map((m) => `theme-${m[1]}`))].sort();
const CURATED = new Map([
  ["Badge", { tag: "k-badge", states: ["default"], variants: ["verified", "pending", "blocked"], a11y: "Text badge exposes its value." }],
  ["Button", { tag: "k-button", states: ["default", "disabled"], variants: ["primary", "ghost", "positive", "negative"], a11y: "Native button label and keyboard activation." }],
  ["Checkbox", { tag: "k-checkbox", states: ["checked", "unchecked", "disabled"], variants: ["default"], a11y: "Native checkbox label." }],
  ["Input", { tag: "k-input", states: ["default", "invalid", "disabled"], variants: ["default"], a11y: "Native input label/placeholder." }],
  ["Select", { tag: "k-select", states: ["default", "disabled"], variants: ["default"], a11y: "Native select keyboard contract." }],
  ["Textarea", { tag: "k-textarea", states: ["default", "disabled"], variants: ["default"], a11y: "Native textarea label/placeholder." }],
  ["Toggle", { tag: "k-toggle", states: ["checked", "unchecked", "disabled"], variants: ["default"], a11y: "Labeled switch keyboard contract." }],
]);
const metadata = (id, kind, playground, detail) => ({ id, kind, name: id.split(":")[1], specification: `${id} documented interactive primitive`, playground, states: detail.states, variants: detail.variants, tokens: ["--k-bg", "--k-text", "--k-line", "--k-space-3"], responsive: "Wraps in the explorer grid without horizontal overflow.", accessibility: detail.a11y });
const exports = [], exclusions = [];
for (const name of react) { const detail = CURATED.get(name); if (detail) exports.push(metadata(`react:${name}`, "react-primitive", `element:${detail.tag}`, detail)); else exclusions.push({ id: `react:${name}`, owner: "kontourai/ui", reason: /^[a-z]|Props$|Status$|Placement$|Item$|Option$|Tone$|Slug$/.test(name) ? "Public utility or TypeScript contract; no standalone interactive playground." : "React-only primitive requires authored fixture work; tracked for a later curated explorer slice." }); }
const elementEntries = elements.filter((name) => [...CURATED.values()].some((detail) => detail.tag === name)).map((name) => metadata(`element:${name}`, "custom-element", `element:${name}`, [...CURATED.values()].find((detail) => detail.tag === name)));
for (const name of elements.filter((name) => !elementEntries.some((entry) => entry.name === name))) exclusions.push({ id: `element:${name}`, owner: "kontourai/ui", reason: "No truthful default fixture is authored yet; excluded until its interactive states are curated." });
const manifest = { schemaVersion: 3, generatedFrom: ["react/src/index.ts", "elements/src/index.ts", "tokens/tokens.css", "tokens/themes.css"], themes, tokens, exports, elements: elementEntries, exclusions };
const contents = `${JSON.stringify(manifest, null, 2)}\n`;
if (process.argv.includes("--write")) writeFileSync(path.join(root, "docs/explorer-manifest.json"), contents); else process.stdout.write(contents);
