// Generates the YAML front matter of DESIGN.md from the shipped token contract.
//
// DESIGN.md states roles and rules; the values live in tokens/. The front matter is
// the machine-readable projection of those values in the DESIGN.md format
// (https://github.com/google-labs-code/design.md), so it must never be hand-edited:
//
//   node scripts/generate-design-md.mjs            print the generated front matter
//   node scripts/generate-design-md.mjs --write    rewrite DESIGN.md's front matter, keep the body
//   node scripts/generate-design-md.mjs --check    exit 1 when DESIGN.md's front matter drifted
//
// Naming (the format has no concept of modes or themes):
//   key            = the CSS custom property minus `--k-`   (`--k-space-5` -> `space-5`)
//   key-light      = the value under [data-theme="light"]
//   key-<theme>    = the value under .theme-<theme>         (`brand-flow`)
//   key-<theme>-light = the value under [data-theme="light"] .theme-<theme>
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import selectorParser from "postcss-selector-parser";

// Generator errors are contract violations, not crashes: print the message, exit 1.
process.on("uncaughtException", (error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8").replace(/\r\n?/g, "\n");
const DESIGN_FILE = "DESIGN.md";
const SOURCES = ["tokens/tokens.css", "tokens/themes.css", "react/styles.css"];

// Every --k-* token lands in exactly one bucket: by name pattern first, then an alias
// (`var(--k-other)`) takes its target's bucket, then a literal hex/rgb(a) value is a
// color. Anything else throws, so a new token forces a decision about how (or whether)
// DESIGN.md represents it. Every bucket reaches the front matter, either as a token or as
// a value in the trailing comment, so any token value change fails --check.
const CLASSIFY = [
  [/^--k-(?:action|action-contrast|focus|status-contrast)$/, "color"],
  [/^--k-space-/, "spacing"],
  [/^--k-radius-/, "rounded"],
  [/^--k-text-(?:xs|sm|md|lg|xl|2xl)$/, "type-size"],
  [/^--k-font-/, "omit:font-family stacks; the type levels above resolve the families their selectors use"],
  [/^--k-(?:leading|tracking)-/, "omit:line-height and letter-spacing scales have no token group in the format; the type levels above resolve the steps their selectors use"],
  [/-soft$/, "omit:status soft fills are color-mix() of the active status hue, resolved at runtime per mode; the format cannot express a live reference inside color-mix()"],
  [/^--k-(?:shadow|elevation-)/, "omit:shadows have no token group in the format; see Elevation & Depth"],
  [/^--k-(?:ease|dur)$/, "omit:motion has no token group in the format; see Motion"],
  [/^--k-(?:border-|focus-ring-(?:width|offset)$)/, "omit:stroke widths have no token group in the format"],
  [/^--k-z-/, "omit:stacking order has no token group in the format"],
  // Trust-state line styles are border-style keywords (the non-color cue), not colors
  // or dimensions; the inks and fills beside them are ordinary colors.
  [/^--k-trust-[a-z-]+-line$/, "omit:trust-state line styles are border-style keywords (the non-color cue); the format has no token group for them"],
  // The trust-basis caveat cue is a text-decoration shorthand (line and style, no color).
  [/^--k-basis-caveat-decoration$/, "omit:the trust-basis caveat cue is a text-decoration value (a dashed underline in the text's own color); the format has no token group for it"],
];
const COLOR_VALUE = /^(?:#[0-9a-f]{3,8}|rgba?\([^)]*\))$/i;

// Typography levels pair a family, size, weight and metrics the way a shipped selector
// in react/styles.css pairs them. The selector is the source; only the level name is
// declared here.
const TYPE_LEVELS = [
  ["display", ".topbar h1"],
  ["title", ".dialog__title"],
  ["body-md", ".control"],
  ["label", ".field__label"],
  ["eyebrow", ".eyebrow"],
  ["badge", ".badge"],
  ["button", ".btn"],
];
// Components merge a base class and its variant exactly as the cascade does.
const COMPONENTS = [
  ["button-primary", [".btn", ".btn-primary"], "button"],
  ["button-ghost", [".btn", ".btn-ghost"], "button"],
  ["badge", [".badge"], "badge"],
  ["panel", [".panel"], null],
  ["input", [".control"], "body-md"],
];
const COMPONENT_PROPS = { background: "backgroundColor", color: "textColor", "border-radius": "rounded", padding: "padding" };

const aliasOf = (value) => /^var\((--k-[a-z0-9-]+)\)$/.exec(value)?.[1] ?? null;
const classify = (prop, value, seen = new Set()) => {
  for (const [pattern, bucket] of CLASSIFY) if (pattern.test(prop)) return bucket;
  const target = aliasOf(value);
  if (target) {
    if (seen.has(target) || !base.has(target)) {
      throw new Error(`${prop}: aliases ${target}, which tokens/tokens.css does not define at :root before it (or the alias is circular).`);
    }
    return classify(target, base.get(target), new Set([...seen, prop]));
  }
  if (COLOR_VALUE.test(value)) return "color";
  throw new Error(`${prop}: unclassified token (${value}). Teach scripts/generate-design-md.mjs how DESIGN.md represents it.`);
};
const keyOf = (prop) => prop.replace(/^--k-/, "");

// Resolve which (theme, mode) a rule's selector list targets; every selector in the list
// must agree, or the rule cannot be named unambiguously.
const scopeOf = (rule) => {
  const scopes = new Set();
  selectorParser((selectors) => {
    selectors.each((selector) => {
      let theme = null;
      let light = false;
      let other = false;
      // :where(:not(...)) tails only narrow where a light block applies (the
      // nearest theme and mode win, ui#84); what they name is excluded, not
      // targeted, so nothing inside :not() changes the rule's scope.
      const excluded = (node) => {
        for (let parent = node.parent; parent; parent = parent.parent) if (parent.type === "pseudo" && parent.value === ":not") return true;
        return false;
      };
      selector.walk((node) => {
        if (excluded(node) || (node.type === "pseudo" && node.value === ":not")) return;
        if (node.type === "class" && node.value.startsWith("theme-")) theme = node.value.slice("theme-".length);
        else if (node.type === "attribute" && node.attribute === "data-theme" && node.value === "light") light = true;
        else if (node.type === "pseudo" && node.value === ":root") { /* default scope */ }
        // :where(.theme-x) [data-theme="light"] is the light block's zero-weight
        // placement; the class inside it is walked like any other.
        else if (node.type === "pseudo" && node.value === ":where") { /* weight only */ }
        else if (["class", "attribute", "pseudo", "tag", "id"].includes(node.type)) other = true;
      });
      if (other) throw new Error(`Unsupported token selector: ${selector.toString().trim()}`);
      scopes.add(`${theme ?? ""}|${light ? "light" : ""}`);
    });
  }).processSync(rule.selector);
  if (scopes.size !== 1) throw new Error(`Token rule mixes scopes: ${rule.selector}`);
  const [theme, mode] = [...scopes][0].split("|");
  return { theme, light: mode === "light", suffix: [theme, mode].filter(Boolean).join("-") };
};
// CSS resolution order for a scoped reference: a theme class beats the light attribute
// (themes.css loads after tokens.css, and a theme class on a descendant wins), so try
// theme+light, theme, light, then the default.
const scopedKeys = (key, { theme, light }) => [
  theme && light && `${key}-${theme}-light`,
  theme && `${key}-${theme}`,
  light && `${key}-light`,
  key,
].filter(Boolean);

const groups = { colors: {}, rounded: {}, spacing: {} };
const declared = new Map(); // "--k-token|scope" -> value, for checking values quoted in prose
const base = new Map();
const omitted = new Map();
const typeSizes = new Map();
const put = (group, key, value) => {
  if (key in groups[group]) throw new Error(`Duplicate ${group} key ${key}`);
  groups[group][key] = value;
};
const dimension = (value, prop) => {
  if (value === "0") return "0px";
  if (/^-?\d*\.?\d+(?:px|em|rem)$/.test(value)) return value;
  throw new Error(`${prop}: ${value} is not a DESIGN.md Dimension (px, em, rem).`);
};
const pendingRefs = []; // [group, key, target prop, scope], resolved once every rule is read

for (const file of ["tokens/tokens.css", "tokens/themes.css"]) {
  postcss.parse(read(file), { from: file }).walkRules((rule) => {
    // Dark-island rules (every selector starts with [data-theme="dark"], ui#80)
    // repeat :root or a theme's base block; check:contrast fails when one
    // differs from the block it mirrors, so the front matter names each value
    // once, from that block.
    if (rule.parent?.type === "root" && rule.selectors.every((selector) => selector.trim().startsWith('[data-theme="dark"]'))) return;
    // A token rule inside @media/@supports would override conditionally; the format cannot
    // say "only when", so refuse rather than let it silently win or vanish.
    if (rule.parent?.type !== "root") {
      throw new Error(`${file}: token rule "${rule.selector}" is nested in @${rule.parent?.name ?? rule.parent?.type}; DESIGN.md cannot represent conditional tokens.`);
    }
    const scope = scopeOf(rule);
    const { suffix } = scope;
    rule.walkDecls(/^--k-/, (decl) => {
      const value = decl.value.replace(/\s+/g, " ").trim();
      if (!suffix) base.set(decl.prop, value);
      declared.set(`${decl.prop}|${suffix}`, value);
      const bucket = classify(decl.prop, value);
      const key = [keyOf(decl.prop), suffix].filter(Boolean).join("-");
      const group = { color: "colors", rounded: "rounded", spacing: "spacing" }[bucket];
      const alias = aliasOf(value);
      if (group && alias) {
        put(group, key, null);
        pendingRefs.push([group, key, alias, scope]);
      } else if (group === "colors") put("colors", key, value);
      else if (group) put(group, key, dimension(value, decl.prop));
      else if (bucket === "type-size" && !suffix) {
        typeSizes.set(decl.prop, value);
      } else if (bucket === "type-size") {
        const reason = "theme overrides of type sizes: the type levels above describe the default themes";
        omitted.set(reason, [...(omitted.get(reason) ?? []), `${decl.prop} (${suffix}): ${value}`]);
      } else if (bucket.startsWith("omit:")) {
        // Values are listed too, so the drift check covers every token, not only the
        // ones the format can carry.
        const reason = bucket.slice("omit:".length);
        omitted.set(reason, [...(omitted.get(reason) ?? []), `${suffix ? `${decl.prop} (${suffix})` : decl.prop}: ${value}`]);
      }
    });
  });
}
// An alias resolves to the target's value in the same mode/theme scope.
for (const [group, key, target, scope] of pendingRefs) {
  const found = scopedKeys(keyOf(target), scope).find((candidate) => groups[group][candidate] != null);
  if (!found) throw new Error(`${group}.${key} aliases ${target}, which has no ${group} value in scope "${scope.suffix || "default"}".`);
  groups[group][key] = `{${group}.${found}}`;
}

const tokenValue = (prop) => {
  if (!base.has(prop)) throw new Error(`react/styles.css references ${prop}, which tokens/tokens.css does not define.`);
  const target = aliasOf(base.get(prop));
  return target ? tokenValue(target) : base.get(prop);
};
const singleVar = (value) => /^var\((--k-[a-z0-9-]+)\)$/.exec(value.trim())?.[1] ?? null;
const styles = postcss.parse(read("react/styles.css"), { from: "react/styles.css" });
const declsFor = (selector) => {
  const found = {};
  let matched = false;
  styles.walkRules((rule) => {
    // Only unconditional rules describe the default component; @media variants (e.g.
    // reduced motion) are deliberately ignored rather than merged in.
    if (rule.parent?.type !== "root") return;
    if (!rule.selectors.map((s) => s.trim()).includes(selector)) return;
    matched = true;
    rule.walkDecls((decl) => { found[decl.prop] = decl.value.trim(); });
  });
  if (!matched) throw new Error(`react/styles.css no longer has a rule for ${selector}; update scripts/generate-design-md.mjs.`);
  return found;
};

const fontSize = (value, prop) => {
  // A fluid clamp() is not a Dimension; the format records its upper bound and the prose
  // (Typography) says the step is fluid.
  const clamp = /^clamp\(\s*([^,]+),\s*[^,]+,\s*([^)]+)\)$/.exec(value);
  return dimension(clamp ? clamp[2].trim() : value, prop);
};
const typography = {};
for (const [prop, value] of typeSizes) {
  const target = aliasOf(value);
  typography[keyOf(prop)] = { fontSize: fontSize(target ? tokenValue(target) : value, prop) };
}
for (const [level, selector] of TYPE_LEVELS) {
  const decls = declsFor(selector);
  const resolved = (name) => {
    const raw = decls[name];
    if (raw === undefined) return undefined;
    const token = singleVar(raw);
    return token ? tokenValue(token) : raw;
  };
  const entry = {};
  if (decls["font-family"]) entry.fontFamily = resolved("font-family");
  if (decls["font-size"]) entry.fontSize = fontSize(resolved("font-size"), `${selector} font-size`);
  if (decls["font-weight"]) entry.fontWeight = Number(resolved("font-weight"));
  if (decls["line-height"]) entry.lineHeight = Number(resolved("line-height"));
  if (decls["letter-spacing"]) entry.letterSpacing = dimension(resolved("letter-spacing"), `${selector} letter-spacing`);
  for (const [field, value] of Object.entries(entry)) {
    if (typeof value === "number" && !Number.isFinite(value)) throw new Error(`${selector}: ${field} is not numeric.`);
  }
  if (!Object.keys(entry).length) throw new Error(`${selector} declares no typography.`);
  typography[level] = entry;
}

const refFor = (token) => {
  const key = keyOf(token);
  for (const group of ["colors", "rounded", "spacing"]) if (key in groups[group]) return `{${group}.${key}}`;
  return null;
};
const components = {};
for (const [name, selectors, typeLevel] of COMPONENTS) {
  const merged = Object.assign({}, ...selectors.map(declsFor));
  const entry = {};
  for (const [cssProp, formatProp] of Object.entries(COMPONENT_PROPS)) {
    if (merged[cssProp] === undefined) continue;
    const token = singleVar(merged[cssProp]);
    const ref = token && refFor(token);
    // Multi-value shorthands and calc() have no faithful single-token form; leave them out.
    if (ref) entry[formatProp] = ref;
  }
  if (typeLevel) entry.typography = `{typography.${typeLevel}}`;
  components[name] = entry;
}

// The format expects a `primary` color. Kontour UI has no --k-primary: the primary action
// color is whatever .btn-primary paints, so derive the alias from that rule.
if (!components["button-primary"].backgroundColor) throw new Error(".btn-primary no longer resolves to a single color token.");
groups.colors = { primary: components["button-primary"].backgroundColor, ...groups.colors };

const scalar = (value) => (typeof value === "number" ? String(value) : JSON.stringify(value));
const block = (name, map, indent = "") => {
  const lines = [`${indent}${name}:`];
  for (const [key, value] of Object.entries(map)) {
    if (value && typeof value === "object") lines.push(...block(key, value, `${indent}  `));
    else lines.push(`${indent}  ${key}: ${scalar(value)}`);
  }
  return lines;
};

const frontMatter = [
  "---",
  "# GENERATED by scripts/generate-design-md.mjs from tokens/tokens.css, tokens/themes.css",
  "# and react/styles.css. Do not edit by hand: run `node scripts/generate-design-md.mjs --write`.",
  "# `npm run check:design` fails when this block drifts from the token contract.",
  "# Keys are the CSS custom property minus `--k-`; `-light` is the [data-theme=\"light\"] value;",
  "# `-<theme>` is the .theme-<theme> value. See \"Reading the token block\" in the body.",
  "version: alpha",
  "name: Kontour UI",
  `description: ${JSON.stringify("Design constitution for Kontour product interfaces: roles and rules in prose, values generated from the shipped --k-* token contract.")}`,
  ...block("colors", groups.colors),
  ...block("typography", typography),
  ...block("rounded", groups.rounded),
  ...block("spacing", groups.spacing),
  ...block("components", components),
  "# Not represented above (the values live in tokens/ only):",
  ...[...omitted].flatMap(([reason, props]) => [`# - ${reason}:`, ...props.map((entry) => `#     ${entry}`)]),
  "---",
  "",
].join("\n");

const splitDesign = (text) => {
  const match = /^---\n[\s\S]*?\n---\n/.exec(text);
  if (!match) throw new Error(`${DESIGN_FILE} must start with a --- front matter block.`);
  return [match[0], text.slice(match[0].length)];
};

// The body may quote a shipped value only as `--k-token` = `value` or
// `--k-token` (scope) = `value`, where scope is a front-matter suffix such as light,
// flow, or flow-light. Every such quote must still match the token contract.
//
// Every quote anywhere in the body is verified, table cells and header rows included.
// Separately, any unit that mentions a token (a prose line, or a table row, header rows
// included) must carry no other value-looking text anywhere in it (before or after the
// mention, and after a valid quote), so a malformed or contradicting quote cannot pass
// unchecked. For that loose scan only, table cells under a header that starts with
// "Draft" are exempt: they hold the draft's direction, not shipped values. Not covered: a
// value on a different line from the token name.
//
// Ignored by the loose scan: link targets (the `(url)` part; link text is still scanned),
// `#n` issue references whose digit count is not 3, 4, 6 or 8 (those read as hex colors,
// so write such an issue as a link), acronym versions such as `WCAG 2.2`, and `OPEN-n`
// ids. A bare number next to a token name still counts (`--k-z-dropdown` is a number).
const CLAIM = /`(--k-[a-z0-9-]+)`(?: \(([a-z-]+)\))? = `([^`]+)`/g;
const MENTION = /--k-[a-z0-9-]+/g;
const NOT_VALUES = [
  [/\]\([^)]*\)/g, "]"], // link targets, e.g. [#72](https://github.com/.../issues/72)
  [/(?<![\w#])#(?!(?:\d{3}|\d{4}|\d{6}|\d{8})\b)\d+\b/g, " "], // issue references like #72
  [/\b[A-Z]{2,}[ -]?\d+(?:\.\d+)*\b/g, " "], // acronym versions like WCAG 2.2
  [/\bOPEN-\d+\b/g, " "],
];
const VALUE_LIKE = /-?\d*\.?\d+(?:px|em|rem)\b|#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|clamp|calc)\(|(?<![\w#.–-])\d+(?:\.\d+)?(?![\w%.-])/i;
const stripQuote = (line) => line.replace(/^\s*(?:>\s*)*/, "");
// Split on unescaped pipes only.
const cellsOf = (row) => row.trim().replace(/^\|/, "").replace(/(?<!\\)\|$/, "").split(/(?<!\\)\|/).map((cell) => cell.trim());
const isSeparator = (row) => /^\|?[\s:|-]+\|?$/.test(row.trim()) && row.includes("-");
const proseClaims = (body, offset) => {
  const problems = [];
  let count = 0;
  const lines = body.split("\n");
  let header = null;
  lines.forEach((line, index) => {
    const at = `line ${index + 1 + offset}`;
    const bare = stripQuote(line);
    let scanned = line;
    if (bare.startsWith("|")) {
      if (isSeparator(bare)) return;
      const cells = cellsOf(bare);
      if (isSeparator(stripQuote(lines[index + 1] ?? ""))) {
        header = cells; // a header row is still checked below, with no exemption
      } else {
        scanned = cells.filter((_, column) => !/^draft\b/i.test(header?.[column] ?? "")).join(" | ");
      }
    } else {
      header = null;
    }
    for (const match of line.matchAll(CLAIM)) {
      count += 1;
      const [text, prop, scope = "", claimed] = match;
      const actual = declared.get(`${prop}|${scope}`);
      if (actual === undefined) problems.push(`${at}: ${text}: no such token in that scope`);
      else if (actual !== claimed) problems.push(`${at}: ${text}: tokens/ says \`${actual}\``);
    }
    if (!line.match(MENTION)) return;
    let rest = scanned.replace(CLAIM, " ").replace(MENTION, " ");
    for (const [pattern, replacement] of NOT_VALUES) rest = rest.replace(pattern, replacement);
    const value = VALUE_LIKE.exec(rest);
    if (value) problems.push(`${at}: "${value[0]}" sits beside a token name but is not a checked \`--k-token\` = \`value\` quote: ${line.trim()}`);
  });
  return { count, problems };
};

const mode = process.argv[2];
if (mode === "--write") {
  const [, body] = splitDesign(read(DESIGN_FILE));
  writeFileSync(path.join(root, DESIGN_FILE), frontMatter + body);
} else if (mode === "--check") {
  const [current] = splitDesign(read(DESIGN_FILE));
  if (current !== frontMatter) {
    const have = current.split("\n");
    const want = frontMatter.split("\n");
    const line = want.findIndex((text, index) => text !== have[index]);
    console.error(`${DESIGN_FILE} front matter drifted from ${SOURCES.join(", ")} (first difference at line ${line + 1}).`);
    console.error(`  DESIGN.md: ${have[line] ?? "<missing>"}`);
    console.error(`  generated: ${want[line] ?? "<missing>"}`);
    console.error("Run `node scripts/generate-design-md.mjs --write` and commit the result; never hand-edit the block.");
    process.exit(1);
  }
  const { count, problems } = proseClaims(read(DESIGN_FILE).slice(current.length), current.split("\n").length - 1);
  if (problems.length) {
    console.error(`${DESIGN_FILE} body quotes token values that are malformed or no longer match tokens/:`);
    for (const problem of problems) console.error(`  ${problem}`);
    console.error("Update the prose, or the OPEN item it records, in the same change as the token.");
    process.exit(1);
  }
  console.log(`DESIGN.md prose quotes ${count} token values; all match tokens/.`);
  console.log(`DESIGN.md front matter matches the token contract: ${Object.keys(groups.colors).length} colors, ${Object.keys(typography).length} type levels, ${Object.keys(groups.rounded).length} radii, ${Object.keys(groups.spacing).length} spacing steps, ${Object.keys(components).length} components.`);
} else if (mode === undefined) {
  process.stdout.write(frontMatter);
} else {
  console.error(`Unknown argument ${mode}; expected --write, --check, or nothing.`);
  process.exit(2);
}
