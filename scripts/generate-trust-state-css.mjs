// Generates react/trust-state.css, the standalone trust-state chip stylesheet
// (@kontourai/ui/trust-state.css), from the chip rules in react/styles.css.
//
// react/styles.css stays the single source: every token, contrast, and design
// check scans it, and the full stylesheet keeps styling k-trust-state and the
// React TrustState. The standalone file is a verbatim copy of its trust-state
// rules, for consumers that render the chip as an HTML string and include only
// the tokens plus these rules.
//
//   node scripts/generate-trust-state-css.mjs            print the generated stylesheet
//   node scripts/generate-trust-state-css.mjs --write    rewrite react/trust-state.css
//   node scripts/generate-trust-state-css.mjs --check    exit 1 when react/trust-state.css drifted
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";

process.on("uncaughtException", (error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = "react/styles.css";
const TARGET = "react/trust-state.css";
const read = (file) => readFileSync(path.join(root, file), "utf8").replace(/\r\n?/g, "\n");

// A chip rule is one whose every selector starts at a .trust-state class
// (.trust-state, .trust-state__chip, .trust-state--verified .trust-state__chip).
// A trust-state selector anywhere else (mixed into another rule, nested in an
// at-rule, or scoped under another class) cannot be copied faithfully by this
// extraction, so it is a contract violation rather than something to skip.
const CHIP_SELECTOR = /^\.trust-state(?:--[a-z]+|__[a-z]+)?(?=[\s.:[>+~]|$)/;
const MENTIONS = /trust-state/;
// CSS escapes (`.trust\-state`, `.trust\2d state`) name the same class, so a
// selector is matched on its unescaped text. An escaped chip selector then
// fails CHIP_SELECTOR and throws below instead of being skipped.
const unescapeCss = (text) => text.replace(/\\(?:([0-9a-fA-F]{1,6})\s?|(.))/g, (_, hex, char) => (hex ? String.fromCodePoint(parseInt(hex, 16)) : char));
const mentions = (text) => MENTIONS.test(unescapeCss(text));
const TOKEN_SOURCES = ["tokens/tokens.css", "tokens/themes.css"];

// The copy holds top-level rules only, so anything a copied declaration needs
// from elsewhere would be silently missing from it. Refuse instead:
// - an animation, since no @keyframes is copied;
// - a var(--x) that neither the token files nor the copied rules define.
function assertSelfContained(picked, tokenSheets) {
  const defined = new Set();
  const collect = (sheet) => sheet.walkDecls(/^--/, (decl) => { defined.add(decl.prop); });
  tokenSheets.forEach(collect);
  picked.forEach((node) => { if (node.type === "rule") collect(node); });
  for (const node of picked) {
    if (node.type !== "rule") continue;
    node.walkDecls((decl) => {
      if (/^(?:-webkit-)?animation(?:-name)?$/i.test(decl.prop) && !/^none$/i.test(decl.value.trim())) {
        throw new Error(`${SOURCE} ${node.selector}: ${decl.prop}: ${decl.value} needs @keyframes, which ${TARGET} does not copy. Keep trust-state rules free of animations, or extend scripts/generate-trust-state-css.mjs.`);
      }
      for (const [, name] of decl.value.matchAll(/var\(\s*(--[\w-]+)/g)) {
        if (!defined.has(name)) throw new Error(`${SOURCE} ${node.selector}: ${decl.prop} reads ${name}, which ${TOKEN_SOURCES.join(" and ")} and the copied rules do not define, so ${TARGET} would not carry it.`);
      }
    });
  }
}

export function trustStateCss(source, tokenSources = TOKEN_SOURCES.map(read)) {
  const sheet = postcss.parse(source, { from: SOURCE });
  const isChipRule = (node) => {
    if (node.type !== "rule" || !mentions(node.selector)) return false;
    const chip = node.selectors.filter((selector) => CHIP_SELECTOR.test(selector));
    if (chip.length !== node.selectors.length) throw new Error(`${SOURCE} ${node.selector}: every selector of a trust-state rule must start at a .trust-state class, so ${TARGET} can copy it.`);
    return true;
  };
  sheet.walk((node) => {
    const selector = node.type === "rule" ? node.selector : node.type === "atrule" ? node.params : "";
    if (node.parent !== sheet && mentions(selector)) throw new Error(`${SOURCE}: a trust-state rule inside ${node.parent.type === "atrule" ? `@${node.parent.name}` : "a nested block"} cannot be copied to ${TARGET}.`);
  });

  const nodes = sheet.nodes;
  const picked = [];
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (isChipRule(node)) {
      picked.push(node);
    } else if (node.type === "comment") {
      // A comment belongs to the chip rules when the next rule after it is one.
      let next = index + 1;
      while (nodes[next]?.type === "comment") next += 1;
      if (nodes[next] && isChipRule(nodes[next])) picked.push(node);
    }
  }
  if (!picked.some((node) => node.type === "rule")) throw new Error(`${SOURCE} has no .trust-state rules.`);
  assertSelfContained(picked, tokenSources.map((css, index) => postcss.parse(css, { from: TOKEN_SOURCES[index] })));

  return [
    `/* GENERATED by scripts/generate-trust-state-css.mjs from the trust-state rules in ${SOURCE}.`,
    "   Do not edit by hand: change react/styles.css, then run",
    "   `node scripts/generate-trust-state-css.mjs --write`.",
    "   Needs the --k-* tokens (@kontourai/ui/tokens.css) on the page. */",
    "",
    // Each node keeps the whitespace it had before it in the source, so the
    // copied block reads exactly as it does in react/styles.css.
    picked.map((node, index) => (index ? node.raws.before : "") + node.toString()).join(""),
    "",
  ].join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const generated = trustStateCss(read(SOURCE));
  const mode = process.argv[2];
  if (mode === "--write") {
    writeFileSync(path.join(root, TARGET), generated);
    console.log(`Wrote ${TARGET}.`);
  } else if (mode === "--check") {
    let current = "";
    try { current = read(TARGET); } catch { /* missing counts as drift */ }
    if (current !== generated) {
      console.error(`${TARGET} does not match the trust-state rules in ${SOURCE}. Run: node scripts/generate-trust-state-css.mjs --write`);
      process.exit(1);
    }
    console.log(`${TARGET} matches the trust-state rules in ${SOURCE}.`);
  } else if (mode === undefined) {
    process.stdout.write(generated);
  } else {
    throw new Error(`Unknown option ${mode}; use --write or --check.`);
  }
}
