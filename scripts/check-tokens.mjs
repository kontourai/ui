import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";

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
  "--k-action",
  "--k-action-contrast",
  "--k-focus",
  "--k-focus-ring",
  "--k-status-contrast",
];

for (const token of requiredTokens) {
  assertIncludes(tokenFiles["tokens/tokens.css"], token, `Missing base token: ${token}`);
}

for (const theme of [".theme-survey", ".theme-console", ".theme-flow", ".theme-surface", ".theme-station"]) {
  assertIncludes(tokenFiles["tokens/themes.css"], theme, `Missing theme class: ${theme}`);
}

// Interaction roles (ui#72): every scope that sets the brand sets the roles
// beside it, and the roles hold literal values. A role aliased to the brand
// (or a theme that sets only the brand) would let a brand override repaint
// primary actions and focus rings. Primitives read the roles, never the brand,
// for interactive state.
for (const file of ["tokens/tokens.css", "tokens/themes.css"]) {
  for (const block of tokenFiles[file].replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const selector = block[1].trim().replace(/\s+/g, " ");
    const declared = new Map([...block[2].matchAll(/(--k-[a-z0-9-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]));
    if (declared.has("--k-brand")) {
      for (const role of ["--k-action", "--k-focus"]) {
        if (!declared.has(role)) throw new Error(`${file} ${selector}: sets --k-brand but not ${role}.`);
      }
    }
    // The action fill and its text travel together; a scope that sets only the
    // fill inherits an ancestor scope's text color (a nested theme under a
    // different theme or mode) and can fail contrast.
    if (declared.has("--k-action") !== declared.has("--k-action-contrast")) {
      throw new Error(`${file} ${selector}: --k-action and --k-action-contrast must be declared together.`);
    }
    for (const role of ["--k-action", "--k-action-contrast", "--k-focus", "--k-status-contrast"]) {
      if (declared.has(role) && declared.get(role).includes("var(")) {
        throw new Error(`${file} ${selector}: ${role} must hold a literal value, not ${declared.get(role)}.`);
      }
    }
    // Derived tokens (ui#78): a var() token resolves on the element that
    // declares it, so a scope that changes an input must redeclare what is
    // derived from it, or descendants keep the ancestor scope's value.
    if (declared.has("--k-focus") && declared.get("--k-focus-ring") !== "var(--k-focus)") {
      throw new Error(`${file} ${selector}: sets --k-focus, so it must redeclare --k-focus-ring: var(--k-focus).`);
    }
    for (const tone of ["positive", "caution", "negative", "active"]) {
      const soft = `color-mix(in oklab, var(--k-${tone}) 14%, transparent)`;
      if (declared.has(`--k-${tone}`) && declared.get(`--k-${tone}-soft`) !== soft) {
        throw new Error(`${file} ${selector}: sets --k-${tone}, so it must redeclare --k-${tone}-soft: ${soft}.`);
      }
    }
  }
}

// Every theme has a base block and a light block, and the light block covers
// all three placements of the class and data-theme="light" (same element,
// class below the attribute, attribute below the class). The third is
// :where()-wrapped so a theme class on the light element itself outranks it.
const themeSelectors = [...tokenFiles["tokens/themes.css"].replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{[^}]*\}/g)]
  .map((block) => block[1].split(",").map((part) => part.trim().replace(/\s+/g, " ")));
const themeNames = new Set(themeSelectors.flat().flatMap((part) => [...part.matchAll(/\.theme-([a-z0-9-]+)/g)].map((m) => m[1])));
if (themeNames.size < 5) throw new Error(`tokens/themes.css: found ${themeNames.size} themes; expected at least 5.`);
for (const theme of themeNames) {
  if (!themeSelectors.some((list) => list.length === 1 && list[0] === `.theme-${theme}`)) {
    throw new Error(`tokens/themes.css: .theme-${theme} has no base block.`);
  }
  const light = [`[data-theme="light"].theme-${theme}`, `[data-theme="light"] .theme-${theme}`, `:where(.theme-${theme}) [data-theme="light"]`];
  if (!themeSelectors.some((list) => light.every((form) => list.includes(form)))) {
    throw new Error(`tokens/themes.css: .theme-${theme} needs a light block matching ${light.join(", ")}.`);
  }
}

// Interactive state reads the interaction roles, never the brand or the ring
// alias (which does not follow a local --k-focus override). Every rule whose
// selector names an interactive primitive or state is scanned, wherever it
// sits (inside @media or @supports too), including every rule that mentions
// .btn-primary. Accepted gaps: state expressed only through attributes
// ([aria-pressed], [data-selected]) and a custom property that indirectly
// holds the brand are not recognized.
const INTERACTIVE = /\.btn\b|\.btn-primary|\.toggle|\.checkbox|\.control|:focus|:hover|:checked|:active/;
const FORBIDDEN = /--k-brand\b|--k-focus-ring\s*[,)]/;
const interactiveSelectors = new Set();
postcss.parse(tokenFiles["react/styles.css"]).walkRules((rule) => {
  const selector = rule.selector.replace(/\s+/g, " ").trim();
  if (!INTERACTIVE.test(selector)) return;
  rule.selectors.forEach((part) => interactiveSelectors.add(part.trim()));
  rule.walkDecls((decl) => {
    if (FORBIDDEN.test(decl.value)) {
      const where = rule.parent?.type === "atrule" ? ` (inside @${rule.parent.name} ${rule.parent.params})` : "";
      throw new Error(`react/styles.css ${selector}${where}: ${decl.prop}: ${decl.value} must read the --k-action / --k-focus roles, not the brand or the ring alias.`);
    }
  });
});
for (const rule of [".btn-primary", ".btn:hover", ".btn:focus-visible", ".toggle:checked", ".toggle:focus-visible", ".checkbox", ".checkbox:focus-visible", ".control:hover", ".control:focus-visible"]) {
  if (!interactiveSelectors.has(rule)) throw new Error(`react/styles.css has no ${rule} rule; the interactive-role scan would not see it.`);
}
const interactiveRules = interactiveSelectors.size;
if (interactiveRules < 9) throw new Error(`react/styles.css: only ${interactiveRules} interactive selectors scanned.`);

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
  if (!existsSync(fontFile)) throw new Error(`Missing vendored font file: ${path.relative(root, fontFile)}`);
}

for (const license of ["OFL-Fraunces.txt", "OFL-HankenGrotesk.txt", "OFL-IBMPlexMono.txt"]) {
  if (!existsSync(path.join(root, "tokens", "fonts", license))) {
    throw new Error(`Vendored faces must ship their license: tokens/fonts/${license}`);
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
