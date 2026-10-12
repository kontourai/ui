import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { headlandCuts } from "./marks/headland.mjs";
import { productCuts } from "./marks/products.mjs";

// Builds the contour marks (owner decision, 2026-10-12) from their geometry:
// the Headland corporate symbol's three cuts, and the Station, Flow and
// Surface marks, frameless and as badges.
//
//   node scripts/generate-marks.mjs           # print the generated markup as JSON
//   node scripts/generate-marks.mjs --check   # fail when the committed markup differs
//   node scripts/generate-marks.mjs --write   # rewrite the committed markup
//
// The markup is committed in the path modules, as named constants, so the
// package and scripts/check-marks.mjs read it without running this. This is
// its provenance: --check re-derives every constant and compares, so the
// committed paths cannot drift from the construction unnoticed. Run --write
// only for an explicit identity change, then `node scripts/check-marks.mjs
// --write` to regenerate icons/.
//
// The constructions in scripts/marks/ are new parametric geometry (splines,
// distance-field insets, arcs and their exact offsets). Nothing is traced from
// an image.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCT_PATHS = "react/src/product-icon-paths.ts";
const BRAND_PATHS = "react/src/brand-mark-paths.ts";

const symbol = headlandCuts();
const products = productCuts();
// Module -> constant name -> inner markup.
const generated = {
  [PRODUCT_PATHS]: {
    STATION: products.station.frameless,
    FLOW: products.flow.frameless,
    SURFACE: products.surface.frameless,
    STATION_BADGE: products.station.badge,
    FLOW_BADGE: products.flow.badge,
    SURFACE_BADGE: products.surface.badge,
  },
  [BRAND_PATHS]: {
    SYMBOL: symbol.small,
    SYMBOL_LOCKUP: symbol.lockup,
    SYMBOL_HERO: symbol.hero,
  },
};

// Each constant is written as `const NAME =\n  '<markup>';`. Markup never
// contains a single quote, so the literal needs no escaping.
const literal = (name) => new RegExp(`^const ${name} =\\n  '([^'\\n]*)';$`, "m");

const mode = process.argv.includes("--write") ? "write" : process.argv.includes("--check") ? "check" : "print";
if (mode === "print") {
  console.log(JSON.stringify(generated, null, 2));
  process.exit(0);
}

const problems = [];
let written = 0;
for (const [file, constants] of Object.entries(generated)) {
  let source = readFileSync(path.join(root, file), "utf8");
  for (const [name, markup] of Object.entries(constants)) {
    if (markup.includes("'") || markup.includes("\n")) throw new Error(`${name}: generated markup contains a quote or newline.`);
    const match = literal(name).exec(source);
    if (!match) {
      problems.push(`${file}: no \`const ${name} =\` literal to compare; it must read \`const ${name} =\\n  '<markup>';\`.`);
      continue;
    }
    if (match[1] === markup) continue;
    if (mode === "write") {
      source = source.replace(literal(name), () => `const ${name} =\n  '${markup}';`);
      written += 1;
    } else {
      problems.push(`${file}: ${name} differs from the markup its construction in scripts/marks/ generates.`);
    }
  }
  if (mode === "write") writeFileSync(path.join(root, file), source);
}

// The large lockup scales the wordmark's path data numerically
// (scalePathData in brand-mark-paths.ts), which is exact only without arc
// commands: an arc's rotation and flags are not lengths.
const wordmark = /^const WORDMARK =\s*'<g fill="currentColor"><path d="([^"]+)"\/><\/g>';$/m.exec(readFileSync(path.join(root, BRAND_PATHS), "utf8"));
if (!wordmark) problems.push(`${BRAND_PATHS}: could not find the WORDMARK path data.`);
else if (/[Aa]/.test(wordmark[1])) problems.push(`${BRAND_PATHS}: WORDMARK path data has an arc command, so the large lockup cannot scale it numerically.`);

if (problems.length) {
  console.error(`generate-marks ${mode === "write" ? "--write" : "--check"} failed:\n${problems.map((problem) => `  - ${problem}`).join("\n")}`);
  process.exit(1);
}
const count = Object.values(generated).reduce((sum, constants) => sum + Object.keys(constants).length, 0);
console.log(mode === "write"
  ? `Wrote ${written} of ${count} contour-mark constants; run node scripts/check-marks.mjs --write to regenerate icons/.`
  : `Contour-mark provenance check passed: ${count} constants match their construction in scripts/marks/.`);
