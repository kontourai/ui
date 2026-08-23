import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import selectorParser from "postcss-selector-parser";
import valueParser from "postcss-value-parser";
import ts from "typescript";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");
const sourceFile = (file) => {
  const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (source.parseDiagnostics.length) throw new Error(`Could not parse ${file}: ${source.parseDiagnostics[0].messageText}`);
  return source;
};
const sourceElements = sourceFile("elements/src/index.ts");
const elements = sourceElements.statements.flatMap((node) => {
  if (!ts.isExpressionStatement(node) || !ts.isCallExpression(node.expression)) return [];
  const call = node.expression;
  if (!ts.isIdentifier(call.expression) || call.expression.text !== "defineElement") return [];
  const [tag] = call.arguments;
  return tag && ts.isStringLiteral(tag) && tag.text.startsWith("k-") ? [tag.text] : [];
}).filter((name, index, all) => all.indexOf(name) === index).sort();
const reactSource = sourceFile("react/src/index.ts");
const react = reactSource.statements.flatMap((node) => {
  if (ts.isExportDeclaration(node) && !node.exportClause) throw new Error("Explorer must explicitly handle export-all declarations.");
  if (!ts.isExportDeclaration(node) || !node.exportClause || !ts.isNamedExports(node.exportClause)) return [];
  if (node.isTypeOnly) return [];
  return node.exportClause.elements.filter((item) => !item.isTypeOnly).map((item) => item.name.text);
}).filter((n, i, a) => a.indexOf(n) === i).sort();
const stylesheet = (file) => postcss.parse(read(file), { from: file });
const tokens = (() => {
  const names = new Set();
  stylesheet("tokens/tokens.css").walkDecls((declaration) => {
    if (declaration.prop.startsWith("--k-")) names.add(declaration.prop);
  });
  return [...names].sort();
})();
const themes = (() => {
  const names = new Set();
  stylesheet("tokens/themes.css").walkRules((rule) => {
    selectorParser((selectors) => {
      selectors.walkClasses((className) => {
        if (className.value.startsWith("theme-")) names.add(className.value);
      });
    }).processSync(rule.selector);
  });
  return [...names].sort();
})();
const classesInSelector = (selector) => {
  const names = [];
  selectorParser((selectors) => {
    selectors.walkClasses((className) => names.push(className.value));
  }).processSync(selector);
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
const tokensForStyleClasses = (styleClasses) => {
  const expectedClasses = new Set(styleClasses);
  const unmatchedClasses = new Set(styleClasses);
  const names = new Set();
  stylesheet("react/styles.css").walkRules((rule) => {
    const ruleClasses = classesInSelector(rule.selector);
    if (!ruleClasses.some((className) => expectedClasses.has(className))) return;
    for (const className of ruleClasses) unmatchedClasses.delete(className);
    rule.walkDecls((declaration) => {
      for (const token of tokensInValue(declaration.value)) names.add(token);
    });
  });
  if (unmatchedClasses.size) throw new Error(`Explorer CSS class contract is missing: ${[...unmatchedClasses].join(", ")}`);
  return [...names].sort();
};
const CURATED = new Map([
  ["Badge", { tag: "k-badge", states: ["default"], variants: ["verified", "pending", "blocked"], styleClasses: ["badge", "tone-positive", "tone-caution", "tone-negative", "tone-active", "tone-neutral"], a11y: "Text badge exposes its value." }],
  ["Button", { tag: "k-button", states: ["default", "disabled"], variants: ["primary", "ghost", "positive", "caution", "negative"], styleClasses: ["btn", "btn-primary", "btn-ghost", "btn-positive", "btn-caution", "btn-negative"], a11y: "Native button label and keyboard activation." }],
  ["Checkbox", { tag: "k-checkbox", states: ["checked", "unchecked", "disabled"], variants: ["default"], styleClasses: ["checkbox", "checkbox-field", "checkbox-field__label"], a11y: "Native checkbox label." }],
  ["Input", { tag: "k-input", states: ["default", "invalid", "disabled"], variants: ["default"], styleClasses: ["control", "control--invalid"], a11y: "Visible label provides the native input's accessible name; placeholder remains supplemental." }],
  ["Select", { tag: "k-select", states: ["default", "invalid", "disabled"], variants: ["default"], styleClasses: ["control", "control--invalid", "select", "control--select", "select__chevron"], a11y: "Visible label provides the native select's accessible name and native keyboard contract." }],
  ["Textarea", { tag: "k-textarea", states: ["default", "invalid", "disabled"], variants: ["default"], styleClasses: ["control", "control--invalid", "control--textarea"], a11y: "Visible label provides the native textarea's accessible name; placeholder remains supplemental." }],
  ["Toggle", { tag: "k-toggle", states: ["checked", "unchecked", "disabled"], variants: ["default"], styleClasses: ["toggle", "toggle-field", "toggle-field__label"], a11y: "Labeled native switch supports keyboard interaction." }],
]);
const metadata = (id, kind, playground, detail) => ({ id, kind, name: id.split(":")[1], specification: `${id} documented interactive primitive`, playground, states: detail.states, variants: detail.variants, styleClasses: detail.styleClasses, tokens: tokensForStyleClasses(detail.styleClasses), responsive: "Wraps in the explorer grid without horizontal overflow.", accessibility: detail.a11y });
const exports = [], exclusions = [];
const isContractOrUtility = (name) => {
  const first = name.at(0) ?? "";
  return (first >= "a" && first <= "z") || ["Props", "Status", "Placement", "Item", "Option", "Tone", "Slug"].some((suffix) => name.endsWith(suffix));
};
for (const name of react) { const detail = CURATED.get(name); if (detail) exports.push(metadata(`react:${name}`, "react-primitive", `element:${detail.tag}`, detail)); else exclusions.push({ id: `react:${name}`, owner: "kontourai/ui", reason: isContractOrUtility(name) ? "Public utility or TypeScript contract; no standalone interactive playground." : "React-only primitive requires authored fixture work; tracked for a later curated explorer slice." }); }
const elementEntries = elements.filter((name) => [...CURATED.values()].some((detail) => detail.tag === name)).map((name) => metadata(`element:${name}`, "custom-element", `element:${name}`, [...CURATED.values()].find((detail) => detail.tag === name)));
for (const name of elements.filter((name) => !elementEntries.some((entry) => entry.name === name))) exclusions.push({ id: `element:${name}`, owner: "kontourai/ui", reason: "No truthful default fixture is authored yet; excluded until its interactive states are curated." });
const manifest = { schemaVersion: 3, generatedFrom: ["react/src/index.ts", "elements/src/index.ts", "tokens/tokens.css", "tokens/themes.css"], themes, tokens, exports, elements: elementEntries, exclusions };
const contents = `${JSON.stringify(manifest, null, 2)}\n`;
if (process.argv.includes("--write")) writeFileSync(path.join(root, "docs/explorer-manifest.json"), contents); else process.stdout.write(contents);
