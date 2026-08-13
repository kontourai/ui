import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

const css =
  readFileSync(path.join(root, "tokens/tokens.css"), "utf8") +
  readFileSync(path.join(root, "tokens/themes.css"), "utf8");

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

function relativeLuminance(hex) {
  let value = hex.slice(1);
  if (value.length === 3) value = [...value].map((c) => c + c).join("");
  const channel = (offset) => {
    const c = Number.parseInt(value.slice(offset, offset + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
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

const failures = [];
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
  `Kontour UI contrast check passed: ${checked} theme/pair combinations meet their thresholds.`,
);
