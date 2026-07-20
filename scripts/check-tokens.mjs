import { readFileSync } from "node:fs";
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
