import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

// The wordmark is about 6 KB of path data. A consumer who imports one
// primitive must not pay for it, and must not lose the elements'
// self-registration to the same optimisation. Both depend on package.json's
// "sideEffects" list and on modules having no module-level calls, neither of
// which a type check or a unit test sees, so this bundles the built package
// the way a consumer's bundler would and reads the output. Run after a build.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

// Signatures taken from the built modules, so they cannot go stale.
const paths = await import(new URL("../dist/react/brand-mark-paths.js", import.meta.url).href);
const signature = (markup) => /\sd="([^"]{24})/.exec(markup)?.[1];
const WORDMARK = signature(paths.brandMarkPaths["kontour-wordmark"].inner);
const SYMBOL = signature(paths.brandMarkPaths["kontour-symbol"].inner);
assert.ok(WORDMARK && SYMBOL && WORDMARK !== SYMBOL, "Could not read path signatures from dist/react/brand-mark-paths.js.");

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
const name = packageJson.name;
const badge = await bundle(`import { Badge } from "${name}/react"; console.log(Badge);`);
assert.ok(badge.includes("badge"), "The Badge-only bundle does not contain Badge; the measurement is not reaching the package.");
assert.ok(!badge.includes(WORDMARK), `A bundle that imports only Badge contains the wordmark outline (${badge.length} bytes). Check package.json "sideEffects" and that react/src/BrandMark.tsx and brand-mark-paths.ts make no module-level calls.`);
assert.ok(!badge.includes(SYMBOL), "A bundle that imports only Badge contains the corporate symbol.");

// The same build must still include a mark that is asked for...
const wordmark = await bundle(`import { KontourWordmark } from "${name}/react"; console.log(KontourWordmark);`);
assert.ok(wordmark.includes(WORDMARK), "A bundle that imports KontourWordmark does not contain the wordmark outline.");

// ...and must not shake out what really is a side effect: importing the
// elements entry for its effect alone has to register the custom elements.
const elements = await bundle(`import "${name}/elements";`);
for (const tag of ["k-badge", "k-brand-mark", "k-product-icon"]) {
  assert.ok(elements.includes(`"${tag}"`), `A side-effect import of ${name}/elements no longer registers ${tag}; package.json "sideEffects" must list the elements entry.`);
}
assert.ok(elements.includes("customElements.define"), `A side-effect import of ${name}/elements no longer calls customElements.define.`);

// Stylesheets are side effects too: a bundler that believed otherwise would drop `import "@kontourai/ui/tokens"`.
const declared = packageJson.sideEffects;
assert.ok(Array.isArray(declared), 'package.json needs a "sideEffects" array.');
assert.ok(declared.includes("**/*.css"), 'package.json "sideEffects" must keep stylesheets ("**/*.css").');

console.log(`Tree-shaking check passed: Badge alone is ${badge.length} bytes without the brand marks; KontourWordmark alone is ${wordmark.length} bytes; ${name}/elements still self-registers.`);
