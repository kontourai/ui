// @kontourai/ui/contrast — WCAG contrast for the brand slot, for runtimes that
// apply a white-label theme from data instead of a reviewed stylesheet.
//
// Dependency-free and environment-free: no imports, no DOM, no Node APIs, so it
// runs unchanged in a browser, a worker, or a Node server. scripts/check-contrast.mjs
// imports these functions and pairs, so the package's own gate and a runtime's
// validator rate a theme the same way.

/**
 * Accepted colour syntax: `#rgb` or `#rrggbb`, hex digits in either case,
 * nothing else — no surrounding whitespace, no alpha (`#rgba`, `#rrggbbaa`),
 * no keywords, no `rgb()`/`hsl()`/`color-mix()`/`var()`. A colour with alpha
 * has no contrast of its own (it depends on what shows through), and a
 * function or keyword would need a CSS engine to resolve, so they are
 * rejected rather than approximated.
 */
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isHexColor(value) {
  return typeof value === "string" && HEX_COLOR.test(value);
}

function channels(hex) {
  if (!isHexColor(hex)) {
    throw new TypeError(`Expected a #rgb or #rrggbb colour, got ${JSON.stringify(hex)}.`);
  }
  let value = hex.slice(1);
  if (value.length === 3) value = [...value].map((c) => c + c).join("");
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255);
}

/** WCAG 2.x relative luminance of a `#rgb` / `#rrggbb` colour. Throws on any other input. */
export function relativeLuminance(hex) {
  const [r, g, b] = channels(hex).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio (1 to 21) between two `#rgb` / `#rrggbb` colours. Order does not matter. */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** The properties a white-label theme may set. Everything else is rejected. */
export const BRAND_SLOT_PROPERTIES = Object.freeze([
  "--k-brand",
  "--k-brand-contrast",
  "--k-action",
  "--k-action-contrast",
  "--k-focus",
]);

/**
 * The role pairs that involve a brand-slot property, with the minimum ratio
 * check:contrast applies to every shipped theme and mode. 4.5 is WCAG AA for
 * text; 3 is AA for non-text UI (a focus ring, a checked control).
 */
export const BRAND_SLOT_PAIRS = Object.freeze(
  [
    ["--k-action-contrast", "--k-action", 4.5, "primary-action text on its fill"],
    ["--k-action", "--k-panel", 3.0, "checked controls and primary fills as UI components"],
    ["--k-focus", "--k-bg", 3.0, "focus ring on the page"],
    ["--k-focus", "--k-panel", 3.0, "focus ring on panels"],
    ["--k-brand", "--k-panel", 4.5, "brand as text (eyebrows, panel counts) on panels"],
    ["--k-brand-contrast", "--k-brand", 4.5, "the brand slot's own text-on-brand pair"],
  ].map(([foreground, background, minimum, purpose]) => Object.freeze({ foreground, background, minimum, purpose })),
);

const theme = (dark, light) => Object.freeze({ dark: Object.freeze(dark), light: Object.freeze(light) });
const slot = (bg, panel, brand, brandContrast, action, actionContrast, focus) => ({
  "--k-bg": bg,
  "--k-panel": panel,
  "--k-brand": brand,
  "--k-brand-contrast": brandContrast,
  "--k-action": action,
  "--k-action-contrast": actionContrast,
  "--k-focus": focus,
});

/**
 * The shipped values of the brand slot and the surfaces it is rated against,
 * per theme and mode, as the cascade resolves an element carrying the theme
 * class and data-theme (`default` is no theme class). check:contrast fails if
 * these drift from tokens/tokens.css and tokens/themes.css.
 */
export const SHIPPED_THEMES = Object.freeze({
  default: theme(
    slot("#0a0e13", "#111824", "#5ce0c6", "#06080b", "#5ce0c6", "#06080b", "#5ce0c6"),
    slot("#f5f4ef", "#ffffff", "#0e7c64", "#ffffff", "#0e7c64", "#ffffff", "#0e7c64"),
  ),
  console: theme(
    slot("#11120f", "#191b16", "#c9ff4a", "#11120f", "#c9ff4a", "#11120f", "#c9ff4a"),
    slot("#f3f5eb", "#fbfcf7", "#6c9400", "#ffffff", "#6c9400", "#11120f", "#6c9400"),
  ),
  flow: theme(
    slot("#0a0e13", "#111824", "#2f88a6", "#06080b", "#2f88a6", "#06080b", "#2f88a6"),
    slot("#f5f4ef", "#ffffff", "#1f6f88", "#ffffff", "#1f6f88", "#ffffff", "#1f6f88"),
  ),
  station: theme(
    slot("#0a0e13", "#111824", "#9364ff", "#06080b", "#7c3aed", "#ffffff", "#9364ff"),
    slot("#f5f4ef", "#ffffff", "#7c3aed", "#ffffff", "#7c3aed", "#ffffff", "#7c3aed"),
  ),
  surface: theme(
    slot("#0a0e13", "#111824", "#14a37a", "#06080b", "#14a37a", "#06080b", "#14a37a"),
    slot("#f5f4ef", "#ffffff", "#0f6b52", "#ffffff", "#0f6b52", "#ffffff", "#0f6b52"),
  ),
  survey: theme(
    slot("#06080b", "#111824", "#5ce0c6", "#06080b", "#5ce0c6", "#06080b", "#5ce0c6"),
    slot("#06080b", "#ffffff", "#16806f", "#ffffff", "#16806f", "#ffffff", "#16806f"),
  ),
});

export const MODES = Object.freeze(["dark", "light"]);

const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const isRecord = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));
const show = (value) => {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
};

/**
 * Validate a white-label override of the brand slot against a shipped theme.
 *
 * `base` names the shipped theme the override is applied over (a key of
 * SHIPPED_THEMES); an unknown base is a programming error and throws.
 * `overrides` is untrusted data: `{ dark?: {...}, light?: {...} }`, each a map
 * of brand-slot properties to `#rgb`/`#rrggbb` values. Every problem in it is
 * returned as a violation; an empty list means the override may be applied.
 *
 * A mode's pairs are rated on the base values with that mode's overrides laid
 * on top, and only pairs that include an overridden property are rated: the
 * validator judges the override, not the shipped theme underneath it.
 */
export function validateBrandOverride({ base, overrides } = {}) {
  if (typeof base !== "string" || !own(SHIPPED_THEMES, base)) {
    throw new TypeError(`base must be one of ${Object.keys(SHIPPED_THEMES).join(", ")}; got ${show(base)}.`);
  }
  const violations = [];
  if (!isRecord(overrides)) {
    violations.push({ kind: "invalid-shape", message: `overrides must be an object keyed by mode (${MODES.join(", ")}); got ${show(overrides)}.` });
    return violations;
  }
  for (const mode of Object.keys(overrides)) {
    if (!MODES.includes(mode)) violations.push({ kind: "invalid-shape", mode, message: `Unknown mode ${show(mode)}; expected ${MODES.join(" or ")}.` });
  }
  for (const mode of MODES) {
    if (!own(overrides, mode)) continue;
    const values = overrides[mode];
    if (!isRecord(values)) {
      violations.push({ kind: "invalid-shape", mode, message: `overrides.${mode} must be an object of brand-slot properties; got ${show(values)}.` });
      continue;
    }
    const accepted = {};
    for (const property of Object.keys(values)) {
      const value = values[property];
      if (!BRAND_SLOT_PROPERTIES.includes(property)) {
        violations.push({ kind: "disallowed-property", mode, property, message: `${mode}: ${show(property)} is not a brand-slot property (${BRAND_SLOT_PROPERTIES.join(", ")}).` });
      } else if (!isHexColor(value)) {
        violations.push({ kind: "invalid-value", mode, property, value, message: `${mode}: ${property} must be a #rgb or #rrggbb colour; got ${show(value)}.` });
      } else {
        accepted[property] = value;
      }
    }
    if (own(values, "--k-action") !== own(values, "--k-action-contrast")) {
      const missing = own(values, "--k-action") ? "--k-action-contrast" : "--k-action";
      violations.push({ kind: "unpaired-action", mode, property: missing, message: `${mode}: --k-action and --k-action-contrast are overridden as a pair; ${missing} is missing.` });
    }
    const resolved = { ...SHIPPED_THEMES[base][mode], ...accepted };
    for (const { foreground, background, minimum, purpose } of BRAND_SLOT_PAIRS) {
      const overridden = [foreground, background].filter((property) => own(values, property));
      // Nothing overridden: the shipped pair is the kit's own concern. Invalid
      // member: already reported, and rating the base value instead would judge
      // something the caller did not send.
      if (overridden.length === 0 || overridden.some((property) => !own(accepted, property))) continue;
      const ratio = contrastRatio(resolved[foreground], resolved[background]);
      if (ratio < minimum) {
        violations.push({
          kind: "contrast",
          mode,
          property: overridden[0],
          pair: [foreground, background],
          ratio,
          minimum,
          message: `${mode}: ${foreground} ${resolved[foreground]} on ${background} ${resolved[background]} = ${ratio.toFixed(2)}:1 (needs ${minimum}:1 — ${purpose}).`,
        });
      }
    }
  }
  return violations;
}
