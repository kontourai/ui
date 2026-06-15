import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspace = path.resolve(root, "..");
const pkg = readJson(path.join(root, "package.json"));

assert.equal(pkg.name, "@kontourai/ui", "Package name must stay @kontourai/ui.");
assertNoLegacyScope(JSON.stringify(pkg), "console-kit/package.json");
assert.equal(pkg.private, false, "Package should remain publishable when release policy changes.");
assert.equal(pkg.license, "Apache-2.0", "Public package license metadata must stay explicit.");
assertIncludes(pkg.files, "tokens/", "Package files must include tokens.");
assertIncludes(pkg.files, "react/styles.css", "Package files must include React styles.");
assertIncludes(pkg.files, "elements/", "Package files must include element source/demo assets.");
assertIncludes(pkg.files, "docs/", "Package files must include consumer docs.");

for (const file of [
  "README.md",
  "LICENSE",
  "docs/consumer-guide.md",
  "docs/release-readiness.md",
  "docs/gallery.html",
  "docs/adr/0001-console-kit-token-contract.md",
]) {
  assertFile(path.join(root, file), `Missing readiness artifact: ${file}`);
}

const readme = read(path.join(root, "README.md"));
for (const expected of [
  "@kontourai/ui/tokens",
  "@kontourai/ui/react",
  "@kontourai/ui/elements",
  "theme-console",
  "theme-flow",
  "theme-survey",
  "theme-surface",
  "npm run verify",
]) {
  assertContains(readme, expected, `README must document ${expected}.`);
}
const gallery = read(path.join(root, "docs/gallery.html"));
for (const expected of [
  "../tokens/index.css",
  "../react/styles.css",
  "../dist/elements/elements/src/index.js",
  "../dist/react/Badge.js",
  "theme-console",
  "theme-flow",
  "theme-survey",
  "theme-surface",
  "k-badge",
  "k-topbar",
  "react-badge-mount",
]) {
  assertContains(gallery, expected, `Gallery must include ${expected}.`);
}

if (hasAdopterWorkspace()) {
  assertAdopterContracts();
} else {
  console.log("Skipping adopter contract checks; sibling product repos are not present.");
}
assertNoLegacyScopeInReadinessDocs();
console.log("Console Kit release readiness check passed.");

function hasAdopterWorkspace() {
  return [
    "kontour-console/console-ui/package.json",
    "flow/package.json",
    "survey/package.json",
    "surface/package.json",
  ].every((file) => existsSync(path.join(workspace, file)));
}

function assertAdopterContracts() {
  const consolePkg = readJson(path.join(workspace, "kontour-console/console-ui/package.json"));
  assert.equal(consolePkg.dependencies?.["@kontourai/console-kit"], "^0.1.0");
  assertContains(read(path.join(workspace, "kontour-console/console-ui/index.html")), "class=\"theme-console\"");
  assertContains(read(path.join(workspace, "kontour-console/console-ui/src/main.tsx")), "@kontourai/console-kit/react/styles.css");

  const flowPkg = readJson(path.join(workspace, "flow/package.json"));
  assert.equal(flowPkg.devDependencies?.["@kontourai/console-kit"], "^0.1.0");
  assertContains(JSON.stringify(flowPkg.scripts), "check:console-kit-assets");
  assertContains(read(path.join(workspace, "flow/src/console-ui/index.html")), "class=\"theme-flow\" data-theme=\"light\"");
  assertFile(path.join(workspace, "flow/scripts/sync-console-kit-assets.mjs"), "Flow must keep a Console Kit asset sync script.");

  const surveyPkg = readJson(path.join(workspace, "survey/package.json"));
  assertContains(JSON.stringify(surveyPkg.scripts), "check:review-workbench", "Survey must keep its review workbench validator.");
  assert.equal(surveyPkg.devDependencies?.["@kontourai/console-kit"], "^0.1.0");
  assertContains(JSON.stringify(surveyPkg.scripts), "sync:review-workbench-assets", "Survey package scripts must include sync:review-workbench-assets.");
  assertContains(JSON.stringify(surveyPkg.scripts), "check:review-workbench-assets", "Survey package scripts must include check:review-workbench-assets.");
  assertContains(read(path.join(workspace, "survey/examples/review-workbench/index.html")), "class=\"theme-survey\"", "Survey review workbench must apply theme-survey.");
  assertContains(read(path.join(workspace, "survey/examples/review-workbench/index.html")), "./vendor/console-kit/tokens/index.css", "Survey review workbench must load vendored Console Kit tokens.");
  assertFile(path.join(workspace, "survey/scripts/sync-review-workbench-assets.cjs"), "Survey must keep a review workbench token sync script.");
  assertFile(path.join(workspace, "survey/examples/review-workbench/vendor/console-kit/tokens/index.css"), "Survey must keep vendored token assets.");

  const surfacePkg = readJson(path.join(workspace, "surface/package.json"));
  assertContains(JSON.stringify(surfacePkg.scripts), "check:console-kit-assets");
  assertContains(read(path.join(workspace, "surface/scripts/build-pages-site.mjs")), "class=\"theme-surface\"");
  assertContains(read(path.join(workspace, "surface/scripts/sync-console-kit-assets.mjs")), "@kontourai/console-kit");
}

function readJson(file) {
  return JSON.parse(read(file));
}

function read(file) {
  return readFileSync(file, "utf8");
}

function assertFile(file, message) {
  if (!existsSync(file)) throw new Error(message);
}

function assertContains(content, expected, message) {
  if (!content.includes(expected)) throw new Error(message);
}

function assertIncludes(values, expected, message) {
  if (!Array.isArray(values) || !values.includes(expected)) throw new Error(message);
}

function assertNoLegacyScope(content, label) {
  if (content.includes("@kontour/console-kit")) {
    throw new Error(`${label} must not reference @kontour/console-kit.`);
  }
}

function assertNoLegacyScopeInReadinessDocs() {
  for (const file of [
    "README.md",
    "docs/consumer-guide.md",
    "docs/gallery.html",
    "docs/release-readiness.md",
    ]) {
    assertNoLegacyScope(read(path.join(root, file)), file);
  }
}
