import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tokenFiles = {
  "tokens/index.css": read("tokens/index.css"),
  "tokens/tokens.css": read("tokens/tokens.css"),
  "tokens/themes.css": read("tokens/themes.css"),
  "tokens/fonts.css": read("tokens/fonts.css"),
  "react/styles.css": read("react/styles.css"),
};

const requiredTokens = [
  "--k-bg",
  "--k-panel",
  "--k-panel-raised",
  "--k-text",
  "--k-text-muted",
  "--k-line",
  "--k-brand",
  "--k-positive",
  "--k-caution",
  "--k-negative",
  "--k-active",
  "--k-radius-sm",
  "--k-radius-md",
  "--k-radius-control",
  "--k-radius-overlay",
  "--k-elevation-overlay",
  "--k-font-ui",
];

for (const token of requiredTokens) {
  assertIncludes(tokenFiles["tokens/tokens.css"], token, `Missing base token: ${token}`);
}

for (const theme of [".theme-survey", ".theme-console", ".theme-flow", ".theme-surface"]) {
  assertIncludes(tokenFiles["tokens/themes.css"], theme, `Missing theme class: ${theme}`);
}

assertIncludes(tokenFiles["tokens/index.css"], "@import \"./tokens.css\";", "Token entrypoint must import base tokens.");
assertIncludes(tokenFiles["tokens/index.css"], "@import \"./themes.css\";", "Token entrypoint must import themes.");
assertIncludes(
  tokenFiles["tokens/index.css"],
  "@import \"./fonts.css\";",
  "Token entrypoint must import the brand faces, or consumers silently render fallbacks (ui#50).",
);

// The brand faces must be self-hosted: a consumer with `default-src 'self'` cannot reach a
// remote font host, and gets no error when the request is blocked (ui#50).
assertExcludes(
  tokenFiles["tokens/fonts.css"],
  "@import url(",
  "tokens/fonts.css must declare self-hosted @font-face rules, not import a remote stylesheet.",
);
if (/https?:\/\//.test(tokenFiles["tokens/fonts.css"])) {
  throw new Error("tokens/fonts.css must not reference a remote origin.");
}

const fontFaceFamilies = [...tokenFiles["tokens/fonts.css"].matchAll(/font-family:\s*"([^"]+)"/g)].map(
  (match) => match[1],
);
for (const family of ["Fraunces", "Hanken Grotesk", "IBM Plex Mono"]) {
  if (!fontFaceFamilies.includes(family)) {
    throw new Error(`tokens/fonts.css must declare an @font-face for ${family}.`);
  }
  assertIncludes(tokenFiles["tokens/tokens.css"], `"${family}"`, `Base tokens must still reference ${family}.`);
}

const fontFaceBlocks = tokenFiles["tokens/fonts.css"].match(/@font-face\s*\{[^}]*\}/g) ?? [];
if (fontFaceBlocks.length === 0) {
  throw new Error("tokens/fonts.css must declare at least one @font-face rule.");
}
for (const block of fontFaceBlocks) {
  assertIncludes(block, "font-display: swap;", "Every @font-face must set font-display: swap.");
  assertIncludes(block, "unicode-range:", "Every @font-face must declare its unicode-range.");
  const src = /url\("([^"]+)"\)/.exec(block);
  if (!src) throw new Error("Every @font-face must reference a vendored woff2 file.");
  if (!src[1].endsWith(".woff2")) throw new Error(`Vendored faces must be woff2: ${src[1]}`);
  const fontFile = path.join(root, "tokens", src[1]);
  if (!existsSync(fontFile)) throw new Error(`Missing vendored font file: tokens/${src[1]}`);
}

for (const license of ["OFL-Fraunces.txt", "OFL-HankenGrotesk.txt", "OFL-IBMPlexMono.txt"]) {
  if (!existsSync(path.join(root, "tokens", "fonts", license))) {
    throw new Error(`Vendored faces must ship their licence: tokens/fonts/${license}`);
  }
}

const reactColors = tokenFiles["react/styles.css"].match(/#[0-9a-fA-F]{3,8}|rgba?\(/g) ?? [];
if (reactColors.length > 0) {
  throw new Error(`React styles must stay token-only; found literal colors: ${reactColors.join(", ")}`);
}

for (const [file, content] of Object.entries(tokenFiles)) {
  assertExcludes(content, "@kontour/console-kit", `${file} must not reference @kontour/console-kit.`);
}

console.log("Kontour UI token smoke check passed.");

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
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
