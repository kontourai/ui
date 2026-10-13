import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

// A consumer pays only for the marks it imports. The wordmark is about 6 KB of
// path data and the symbol's large cuts 3-5 KB each, so a bundle that imports
// one primitive must carry no mark, and one that imports a named mark
// (KontourWordmark, StationIcon) must carry only that mark's cuts (ui#121).
// The elements must still self-register. All of it depends on package.json's
// "sideEffects" list, on one module per mark (react/src/marks/), on the named
// components importing their own module rather than the lookup maps, and on no
// unannotated module-level calls; none of that is seen by a type check or a
// unit test, so this bundles the built package the way a consumer's bundler
// would and reads the output. Run after a build.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const name = packageJson.name;

// Ceilings in bytes of minified output, with headroom over what ships, so they
// fail on growth rather than on any change. What ships (esbuild 0.28, ui#121):
// KontourWordmark 6.7 KB, KontourSymbol 1.6 KB, ProductIcon 6.3 KB (every
// product mark and badge: the variant is a runtime prop), StationIcon 1.2 KB,
// the elements entry 48.5 KB (every mark: k-brand-mark and k-product-icon take
// the mark as an attribute). Before ui#121 each named mark bundled every cut,
// about 16.1 KB, and StationIcon bundled every product mark, about 6.5 KB.
const BUDGETS = {
  KontourWordmark: 8 * 1024,
  KontourSymbol: 2.5 * 1024,
  ProductIcon: 7.5 * 1024,
  StationIcon: 2 * 1024,
  elements: 56 * 1024,
};

// The markup of every mark, from the built modules, so it cannot go stale.
// A bundle contains a mark when it contains that markup.
const dist = (file) => import(new URL(`../dist/react/${file}`, import.meta.url).href);
const brandCuts = {
  "kontour-symbol": (await dist("marks/kontour-symbol.js")).SYMBOL,
  "kontour-symbol-lockup": (await dist("marks/kontour-symbol-lockup.js")).SYMBOL_LOCKUP,
  "kontour-symbol-hero": (await dist("marks/kontour-symbol-hero.js")).SYMBOL_HERO,
  "kontour-wordmark": (await dist("marks/kontour-wordmark.js")).WORDMARK,
};
const { productIconPaths, productBadgePaths } = await dist("product-icon-paths.js");
const productMarks = {
  ...productIconPaths,
  ...Object.fromEntries(Object.entries(productBadgePaths).map(([product, inner]) => [`${product}-badge`, inner])),
};
const marks = { ...brandCuts, ...productMarks };
assert.ok(Object.keys(productIconPaths).length > 0 && Object.keys(productBadgePaths).length > 0, "Could not read the product marks from dist/react/product-icon-paths.js.");
for (const [slug, markup] of Object.entries(marks)) {
  assert.ok(typeof markup === "string" && markup.length > 0, `Could not read the markup of ${slug} from dist/react/.`);
  // Presence has to mean that mark: no mark's markup may occur inside another's.
  for (const [other, outer] of Object.entries(marks)) {
    assert.ok(other === slug || !outer.includes(markup), `The markup of ${slug} occurs inside ${other}'s, so this check cannot tell them apart.`);
  }
}

async function bundle(contents) {
  const result = await build({
    stdin: { contents, resolveDir: root, loader: "js" },
    bundle: true,
    minify: true,
    format: "esm",
    write: false,
    external: ["react", "react/jsx-runtime", "react-dom"],
    logLevel: "silent",
  });
  return result.outputFiles[0].text;
}
// The package's own name resolves through its exports map, as it does for a consumer.
const importing = (exported) => bundle(`import { ${exported} } from "${name}/react"; console.log(${exported});`);
const carried = (output) => Object.keys(marks).filter((slug) => output.includes(marks[slug]));
const list = (slugs) => (slugs.length ? slugs.join(", ") : "none");

// Every bundle is checked before failing, so one run names every regression.
const failures = [];

/** Checks that `output` carries exactly the marks in `expected`, naming any extra or missing. */
function assertCarries(label, output, expected) {
  const actual = carried(output);
  const extra = actual.filter((slug) => !expected.includes(slug));
  const missing = expected.filter((slug) => !actual.includes(slug));
  if (extra.length) failures.push(`A bundle that imports only ${label} (${output.length} bytes) also carries ${list(extra)}. It should carry ${list(expected)}: a named mark must import its own module under react/src/marks/, not brandMarkPaths or productIconPaths, and module-level calls must be /* @__PURE__ */.`);
  if (missing.length) failures.push(`A bundle that imports only ${label} does not carry ${list(missing)}; the measurement is not reaching the mark.`);
}

/** Checks that `output` is within its budget. */
function assertBudget(label, key, output) {
  if (output.length > BUDGETS[key]) failures.push(`A bundle that imports only ${label} is ${output.length} bytes, over its ${BUDGETS[key]}-byte budget in scripts/check-tree-shaking.mjs. Find what it newly carries before raising the budget.`);
}

const sizes = {};

// One primitive carries no mark.
const badge = await importing("Badge");
assert.ok(badge.includes("badge"), "The Badge-only bundle does not contain Badge; the measurement is not reaching the package.");
assertCarries("Badge", badge, []);

// Each named brand mark carries only its own cuts. The lockups are composed
// from a symbol cut and the wordmark; the large lockup scales the wordmark at
// load, so it carries the wordmark's markup.
const brandComponents = {
  KontourSymbol: ["kontour-symbol"],
  KontourWordmark: ["kontour-wordmark"],
  KontourLockup: ["kontour-symbol", "kontour-wordmark"],
  KontourSymbolLockup: ["kontour-symbol-lockup"],
  KontourSymbolHero: ["kontour-symbol-hero"],
  KontourLockupLarge: ["kontour-symbol-lockup", "kontour-wordmark"],
};
const react = await import(new URL("../dist/react/index.js", import.meta.url).href);
const exportedBrandMarks = Object.keys(react).filter((key) => /^Kontour[A-Z]/.test(key)).sort();
assert.deepEqual(exportedBrandMarks, Object.keys(brandComponents).sort(), "The named brand marks exported from dist/react/index.js are not the ones this check pins; add the new mark to brandComponents with the cuts it should carry.");
for (const [component, cuts] of Object.entries(brandComponents)) {
  const output = await importing(component);
  assertCarries(component, output, cuts);
  sizes[component] = output.length;
  if (component in BUDGETS) assertBudget(component, component, output);
}

// Each named product icon carries only its own mark, never a badge.
const namedIcons = Object.keys(react).filter((key) => /^[A-Z]\w*Icon$/.test(key) && key !== "ProductIcon");
assert.ok(namedIcons.includes("StationIcon"), "dist/react/index.js no longer exports StationIcon.");
for (const component of namedIcons) {
  const slug = component.slice(0, -"Icon".length).replace(/[A-Z]/g, (letter, at) => `${at ? "-" : ""}${letter.toLowerCase()}`);
  assert.ok(Object.hasOwn(productIconPaths, slug), `${component} is exported, but "${slug}" is not a product mark.`);
  const output = await importing(component);
  assertCarries(component, output, [slug]);
  sizes[component] = output.length;
  if (component in BUDGETS) assertBudget(component, component, output);
}

// ProductIcon takes the product and the variant at runtime, so it carries
// every product mark and badge, and still no brand mark.
const productIcon = await importing("ProductIcon");
assertCarries("ProductIcon", productIcon, Object.keys(productMarks));
assertBudget("ProductIcon", "ProductIcon", productIcon);
sizes.ProductIcon = productIcon.length;

// The elements entry must not shake out what really is a side effect: importing
// it for its effect alone has to register the custom elements, and
// k-brand-mark and k-product-icon draw any mark by attribute, so it carries all.
const elements = await bundle(`import "${name}/elements";`);
for (const tag of ["k-badge", "k-brand-mark", "k-product-icon"]) {
  assert.ok(elements.includes(`"${tag}"`), `A side-effect import of ${name}/elements no longer registers ${tag}; package.json "sideEffects" must list the elements entry.`);
}
assert.ok(elements.includes("customElements.define"), `A side-effect import of ${name}/elements no longer calls customElements.define.`);
assertCarries(`${name}/elements`, elements, Object.keys(marks));
assertBudget(`${name}/elements`, "elements", elements);

if (failures.length) {
  console.error(`Tree-shaking check failed:\n${failures.map((failure) => `  - ${failure}`).join("\n")}`);
  process.exit(1);
}

// Stylesheets are side effects too: a bundler that believed otherwise would drop `import "@kontourai/ui/tokens"`.
const declared = packageJson.sideEffects;
assert.ok(Array.isArray(declared), 'package.json needs a "sideEffects" array.');
assert.ok(declared.includes("**/*.css"), 'package.json "sideEffects" must keep stylesheets ("**/*.css").');

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
const budgeted = (label, bytes, key) => `${label} ${kb(bytes)} (budget ${kb(BUDGETS[key])})`;
console.log(
  `Tree-shaking check passed: Badge alone carries no mark (${badge.length} bytes); ` +
    `${Object.keys(brandComponents).length} named brand marks and ${namedIcons.length} named product icons carry only their own marks; ` +
    `${budgeted("KontourWordmark", sizes.KontourWordmark, "KontourWordmark")}, ${budgeted("KontourSymbol", sizes.KontourSymbol, "KontourSymbol")}, ` +
    `${budgeted("StationIcon", sizes.StationIcon, "StationIcon")}, ${budgeted("ProductIcon", sizes.ProductIcon, "ProductIcon")}, ` +
    `${budgeted(`${name}/elements`, elements.length, "elements")}, which still self-registers.`,
);
