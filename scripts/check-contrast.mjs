import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import { trustStatesFromSource } from "./trust-states-source.mjs";
// The exported module runtimes validate white-label themes with (ui#83). This
// check rates the shipped themes through the same functions and pairs, so the
// package and a runtime cannot disagree about what passes.
import { BRAND_SLOT_PAIRS, SHIPPED_THEMES, contrastRatio } from "../contrast/index.js";

// WCAG contrast conformance for the kit's own palette, in both themes.
//
// The kit is the one place these values are authored, so it is the one place
// a regression can be caught before every consumer inherits it. Comparable
// products ship a steady stream of pure-contrast fixes (unreadable pills,
// dropdown foregrounds, themed dialogs) — evidence that this class of defect
// accumulates silently when nothing computes it.
//
// AA thresholds: 4.5:1 for text, 3:1 for large text and UI components.
// Pairs are declared, not inferred: an inferred pairing would assert
// combinations no surface renders, and miss the ones that matter.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Token rules are rated below, except the dark-island rules (ui#80): every
// selector in them starts with [data-theme="dark"], and they only repeat
// values set elsewhere (the tokens.css reset repeats :root; a theme's island
// block repeats its base block), so they are checked as mirrors instead.
// Tokens inside an at-rule would apply conditionally, which nothing here
// rates, so they fail.
const failures = [];
const topRules = [];
const norm = (text) => text.replace(/\s+/g, " ").trim();
const declsOf = (rule) => new Map(rule.nodes.filter((node) => node.type === "decl" && node.prop.startsWith("--k-")).map((decl) => [decl.prop, norm(decl.value)]));
for (const file of ["tokens/tokens.css", "tokens/themes.css"]) {
  postcss.parse(readFileSync(path.join(root, file), "utf8"), { from: file }).each((node) => {
    if (node.type === "rule") topRules.push({ file, node, selector: norm(node.selector), selectors: node.selectors.map(norm), decls: declsOf(node) });
    else if (node.type === "atrule") {
      let holdsTokens = false;
      node.walkDecls(/^--k-/, () => { holdsTokens = true; });
      if (holdsTokens) throw new Error(`${file}: tokens inside @${node.name} ${node.params} are not rated; declare them in a top-level rule.`);
    }
  });
}
const isIsland = (rule) => rule.selectors.every((selector) => selector.startsWith('[data-theme="dark"]'));
const css = topRules.filter((rule) => !isIsland(rule)).map((rule) => rule.node.toString()).join("\n");

// Scoping (ui#80, ui#81, ui#84): the nearest data-theme picks the mode and the
// nearest theme class picks the product. The selectors that implement it are
// pinned here from the theme list, so a theme added without its exclusions
// (or a dropped :not()) fails; and a theme's light block must cover every
// mode-dependent token its base block sets.
{
  const top = (selector) => {
    const rule = topRules.find((candidate) => candidate.selector === selector);
    if (!rule) throw new Error(`tokens: no rule with the selector ${selector}.`);
    return rule.decls;
  };
  const same = (label, expected, actual) => {
    for (const [prop, value] of expected) {
      if (actual.get(prop) !== value) failures.push(`${label}: ${prop} is ${actual.get(prop) ?? "not set"}; the block it mirrors sets ${value}.`);
    }
    for (const prop of actual.keys()) if (!expected.has(prop)) failures.push(`${label}: sets ${prop}, which the block it mirrors does not.`);
  };
  // The tokens a mode switch resets: exactly those the light block sets.
  const modeKeys = [...top('[data-theme="light"]').keys()];
  const pick = (decls) => new Map([...decls].filter(([prop]) => modeKeys.includes(prop)));
  const RESET = '[data-theme="dark"]:where([data-theme="light"] *)';
  same(`tokens/tokens.css ${RESET}`, pick(top(":root")), top(RESET));

  const themeNames = [...new Set(topRules.flatMap((rule) => /^\.theme-([a-z0-9-]+)$/.exec(rule.selector)?.slice(1) ?? []))];
  if (themeNames.length < 5) throw new Error(`tokens/themes.css: found ${themeNames.length} theme base blocks; expected at least 5.`);
  const islands = new Set([RESET]);
  for (const theme of themeNames) {
    const others = themeNames.filter((name) => name !== theme).map((name) => `.theme-${name}`).join(", ");
    const nearer = `${others}, .theme-${theme} :is(${others}) *`;
    const lightForms = [
      `[data-theme="light"].theme-${theme}`,
      `[data-theme="light"] .theme-${theme}:where(:not([data-theme="dark"], [data-theme="light"] [data-theme="dark"] *))`,
      `:where(.theme-${theme}) [data-theme="light"]:where(:not(${nearer}))`,
    ];
    const island = `[data-theme="dark"]:where(.theme-${theme} *):where([data-theme="light"] *):where(:not(${nearer}))`;
    const light = topRules.find((rule) => JSON.stringify(rule.selectors) === JSON.stringify(lightForms));
    if (!light) {
      failures.push(`tokens/themes.css: .theme-${theme} needs a light block whose selectors are exactly:\n  ${lightForms.join(",\n  ")}`);
      continue;
    }
    const dark = pick(top(`.theme-${theme}`));
    // A mode-dependent token the base block sets and the light block does not
    // keeps its dark value in light mode (ui#81: survey's dark canvas under
    // light text). The reverse is safe: the tokens.css reset restores the dark
    // default inside a dark island.
    for (const prop of dark.keys()) if (!light.decls.has(prop)) failures.push(`tokens/themes.css .theme-${theme} sets ${prop} but its light block does not, so light mode keeps the dark value.`);
    islands.add(island);
    const islandRule = topRules.find((rule) => rule.selector === island);
    if (!islandRule) failures.push(`tokens/themes.css: .theme-${theme} needs a dark-island block: ${island}`);
    else same(`tokens/themes.css ${island}`, dark, islandRule.decls);
  }
  for (const rule of topRules.filter(isIsland)) {
    if (!islands.has(rule.selector)) failures.push(`${rule.file}: ${rule.selector} is not one of the dark-island blocks this check knows.`);
  }
}

// scope selector -> { token: hex }
const scopes = new Map();
for (const block of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
  const selector = block[1].trim();
  const tokens = {};
  for (const decl of block[2].matchAll(/(--k-[a-z-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    tokens[decl[1]] = decl[2];
  }
  if (Object.keys(tokens).length > 0) {
    const existing = scopes.get(selector) ?? {};
    scopes.set(selector, { ...existing, ...tokens });
  }
}

function oklab(hex) {
  let value = hex.slice(1);
  if (value.length === 3) value = [...value].map((c) => c + c).join("");
  const [r, g, b] = [0, 2, 4].map((offset) => {
    const c = Number.parseInt(value.slice(offset, offset + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function deltaE(a, b) {
  const [x, y] = [oklab(a), oklab(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

// Declared pairs: foreground token, background token, minimum ratio, why.
const PAIRS = [
  ["--k-text", "--k-bg", 4.5, "body text on the page"],
  ["--k-text", "--k-panel", 4.5, "body text on panels"],
  ["--k-text", "--k-panel-raised", 4.5, "body text on raised panels"],
  ["--k-text-muted", "--k-bg", 4.5, "secondary text on the page"],
  ["--k-text-muted", "--k-panel", 4.5, "secondary text on panels"],
  ["--k-brand", "--k-bg", 3.0, "brand accents as UI components"],
  ["--k-positive", "--k-bg", 3.0, "positive status marks"],
  ["--k-caution", "--k-bg", 3.0, "caution status marks"],
  ["--k-negative", "--k-bg", 3.0, "negative status marks"],
  ["--k-active", "--k-bg", 3.0, "active-state marks"],
  ["--k-line", "--k-bg", 1.2, "hairline separation is decorative, not text"],
];

let checked = 0;
for (const [selector, tokens] of scopes) {
  for (const [fg, bg, minimum, why] of PAIRS) {
    if (!(fg in tokens) || !(bg in tokens)) continue;
    checked += 1;
    const ratio = contrastRatio(tokens[fg], tokens[bg]);
    if (ratio < minimum) {
      failures.push(
        `${selector}: ${fg} on ${bg} = ${ratio.toFixed(2)}:1 (needs ${minimum}:1 — ${why})`,
      );
    }
  }
}

// Interaction roles, checked per resolved theme and mode.
//
// A theme block only lists what it changes (.theme-flow sets the brand and the
// roles, nothing else), so the per-block pairs above never see, e.g., the flow
// action against the default panel. Here each (theme, mode) is resolved the way
// the cascade resolves an element carrying both the theme class and
// data-theme: :root, then [data-theme="light"], then .theme-x, then the light
// variant of .theme-x (a later or more specific block wins). Themes are
// discovered from tokens/themes.css, so a new theme is checked without editing
// this file.
// Every token a pair below rates, except --k-line (a translucent rgba()
// hairline, rated only where a scope spells it in hex).
// Trust states (ui#73): Surface's TRUST_STATUSES, pinned here rather than read
// from the source so a state dropped from the tokens and the component
// together still fails.
const TRUST_STATES = ["unknown", "proposed", "assumed", "verified", "stale", "disputed", "superseded", "rejected", "revoked"];
{
  const fromSource = trustStatesFromSource(root);
  if (JSON.stringify(fromSource) !== JSON.stringify(TRUST_STATES)) {
    throw new Error(`${path.basename(fileURLToPath(import.meta.url))}: pinned TRUST_STATES ${JSON.stringify(TRUST_STATES)} differs from trustStates in react/src/trust-states.ts ${JSON.stringify(fromSource)}. Update the pin, and give every state its tokens and chip rule.`);
  }
}
const RATED = new Set([
  "--k-bg", "--k-panel", "--k-panel-raised", "--k-text", "--k-text-muted", "--k-text-faint",
  "--k-brand", "--k-brand-contrast", "--k-action", "--k-action-contrast", "--k-focus", "--k-status-contrast",
  "--k-positive", "--k-caution", "--k-negative", "--k-active",
  ...TRUST_STATES.flatMap((state) => [`--k-trust-${state}`, `--k-trust-${state}-fill`]),
]);
const blocks = [];
for (const block of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^}]*)\}/g)) {
  const selector = block[1].trim();
  const light = /\[data-theme="light"\]/.test(selector);
  const theme = /\.theme-([a-z0-9-]+)/.exec(selector)?.[1] ?? "";
  if (selector !== ":root" && !light && !theme) throw new Error(`Unrecognized token scope: ${selector}`);
  const tokens = {};
  for (const decl of block[2].matchAll(/(--k-[a-z-]+):\s*([^;]+);/g)) {
    const value = decl[2].trim();
    if (/^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/.test(value)) tokens[decl[1]] = value;
    // This check rates hex only. Any other spelling (rgb(), a keyword,
    // 8-digit hex with alpha) on a rated token would be skipped, and the
    // pair would silently rate the inherited value instead.
    else if (RATED.has(decl[1])) failures.push(`${selector}: ${decl[1]}: ${value} is not a 3- or 6-digit hex color; the contrast check cannot rate it.`);
  }
  blocks.push({ theme, light, tokens });
}
const themes = ["", ...new Set(blocks.map((block) => block.theme).filter(Boolean))];
const resolve = (theme, light) => {
  const layers = [
    (block) => !block.theme && !block.light,
    (block) => light && !block.theme && block.light,
    (block) => theme && block.theme === theme && !block.light,
    (block) => theme && light && block.theme === theme && block.light,
  ];
  return Object.assign({}, ...layers.flatMap((layer) => blocks.filter(layer).map((block) => block.tokens)));
};

// SHIPPED_THEMES in the exported module is what a runtime rates an override
// against; it must be exactly what the cascade resolves from the token files.
{
  const shippedName = (theme) => theme || "default";
  const resolvedNames = themes.map(shippedName).sort();
  const exportedNames = Object.keys(SHIPPED_THEMES).sort();
  if (JSON.stringify(resolvedNames) !== JSON.stringify(exportedNames)) {
    failures.push(`contrast/index.js SHIPPED_THEMES covers ${exportedNames.join(", ")}; the token files resolve ${resolvedNames.join(", ")}.`);
  }
  for (const theme of themes) {
    for (const light of [false, true]) {
      const mode = light ? "light" : "dark";
      const exported = SHIPPED_THEMES[shippedName(theme)]?.[mode] ?? {};
      const tokens = resolve(theme, light);
      for (const property of new Set([...Object.keys(exported), "--k-bg", "--k-panel", ...BRAND_SLOT_PAIRS.flatMap((pair) => [pair.foreground, pair.background])])) {
        if (exported[property]?.toLowerCase() !== tokens[property]?.toLowerCase()) {
          failures.push(`contrast/index.js SHIPPED_THEMES.${shippedName(theme)}.${mode}["${property}"] is ${exported[property]}; the token files resolve ${tokens[property]}.`);
        }
      }
    }
  }
}

// Pairs for the roles. Non-text UI (a focus ring, a checked control) needs 3:1
// against what it sits on; text needs 4.5:1.
const STATUS = ["--k-positive", "--k-caution", "--k-negative", "--k-active"];

// The brand-slot pairs come from @kontourai/ui/contrast, and are pinned here as
// literals too: the pin is what makes a weakened threshold in the exported
// module fail this check instead of quietly lowering the bar for both.
const PINNED_BRAND_SLOT_PAIRS = [
  ["--k-action-contrast", "--k-action", 4.5],
  ["--k-action", "--k-panel", 3.0],
  ["--k-focus", "--k-bg", 3.0],
  ["--k-focus", "--k-panel", 3.0],
  ["--k-brand", "--k-panel", 4.5],
  ["--k-brand", "--k-bg", 3.0],
  ["--k-brand-contrast", "--k-brand", 4.5],
];
{
  const exported = BRAND_SLOT_PAIRS.map(({ foreground, background, minimum }) => [foreground, background, minimum]);
  if (JSON.stringify(exported) !== JSON.stringify(PINNED_BRAND_SLOT_PAIRS)) {
    throw new Error(`contrast/index.js BRAND_SLOT_PAIRS ${JSON.stringify(exported)} differs from the pairs this check pins ${JSON.stringify(PINNED_BRAND_SLOT_PAIRS)}. A threshold change is a decision for both: update the pin and the module together.`);
  }
  // Published reference ratios (the extremes, and the two grays either side of
  // AA on white), so a changed formula in the exported module fails here rather
  // than re-rating everything consistently wrong.
  for (const [a, b, expected] of [["#000000", "#ffffff", 21], ["#fff", "#fff", 1], ["#767676", "#ffffff", 4.54], ["#777777", "#ffffff", 4.48]]) {
    const ratio = contrastRatio(a, b);
    if (Math.abs(ratio - expected) > 0.005) throw new Error(`contrastRatio(${a}, ${b}) = ${ratio}; the WCAG definition gives ${expected}.`);
  }
}
const ROLE_PAIRS = [
  ...BRAND_SLOT_PAIRS.map(({ foreground, background, minimum, purpose }) => [foreground, background, minimum, purpose]),
  ...STATUS.map((tone) => ["--k-status-contrast", tone, 4.5, "text on a filled status tone"]),
  // A trust chip carries its own fill, so its label, glyph, and border are rated
  // against that fill; the border's outer edge is rated against the panel.
  ...TRUST_STATES.flatMap((state) => [
    [`--k-trust-${state}`, `--k-trust-${state}-fill`, 4.5, `${state} trust label on its fill`],
    [`--k-trust-${state}`, "--k-panel", 3.0, `${state} trust border and glyph against the panel`],
  ]),
  // The trust-basis line (ui#87) and its caveat underline are muted text; the
  // decoration names no color (checked below), so this pair rates both, in
  // every resolved theme and mode.
  ["--k-text-muted", "--k-panel", 4.5, "trust-basis line and caveat underline on panels"],
  // Text on every surface, per resolved theme and mode: a theme that changes a
  // surface in one mode only (ui#81) is caught here even though no single
  // block holds both colors.
  ["--k-text", "--k-bg", 4.5, "body text on the page"],
  ["--k-text", "--k-panel", 4.5, "body text on panels"],
  ["--k-text", "--k-panel-raised", 4.5, "body text on raised panels"],
  ["--k-text-muted", "--k-bg", 4.5, "secondary text on the page"],
  ["--k-text-muted", "--k-panel-raised", 4.5, "secondary text on raised panels"],
  // Faint text (ui#77) carries timestamps, hints and counts: rated as normal
  // text on every surface rather than exempted as decoration.
  ["--k-text-faint", "--k-bg", 4.5, "faint text on the page"],
  ["--k-text-faint", "--k-panel", 4.5, "faint text on panels"],
  ["--k-text-faint", "--k-panel-raised", 4.5, "faint text on raised panels"],
  // A button's focus ring is offset onto the surface around it (ui#82).
  ["--k-focus", "--k-panel-raised", 3.0, "focus ring on raised panels"],
];

// Shipped values that already fail a role pair. Recorded, not fixed, because
// fixing them changes how the theme renders and needs its own decision. An
// entry that starts passing fails the check too, so a fix removes it here.
const KNOWN_ROLE_FAILURES = new Map([
  ["console:light --k-brand-contrast on --k-brand", "white on the light console lime"],
  ["console:light --k-brand on --k-panel", "light console lime as text"],
  ["flow:dark --k-brand on --k-panel", "dark flow blue as text"],
]);

const seenKnown = new Set();
for (const theme of themes) {
  for (const light of [false, true]) {
    const scope = `${theme || "default"}:${light ? "light" : "dark"}`;
    const tokens = resolve(theme, light);
    for (const [fg, bg, minimum, why] of ROLE_PAIRS) {
      if (!(fg in tokens) || !(bg in tokens)) {
        failures.push(`${scope}: ${fg} or ${bg} does not resolve to a literal color (${why})`);
        continue;
      }
      checked += 1;
      const ratio = contrastRatio(tokens[fg], tokens[bg]);
      const id = `${scope} ${fg} on ${bg}`;
      if (KNOWN_ROLE_FAILURES.has(id)) {
        seenKnown.add(id);
        if (ratio >= minimum) failures.push(`${id} = ${ratio.toFixed(2)}:1 now passes; remove it from KNOWN_ROLE_FAILURES.`);
        continue;
      }
      if (ratio < minimum) failures.push(`${id} = ${ratio.toFixed(2)}:1 (needs ${minimum}:1 — ${why})`);
    }
  }
}
// Trust states must never collapse into one generic confidence color: in each
// resolved theme and mode, no two states share an ink or a fill, and no two
// inks sit closer than TRUST_INK_MIN_DELTA_E in OKLab (distinct values that
// look alike, like two near-identical grays, fail too). The floor is about
// three times OKLab's just-noticeable difference (~0.02).
const TRUST_INK_MIN_DELTA_E = 0.06;
for (const theme of themes) {
  for (const light of [false, true]) {
    const scope = `${theme || "default"}:${light ? "light" : "dark"}`;
    const tokens = resolve(theme, light);
    for (const part of ["", "-fill"]) {
      const seen = new Map();
      for (const state of TRUST_STATES) {
        const value = tokens[`--k-trust-${state}${part}`]?.toLowerCase();
        if (value && seen.has(value)) failures.push(`${scope}: --k-trust-${state}${part} repeats --k-trust-${seen.get(value)}${part} (${value}); each trust state needs its own color.`);
        seen.set(value, state);
      }
    }
    for (const [index, a] of TRUST_STATES.entries()) {
      for (const b of TRUST_STATES.slice(index + 1)) {
        const [inkA, inkB] = [tokens[`--k-trust-${a}`], tokens[`--k-trust-${b}`]];
        if (!inkA || !inkB) continue;
        checked += 1;
        const distance = deltaE(inkA, inkB);
        if (distance < TRUST_INK_MIN_DELTA_E) failures.push(`${scope}: --k-trust-${a} and --k-trust-${b} are ${distance.toFixed(3)} apart in OKLab (needs ${TRUST_INK_MIN_DELTA_E}); the two states would look alike.`);
      }
    }
  }
}

// The caveat decoration must not carry its own color: an underline color
// would be an unrated pair and a hue cue. It inherits the muted text rated
// above.
{
  const decorations = [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/--k-basis-caveat-decoration:\s*([^;]+);/g)].map((match) => match[1].trim());
  if (decorations.length === 0) failures.push("--k-basis-caveat-decoration is not declared; the trust-basis caveat cue has no token.");
  for (const value of decorations) {
    // Line keyword, style, optional thickness; anything else (a hex, a
    // function, a var(), a named color) could set the underline color.
    if (!/^underline dashed(?: [0-9.]+px)?$/.test(value)) {
      failures.push(`--k-basis-caveat-decoration: ${value} must name no color; the underline inherits the rated muted text.`);
    }
  }
  checked += decorations.length;
}

for (const id of KNOWN_ROLE_FAILURES.keys()) {
  if (!seenKnown.has(id)) failures.push(`KNOWN_ROLE_FAILURES entry ${id} matched no resolved pair; remove it.`);
}

if (checked === 0) {
  // A scan that matched nothing must never read as conformance.
  throw new Error(
    "Contrast check resolved zero token pairs — the token format or pair list has drifted from tokens/themes.css.",
  );
}

if (failures.length > 0) {
  throw new Error(`Contrast conformance failed:\n${failures.join("\n")}`);
}

console.log(
  `Kontour UI contrast check passed: ${checked - KNOWN_ROLE_FAILURES.size} theme/pair combinations meet their thresholds ` +
    `(${themes.length} themes x 2 modes for the roles; ${KNOWN_ROLE_FAILURES.size} pre-existing brand exceptions recorded).`,
);
