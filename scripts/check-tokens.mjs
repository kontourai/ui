import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { trustStatesFromSource } from "./trust-states-source.mjs";
import postcss from "postcss";
import selectorParser from "postcss-selector-parser";

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

// Trust states (ui#73): Surface's TRUST_STATUSES, in Surface's order. Pinned
// independently of the component source so a state removed from both the
// tokens and the component still fails here; check:surface-parity ties the
// component's list to the published @kontourai/surface.
const TRUST_STATES = ["unknown", "proposed", "assumed", "verified", "stale", "disputed", "superseded", "rejected", "revoked"];
{
  const fromSource = trustStatesFromSource(root);
  if (JSON.stringify(fromSource) !== JSON.stringify(TRUST_STATES)) {
    throw new Error(`${path.basename(fileURLToPath(import.meta.url))}: pinned TRUST_STATES ${JSON.stringify(TRUST_STATES)} differs from trustStates in react/src/trust-states.ts ${JSON.stringify(fromSource)}. Update the pin, and give every state its tokens and chip rule.`);
  }
}
const LINE_STYLES = new Set(["solid", "dashed", "dotted", "double"]);
const tokenBlock = (selector) => {
  for (const block of tokenFiles["tokens/tokens.css"].replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if (block[1].trim() === selector) return new Map([...block[2].matchAll(/(--k-[a-z0-9-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]));
  }
  throw new Error(`tokens/tokens.css has no ${selector} block.`);
};
for (const [selector, parts] of [[":root", ["", "-fill", "-line"]], ['[data-theme="light"]', ["", "-fill"]]]) {
  const declared = tokenBlock(selector);
  for (const state of TRUST_STATES) {
    for (const part of parts) {
      const token = `--k-trust-${state}${part}`;
      const value = declared.get(token);
      if (value === undefined) throw new Error(`tokens/tokens.css ${selector}: missing ${token}.`);
      // Literal, never an alias: a var() resolves where it is declared, so a
      // light or themed scope would inherit this scope's hue (ui#78).
      if (part === "-line" ? !LINE_STYLES.has(value) : !/^#[0-9a-f]{6}$/i.test(value)) {
        throw new Error(`tokens/tokens.css ${selector}: ${token}: ${value} must be ${part === "-line" ? `one of ${[...LINE_STYLES].join(", ")}` : "a literal 6-digit hex color"}.`);
      }
    }
  }
}

// Trust-state rules never read the product identity or the action role: a
// trust state is not a brand accent, and a white-label brand must not recolor
// what Kontour can establish. Each state's rules read only its own trust
// tokens, so one state cannot borrow another's color or line style, and no
// trust-state rule declares a custom property (a scoped
// `--k-trust-stale-line: solid` would repaint the state while every rule
// still reads the right token).
//
// Selectors are parsed (postcss-selector-parser), so escaped class names and
// classes inside :is() / :where() / :not() are recognized by their unescaped
// value, not by substring. A trust-state rule may not nest a rule or at-rule,
// and may not be nested in one: this check reads a rule's own selector and
// declarations, and does not resolve `&` against a parent selector.
//
// Chip paint (ui#89): the base .trust-state__chip draws a dotted line in
// neutral colors, so an unrecognized state looks tentative. Each state then
// has exactly one top-level `.trust-state--<state> .trust-state__chip` rule
// that sets color, background, border-color, and border-style to exactly
// that state's tokens, once each. Of the paint properties this check lists
// (CHIP_PAINT: color, -webkit-text-fill-color, background, background-color,
// background-image, and the border shorthands and their color and style
// longhands), it sets no others; it may also set border widths (CHIP_WIDTH),
// as disputed's double line does. The list is not exhaustive; the browser
// token spec is the backstop for properties it does not name. A state whose
// line token moved to another property would otherwise still render dotted
// through the base rule, and a theme's override of that token would be
// silently ignored. There is exactly one top-level .trust-state__chip rule,
// with no !important paint. Outside those rules, no top-level rule whose
// subject is the chip (a class in its last compound, or in :is() / :where()
// there; not inside :not() or :has()) may set those paint or width
// properties. No rule anywhere in react/styles.css declares a --k-trust-*
// custom property; the trust tokens live in tokens/.
//
// Carve-out: inside a top-level `@media (forced-colors: active)` or
// `@media print` (matched exactly, so `print, all` or `not print` do not
// qualify), a trust-state rule may set the color properties in
// COLOR_PROPERTY, but only to a CSS system color, transparent, or
// currentColor. The other CHIP_PAINT and CHIP_WIDTH properties are not
// allowed there, so the line style still comes from the state's token.
//
// Outside the carve-out, color properties in trust-state rules read a --k-*
// token or are inherit, currentColor, transparent, or none, so a named color
// (`color: red`) fails. Accepted gaps: a named color inside a shorthand
// (`border: 1px solid red`) is not recognized, nor is a selector that
// reaches the chip without naming .trust-state__chip in its last compound
// (such as `.trust-state--stale > *`).
const TRUST_FORBIDDEN = /--k-(?:brand|brand-contrast|action|action-contrast|focus|focus-ring)\b(?!-)/;
const CHIP_PAINT = /^(?:color|-webkit-text-fill-color|background(?:-color|-image)?|border(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?(?:-(?:color|style))?)$/;
const CHIP_WIDTH = /^border(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?-width$/;
const COLOR_PROPERTY = /^(?:color|-webkit-text-fill-color|background(?:-color)?|border(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?-color|outline-color|text-decoration-color|fill|stroke)$/;
const SYSTEM_COLORS = new Set([
  "canvas", "canvastext", "linktext", "buttontext", "buttonborder", "graytext", "highlight", "highlighttext",
  "mark", "marktext", "accentcolor", "accentcolortext", "field", "fieldtext", "visitedtext", "activetext",
  "selecteditem", "selecteditemtext", "buttonface", "transparent", "currentcolor",
]);
const chipPaint = (state) => ({
  color: `var(--k-trust-${state})`,
  background: `var(--k-trust-${state}-fill)`,
  "border-color": `var(--k-trust-${state})`,
  "border-style": `var(--k-trust-${state}-line)`,
});
const trustRules = new Map(TRUST_STATES.map((state) => [state, 0]));
let baseChipRules = 0;
postcss.parse(tokenFiles["react/styles.css"]).walkRules((rule) => {
  const parsed = parseSelectors(rule.selector);
  const classes = selectorNodes(parsed).filter((node) => node.type === "class").map((node) => node.value);
  if (!classes.some((name) => name.startsWith("trust-state"))) return;
  const where = describeRule(rule);
  rejectNesting(rule, where, "trust-state");
  const owners = new Set(classes.filter((name) => name.startsWith("trust-state--")).map((name) => name.slice("trust-state--".length)));
  const media = carveOutMedia(rule);
  rule.walkDecls((decl) => {
    const prop = decl.prop.toLowerCase();
    if (prop.startsWith("--")) throw new Error(`${where}: declares ${decl.prop}; trust-state rules read tokens and never redefine them.`);
    if (TRUST_FORBIDDEN.test(decl.value)) {
      throw new Error(`${where}: ${decl.prop}: ${decl.value} must not read the brand, action, or focus roles; trust states use --k-trust-* tokens.`);
    }
    for (const match of decl.value.matchAll(/--k-trust-([a-z-]+?)(?:-fill|-line)?\b(?![a-z-])/g)) {
      if (owners.size !== 1 || !owners.has(match[1])) throw new Error(`${where}: ${decl.prop} reads --k-trust-${match[1]}*, which belongs to another state.`);
    }
    if (media) {
      if (COLOR_PROPERTY.test(prop) && !isSystemColor(decl.value)) throw new Error(`${where}: ${decl.prop}: ${decl.value}; inside @media ${media} a trust-state rule may set colors only to a system color, transparent, or currentColor.`);
      if ((CHIP_PAINT.test(prop) || CHIP_WIDTH.test(prop)) && !COLOR_PROPERTY.test(prop)) throw new Error(`${where}: sets ${decl.prop}; inside @media ${media} a trust-state rule may set only colors, so the line style still comes from the state's token.`);
    } else if (COLOR_PROPERTY.test(prop) && !/^(?:var\(--k-[a-z0-9-]+\)|inherit|currentcolor|transparent|none)$/i.test(decl.value.trim())) {
      throw new Error(`${where}: ${decl.prop}: ${decl.value} must read a --k-* token (or be inherit, currentColor, transparent, or none).`);
    }
  });
  if (media) return;
  const paint = rule.nodes.filter((node) => node.type === "decl" && CHIP_PAINT.test(node.prop.toLowerCase()));
  const widths = rule.nodes.filter((node) => node.type === "decl" && CHIP_WIDTH.test(node.prop.toLowerCase()));
  const state = TRUST_STATES.find((candidate) => sameSelector(parsed, `.trust-state--${candidate} .trust-state__chip`));
  // A state's own chip rule may set border widths (disputed's double line
  // needs a wider border), in the painting rule or a separate one.
  if (state && rule.parent?.type === "root" && paint.length === 0) return;
  if (state && rule.parent?.type === "root" && paint.length > 0) {
    const expected = chipPaint(state);
    const seen = paint.map((decl) => decl.prop.toLowerCase());
    for (const decl of paint) {
      const prop = decl.prop.toLowerCase();
      if (!(prop in expected)) throw new Error(`${where}: sets ${decl.prop}; a state's chip rule sets only ${Object.keys(expected).join(", ")}, each to the state's own token.`);
      if (seen.indexOf(prop) !== seen.lastIndexOf(prop)) throw new Error(`${where}: sets ${prop} more than once.`);
      if (decl.important || decl.value.trim() !== expected[prop]) throw new Error(`${where}: ${prop}: ${decl.value}${decl.important ? " !important" : ""} must be exactly ${expected[prop]}.`);
    }
    for (const prop of Object.keys(expected)) {
      if (!seen.includes(prop)) throw new Error(`${where} must set ${prop}: ${expected[prop]}; otherwise the chip keeps the base rule's value and ignores the ${state} token.`);
    }
    trustRules.set(state, trustRules.get(state) + 1);
    return;
  }
  // The base chip rule paints the neutral fallback; its specificity is below
  // every state rule's. No other chip rule may paint.
  const base = rule.parent?.type === "root" && sameSelector(parsed, ".trust-state__chip");
  if (base) {
    baseChipRules += 1;
    if (baseChipRules > 1) throw new Error(`${where}: a second top-level .trust-state__chip rule; the base chip rule must be exactly one.`);
    if (paint.some((decl) => decl.important)) throw new Error(`${where}: chip paint must not be !important; it would override every state.`);
    return;
  }
  if (paint.length + widths.length > 0 && parsed.some((selector) => subjectHasClass(selector, "trust-state__chip"))) {
    throw new Error(`${where}: sets ${[...paint, ...widths].map((decl) => decl.prop).join(", ")} on the chip; only the one .trust-state__chip rule and each state's one top-level .trust-state--<state> .trust-state__chip rule may paint the chip.`);
  }
});
// Trust tokens are defined in tokens/, never in the component stylesheet: a
// scoped redefinition anywhere (`.consumer { --k-trust-stale: ... }`) would
// repaint the chips under it while every chip rule still reads its token.
postcss.parse(tokenFiles["react/styles.css"]).walkDecls((decl) => {
  if (/^--k-trust-/i.test(decl.prop)) throw new Error(`${decl.parent.type === "rule" ? describeRule(decl.parent) : `react/styles.css ${decl.parent.type === "atrule" ? `@${decl.parent.name} ${decl.parent.params}` : "(top level)"}`}: declares ${decl.prop}; --k-trust-* tokens are defined in tokens/, never in react/styles.css.`);
});
if (baseChipRules !== 1) throw new Error(`react/styles.css must have exactly one top-level .trust-state__chip rule; found ${baseChipRules}.`);
for (const [state, count] of trustRules) {
  if (count !== 1) throw new Error(`react/styles.css must have exactly one top-level .trust-state--${state} .trust-state__chip rule painting the chip with the ${state} tokens; found ${count}.`);
}

// Trust basis (ui#87): a muted text line after the trust-state chip. It must
// never read as a second status, so its rules read only neutral text, line,
// and layout tokens: no brand, action, or focus role, no status tone, and no
// trust-state ink. Caveats are marked by one line-style token, a dashed
// underline that names no color (it inherits the muted text), and only the
// caveat rule may read it.
const BASIS_DECORATION = "--k-basis-caveat-decoration";
const BASIS_DECORATION_VALUE = /^underline dashed(?: [0-9.]+px)?$/;
{
  let declarations = 0;
  for (const file of ["tokens/tokens.css", "tokens/themes.css"]) {
    postcss.parse(tokenFiles[file]).walkDecls(BASIS_DECORATION, (decl) => {
      declarations += 1;
      if (!BASIS_DECORATION_VALUE.test(decl.value.trim())) {
        throw new Error(`${file} ${decl.parent.selector}: ${BASIS_DECORATION}: ${decl.value} must be "underline dashed" with an optional px thickness and no color; the caveat cue is a line style, never a hue.`);
      }
    });
  }
  if (!tokenBlock(":root").has(BASIS_DECORATION)) throw new Error(`tokens/tokens.css :root: missing ${BASIS_DECORATION}.`);
  if (declarations === 0) throw new Error(`No ${BASIS_DECORATION} declaration found.`);
}
const BASIS_ALLOWED = /^--k-(?:text|text-muted|line|space-[0-9]+|text-(?:xs|sm|md)|leading-[a-z]+|font-(?:ui|mono)|border-thin|basis-caveat-decoration)$/;
const BASIS_FORBIDDEN = /^--k-(?:brand|brand-contrast|action|action-contrast|focus|focus-ring|status-contrast|positive|caution|negative|active|neutral)(?:-soft)?$|^--k-trust-/;
const BASIS_CAVEAT_SELECTOR = '.trust-basis__facet[data-caveat="true"]';
const BASIS_ATTRIBUTES = new Set(["data-caveat", "data-field", "data-code", "data-basis-state"]);
let basisRules = 0;
let caveatRules = 0;
// A rule is scanned as a basis rule when its parsed selector names, anywhere
// (pseudo-class arguments included, names unescaped): a class starting with
// trust-basis, the k-trust-basis element, an attribute the component sets
// (data-caveat, data-field, data-code, data-basis-state), or a [class]
// attribute selector whose value mentions "basis". Accepted gap: a selector
// that reaches the line only through structure or a consumer's own class
// (such as `k-trust-state + span`) is not recognized.
postcss.parse(tokenFiles["react/styles.css"]).walkRules((rule) => {
  const parsed = parseSelectors(rule.selector);
  const nodes = selectorNodes(parsed);
  const attribute = (node) => node.type === "attribute" && node.attribute.toLowerCase();
  const isBasis = nodes.some((node) =>
    (node.type === "class" && node.value.startsWith("trust-basis"))
    || (node.type === "tag" && node.value.toLowerCase() === "k-trust-basis")
    || BASIS_ATTRIBUTES.has(attribute(node))
    || (attribute(node) === "class" && String(node.value ?? "").toLowerCase().includes("basis")));
  if (!isBasis) return;
  basisRules += 1;
  const caveat = nodes.some((node) => attribute(node) === "data-caveat");
  const where = describeRule(rule);
  rejectNesting(rule, where, "trust-basis");
  const media = carveOutMedia(rule);
  rule.walkDecls((decl) => {
    const prop = decl.prop.toLowerCase();
    // A scoped token override ([data-basis-state]{--k-text-muted: ...})
    // would recolor the line while every property still reads an allowed token.
    if (prop.startsWith("--")) throw new Error(`${where}: declares ${decl.prop}; trust-basis rules read tokens and never redefine them.`);
    for (const match of decl.value.matchAll(/var\(\s*(--k-[a-z0-9-]+)/g)) {
      const token = match[1];
      if (BASIS_FORBIDDEN.test(token)) throw new Error(`${where}: ${decl.prop} reads ${token}; trust-basis rules must not read brand, action, focus, status-tone, or trust-state tokens.`);
      if (!BASIS_ALLOWED.test(token)) throw new Error(`${where}: ${decl.prop} reads ${token}, which is not a neutral text, line, or layout token allowed in trust-basis rules.`);
      if (token === BASIS_DECORATION && !caveat) throw new Error(`${where}: only ${BASIS_CAVEAT_SELECTOR} may read ${BASIS_DECORATION}.`);
    }
    // In the forced-colors / print carve-out (see the trust-state rules), a
    // system color is allowed too.
    if (/^(?:color|background(?:-color)?|border(?:-[a-z]+)*-color|text-decoration-color|outline-color|fill|stroke)$/.test(prop) && !/^var\(--k-(?:text|text-muted|line)\)$|^(?:inherit|currentColor)$/.test(decl.value.trim()) && !(media && isSystemColor(decl.value))) {
      throw new Error(`${where}: ${decl.prop}: ${decl.value} must be --k-text-muted, --k-text, --k-line, or inherited${media ? `, or a system color inside @media ${media}` : ""}.`);
    }
    if (/^text-decoration(?:-line|-style)?$/.test(prop) && !caveat) {
      throw new Error(`${where}: sets ${decl.prop}; only caveat facets are decorated, through ${BASIS_CAVEAT_SELECTOR}.`);
    }
  });
  if (caveat) {
    caveatRules += 1;
    // Any rule that references data-caveat only draws the underline: no
    // color, weight, or other styling that would turn the caveat into a
    // second visual channel.
    rule.walkDecls((decl) => {
      if (!["text-decoration", "text-underline-offset"].includes(decl.prop.toLowerCase())) {
        throw new Error(`${where}: ${decl.prop} is not allowed; a rule that references data-caveat sets only text-decoration (the token) and text-underline-offset.`);
      }
    });
    if (rule.parent?.type !== "root" || !sameSelector(parsed, BASIS_CAVEAT_SELECTOR)) {
      throw new Error(`${where}: the one rule that references data-caveat must be ${BASIS_CAVEAT_SELECTOR}, at the top level.`);
    }
    const decoration = rule.nodes.find((node) => node.type === "decl" && node.prop === "text-decoration");
    if (decoration?.value !== `var(${BASIS_DECORATION})`) throw new Error(`${where} must set text-decoration: var(${BASIS_DECORATION}).`);
  }
});
if (basisRules < 5) throw new Error(`react/styles.css: only ${basisRules} trust-basis rules scanned.`);
if (caveatRules !== 1) throw new Error(`react/styles.css must have exactly one rule referencing data-caveat (${BASIS_CAVEAT_SELECTOR}); found ${caveatRules}.`);

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

// Parses a selector list into its top-level selectors.
function parseSelectors(text) {
  const selectors = [];
  selectorParser((list) => list.each((selector) => selectors.push(selector))).processSync(text);
  return selectors;
}

// Every node of the parsed selectors, including those inside :is(), :where(),
// :not(), and other pseudo-class arguments. Class, tag, and attribute names
// are unescaped by the parser.
function selectorNodes(selectors) {
  const nodes = [];
  for (const selector of selectors) selector.walk((node) => nodes.push(node));
  return nodes;
}

// Structural equality of two selector lists, ignoring whitespace, quoting,
// escapes, and the case of tag and attribute names.
function sameSelector(selectors, expected) {
  const describe = (list) => list.map((selector) => {
    const parts = [];
    selector.walk((node) => {
      if (node.type === "class") parts.push(`.${node.value}`);
      else if (node.type === "tag") parts.push(`tag:${node.value.toLowerCase()}`);
      else if (node.type === "attribute") parts.push(`[${node.attribute.toLowerCase()}${node.operator ?? ""}${node.value ?? ""}${node.insensitive ? " i" : ""}]`);
      else if (node.type === "combinator") parts.push(`combinator:${node.value.trim() || " "}`);
      else if (node.type === "pseudo") parts.push(`pseudo:${node.value.toLowerCase()}`);
      else parts.push(`${node.type}:${node.value ?? ""}`);
    });
    return parts.join("|");
  }).join(",");
  return describe(selectors) === describe(parseSelectors(expected));
}

// "react/styles.css <selector>", plus the enclosing at-rule if there is one.
function describeRule(rule) {
  const selector = rule.selector.replace(/\s+/g, " ").trim();
  return `react/styles.css ${selector}${rule.parent?.type === "atrule" ? ` (inside @${rule.parent.name} ${rule.parent.params})` : ""}`;
}

// Nested CSS: the checks read a rule's own selector and declarations and do
// not resolve `&`, so a scanned rule may neither contain nor sit inside a rule
// or at-rule nesting.
function rejectNesting(rule, where, kind) {
  const inner = rule.nodes.find((node) => node.type === "rule" || node.type === "atrule");
  if (inner) throw new Error(`${where}: nests ${inner.type === "rule" ? inner.selector : `@${inner.name}`}; ${kind} rules may not use nesting, which this check does not resolve.`);
  for (let parent = rule.parent; parent && parent.type !== "root"; parent = parent.parent) {
    if (parent.type === "rule") throw new Error(`${where}: is nested inside ${parent.selector}; ${kind} rules may not use nesting, which this check does not resolve.`);
  }
}

// The forced-colors / print carve-out: a rule directly inside a top-level
// `@media (forced-colors: active)` or `@media print` returns that query.
function carveOutMedia(rule) {
  const parent = rule.parent;
  if (parent?.type !== "atrule" || parent.name.toLowerCase() !== "media" || parent.parent?.type !== "root") return null;
  const query = parent.params.toLowerCase().replace(/\s+/g, "");
  return query === "(forced-colors:active)" || query === "print" ? parent.params : null;
}

function isSystemColor(value) {
  return SYSTEM_COLORS.has(value.trim().toLowerCase());
}

// Whether the selector's subject (its last compound, including :is() and
// :where() arguments there, which match the same element) has the class.
// Classes inside :not(), :has(), or earlier compounds do not count.
function subjectHasClass(selector, name) {
  const last = selector.nodes.slice(selector.nodes.findLastIndex((node) => node.type === "combinator") + 1);
  return last.some((node) =>
    (node.type === "class" && node.value === name)
    || (node.type === "pseudo" && [":is", ":where", ":matches", ":-webkit-any"].includes(node.value.toLowerCase()) && node.nodes.some((inner) => subjectHasClass(inner, name))));
}
