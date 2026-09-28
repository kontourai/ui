import assert from "node:assert/strict";
import { test } from "node:test";
// Through the package's own exports map, as a consumer imports it.
import {
  BRAND_SLOT_PROPERTIES,
  MODES,
  SHIPPED_THEMES,
  contrastRatio,
  isHexColor,
  validateBrandOverride,
} from "@kontourai/ui/contrast";

const kinds = (violations) => violations.map((violation) => violation.kind);

test("contrastRatio follows the WCAG definition", () => {
  assert.equal(contrastRatio("#000000", "#ffffff"), 21);
  assert.equal(contrastRatio("#ffffff", "#000"), 21);
  assert.equal(contrastRatio("#abc", "#aabbcc"), 1);
  assert.equal(contrastRatio("#767676", "#FFFFFF").toFixed(2), "4.54");
});

test("only #rgb and #rrggbb are colours", () => {
  for (const value of ["#abc", "#ABCDEF", "#0e7c64"]) assert.equal(isHexColor(value), true, value);
  for (const value of ["#abcd", "#aabbccdd", "#ab", "abc", " #abc", "#abc ", "#ggg", "red", "rgb(0 0 0)", "var(--k-brand)", "red; background:url(x)", "", null, 0x123456]) {
    assert.equal(isHexColor(value), false, String(value));
  }
  assert.throws(() => contrastRatio("red", "#fff"), TypeError);
  assert.throws(() => contrastRatio("#fff", "#ffff"), TypeError);
});

test("a pale action pair is rejected", () => {
  const violations = validateBrandOverride({
    base: "flow",
    overrides: { dark: { "--k-action": "#a8e6d8", "--k-action-contrast": "#ffffff" } },
  });
  assert.equal(violations.length, 1, JSON.stringify(violations));
  const [violation] = violations;
  assert.equal(violation.kind, "contrast");
  assert.equal(violation.mode, "dark");
  assert.deepEqual(violation.pair, ["--k-action-contrast", "--k-action"]);
  assert.equal(violation.minimum, 4.5);
  assert.ok(violation.ratio < 1.5, `ratio ${violation.ratio}`);
});

test("a focus colour is rated against both the page and the panel", () => {
  // #3a3f45 on the dark page and panel is well under 3:1.
  const violations = validateBrandOverride({ base: "default", overrides: { dark: { "--k-focus": "#3a3f45" } } });
  assert.deepEqual(violations.map((violation) => violation.pair), [["--k-focus", "--k-bg"], ["--k-focus", "--k-panel"]]);
  assert.ok(violations.every((violation) => violation.minimum === 3));
});

test("brand as text is rated on the panel of the chosen mode", () => {
  // Readable on the dark panel, unreadable on the light one.
  const brand = { "--k-brand": "#f0a868" };
  assert.deepEqual(validateBrandOverride({ base: "flow", overrides: { dark: brand } }), []);
  const light = validateBrandOverride({ base: "flow", overrides: { light: brand } });
  assert.deepEqual(light.map((violation) => violation.pair), [["--k-brand", "--k-panel"], ["--k-brand-contrast", "--k-brand"]]);
});

// Shipped values that already fail a brand-slot pair, recorded as
// KNOWN_ROLE_FAILURES in scripts/check-contrast.mjs. Pinned here, not read
// from there, so the validator is checked against the list rather than with it.
const KNOWN_SHIPPED_FAILURES = [
  "console:light --k-brand on --k-panel",
  "console:light --k-brand-contrast on --k-brand",
  "flow:dark --k-brand on --k-panel",
];

test("every shipped theme's own values are accepted (except the recorded brand exceptions)", () => {
  const seen = [];
  for (const [base, modes] of Object.entries(SHIPPED_THEMES)) {
    for (const mode of MODES) {
      const slot = Object.fromEntries(BRAND_SLOT_PROPERTIES.map((property) => [property, modes[mode][property]]));
      for (const violation of validateBrandOverride({ base, overrides: { [mode]: slot } })) {
        assert.equal(violation.kind, "contrast", violation.message);
        seen.push(`${base}:${mode} ${violation.pair[0]} on ${violation.pair[1]}`);
      }
    }
  }
  assert.deepEqual(seen.sort(), KNOWN_SHIPPED_FAILURES);
  assert.deepEqual(Object.keys(SHIPPED_THEMES).sort(), ["console", "default", "flow", "station", "surface", "survey"]);
});

test("the consumer guide's example override is accepted", () => {
  const overrides = {
    dark: { "--k-brand": "#f0a868", "--k-action": "#f0a868", "--k-action-contrast": "#06080b", "--k-focus": "#f0a868" },
    light: { "--k-brand": "#9a4418", "--k-action": "#9a4418", "--k-action-contrast": "#ffffff", "--k-focus": "#9a4418" },
  };
  assert.deepEqual(validateBrandOverride({ base: "flow", overrides }), []);
});

test("unknown and non-allowlisted keys are rejected", () => {
  const overrides = JSON.parse('{"dark":{"--k-bg":"#000000","color":"#000000","--k-brandx":"#000000","__proto__":{"--k-brand":"#000"}}}');
  const violations = validateBrandOverride({ base: "station", overrides });
  assert.deepEqual(kinds(violations), ["disallowed-property", "disallowed-property", "disallowed-property", "disallowed-property"]);
  assert.deepEqual(violations.map((violation) => violation.property), ["--k-bg", "color", "--k-brandx", "__proto__"]);
});

test("malformed values are rejected, not guessed", () => {
  for (const value of ["red; background:url(x)", "rgb(0, 0, 0)", "#aabbccdd", "#abcd", " #ffffff", "var(--k-brand)", 123, null]) {
    const violations = validateBrandOverride({ base: "station", overrides: { light: { "--k-brand": value } } });
    assert.deepEqual(kinds(violations), ["invalid-value"], `${JSON.stringify(value)}: ${JSON.stringify(violations)}`);
    assert.equal(violations[0].property, "--k-brand");
  }
});

test("action and action-contrast are overridden as a pair", () => {
  // A dark fill that would pass with the shipped white text is still rejected alone.
  const fillOnly = validateBrandOverride({ base: "station", overrides: { light: { "--k-action": "#5b21b6" } } });
  assert.deepEqual(kinds(fillOnly), ["unpaired-action"]);
  assert.equal(fillOnly[0].property, "--k-action-contrast");
  const textOnly = validateBrandOverride({ base: "station", overrides: { dark: { "--k-action-contrast": "#ffffff" } } });
  assert.deepEqual(kinds(textOnly), ["unpaired-action"]);
  assert.equal(textOnly[0].property, "--k-action");
  assert.deepEqual(validateBrandOverride({ base: "station", overrides: { light: { "--k-action": "#5b21b6", "--k-action-contrast": "#ffffff" } } }), []);
});

test("the override's shape is checked; an unknown base throws", () => {
  for (const overrides of [null, "#fff", [], undefined]) {
    assert.deepEqual(kinds(validateBrandOverride({ base: "flow", overrides })), ["invalid-shape"], JSON.stringify(overrides));
  }
  assert.deepEqual(kinds(validateBrandOverride({ base: "flow", overrides: { dim: {} } })), ["invalid-shape"]);
  assert.deepEqual(kinds(validateBrandOverride({ base: "flow", overrides: { dark: "#fff" } })), ["invalid-shape"]);
  assert.deepEqual(validateBrandOverride({ base: "flow", overrides: {} }), []);
  assert.throws(() => validateBrandOverride({ base: "acme", overrides: {} }), TypeError);
  assert.throws(() => validateBrandOverride({ base: "toString", overrides: {} }), TypeError);
});

test("the exported data cannot be mutated by a consumer", () => {
  assert.ok(Object.isFrozen(SHIPPED_THEMES.flow.dark));
  assert.ok(Object.isFrozen(BRAND_SLOT_PROPERTIES));
});
