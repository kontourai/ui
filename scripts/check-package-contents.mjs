import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const cache = await mkdtemp(path.join(os.tmpdir(), "console-kit-pack-"));

try {
  const { stdout } = await execFileAsync("npm", ["pack", "--dry-run", "--json", "--cache", cache], {
    cwd: root,
    maxBuffer: 1024 * 1024 * 10,
  });

  const packEntries = parsePackJson(stdout);
  if (packEntries.length !== 1) {
    throw new Error(`Expected one npm pack entry, found ${packEntries.length}.`);
  }

  const entry = packEntries[0];
  if (entry.name !== packageJson.name) throw new Error(`Unexpected package name: ${entry.name}`);
  if (entry.version !== packageJson.version) throw new Error(`Unexpected package version: ${entry.version}`);
  if (entry.bundled?.length) throw new Error(`Package must not bundle dependencies: ${entry.bundled.join(", ")}`);

  const files = entry.files.map((file) => file.path).sort();
  const fileSet = new Set(files);

  const requiredFiles = [
    "LICENSE",
    "README.md",
    // Adopters' agents read the design constitution from node_modules/@kontourai/ui/DESIGN.md.
    "DESIGN.md",
    "docs/consumer-guide.md",
    "docs/gallery.html",
    "docs/release-readiness.md",
    "tokens/index.css",
    "tokens/tokens.css",
    "tokens/themes.css",
    "tokens/fonts.css",
    // The self-hosted faces are the fix for ui#50; a tarball without them silently
    // regresses every CSP-restricted consumer back to fallback typography.
    "tokens/fonts/fraunces-latin.woff2",
    "tokens/fonts/fraunces-latin-ext.woff2",
    "tokens/fonts/hanken-grotesk-latin.woff2",
    "tokens/fonts/hanken-grotesk-latin-ext.woff2",
    "tokens/fonts/ibm-plex-mono-400-latin1.woff2",
    "tokens/fonts/ibm-plex-mono-400-latin2.woff2",
    "tokens/fonts/ibm-plex-mono-500-latin1.woff2",
    "tokens/fonts/ibm-plex-mono-500-latin2.woff2",
    "tokens/fonts/ibm-plex-mono-600-latin1.woff2",
    "tokens/fonts/ibm-plex-mono-600-latin2.woff2",
    "tokens/fonts/OFL-Fraunces.txt",
    "tokens/fonts/OFL-HankenGrotesk.txt",
    "tokens/fonts/OFL-IBMPlexMono.txt",
    "react/styles.css",
    "dist/react/index.js",
    "dist/react/index.d.ts",
    "dist/react/ProductIcon.js",
    "dist/react/ProductIcon.d.ts",
    "icons/station.svg",
    "icons/surface.svg",
    "icons/flow.svg",
    "icons/veritas.svg",
    "icons/survey.svg",
    "icons/console.svg",
    "icons/flow-agents.svg",
    "dist/elements/elements/src/index.js",
    "dist/elements/elements/src/index.d.ts",
    // White-label runtimes validate a theme with this before applying it (ui#83).
    "contrast/index.js",
    "contrast/index.d.ts",
    // String-rendering consumers render and style the trust-state chip from these (ui#95).
    "dist/react/trust-states.js",
    "dist/react/trust-states.d.ts",
    "react/trust-state.css",
    "elements/demo.html",
  ];

  for (const requiredFile of requiredFiles) {
    if (!fileSet.has(requiredFile)) throw new Error(`Missing expected package file: ${requiredFile}`);
  }

  const forbiddenPatterns = [
    /^node_modules\//,
    /^test-results\//,
    /^playwright-report\//,
    /^\.npm-pack-cache\//,
    /^scripts\//,
    /^plans\//,
    // Brand reference artwork (e.g. generated concepts) is never a package asset.
    /^docs\/brand\//,
    /^react\/src\//,
    /^tsconfig/,
    /node_modules/,
  ];

  for (const file of files) {
    const forbiddenPattern = forbiddenPatterns.find((pattern) => pattern.test(file));
    if (forbiddenPattern) throw new Error(`Unexpected package file matched ${forbiddenPattern}: ${file}`);
  }

  // @kontourai/surface is a test-only devDependency (the trust-state parity
  // check). A shipped file importing it would make every adopter need Surface.
  for (const field of ["dependencies", "peerDependencies", "optionalDependencies"]) {
    if (packageJson[field]?.["@kontourai/surface"]) throw new Error(`@kontourai/surface must stay a devDependency, not in ${field}.`);
  }
  // from "…", import "…", import("…"), require("…"), and CSS @import.
  const SURFACE_IMPORT = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*|@import\s+(?:url\()?\s*)["']@kontourai\/surface\b/;
  for (const file of files.filter((name) => /\.(?:m?js|d\.ts|ts|tsx|css|html)$/.test(name))) {
    if (SURFACE_IMPORT.test(await readFile(path.join(root, file), "utf8"))) {
      throw new Error(`${file} imports @kontourai/surface; it is a test-only devDependency.`);
    }
  }

  console.log(`Kontour UI package contents check passed: ${files.length} files.`);
} finally {
  await rm(cache, { recursive: true, force: true });
}

function parsePackJson(output) {
  const start = output.indexOf("[");
  const end = output.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Could not find npm pack JSON in output:\n${output}`);
  }
  return JSON.parse(output.slice(start, end + 1));
}
