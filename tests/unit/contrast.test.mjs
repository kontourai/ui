import assert from "node:assert/strict";
import { test } from "node:test";
// Through the package's own exports map, as a consumer imports it.
import {
  BRAND_SLOT_PAIRS,
  BRAND_SLOT_PROPERTIES,
  MODES,
  SHIPPED_THEMES,
  contrastRatio,
  isHexColor,
  validateBrandOverride,
} from "@kontourai/ui/contrast";

const kinds = (violations) => violations.map((violation) => violation.kind);
// Most tests only need the violations.
const violationsOf = (input) => validateBrandOverride(input).violations;

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
  const violations = violationsOf({
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
  const violations = violationsOf({ base: "default", overrides: { dark: { "--k-focus": "#3a3f45" } } });
  assert.deepEqual(violations.map((violation) => violation.pair), [["--k-focus", "--k-bg"], ["--k-focus", "--k-panel"]]);
  assert.ok(violations.every((violation) => violation.minimum === 3));
});

test("brand as text is rated on the panel of the chosen mode", () => {
  // Readable on the dark panel, unreadable on the light one.
  const brand = { "--k-brand": "#f0a868" };
  assert.deepEqual(violationsOf({ base: "flow", overrides: { dark: brand } }), []);
  const light = violationsOf({ base: "flow", overrides: { light: brand } });
  assert.deepEqual(light.map((violation) => violation.pair), [["--k-brand", "--k-panel"], ["--k-brand", "--k-bg"], ["--k-brand-contrast", "--k-brand"]]);
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
      for (const violation of violationsOf({ base, overrides: { [mode]: slot } })) {
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
  assert.deepEqual(violationsOf({ base: "flow", overrides }), []);
});

test("unknown and non-allowlisted keys are rejected", () => {
  const overrides = JSON.parse('{"dark":{"--k-bg":"#000000","color":"#000000","--k-brandx":"#000000","__proto__":{"--k-brand":"#000"}}}');
  const violations = violationsOf({ base: "station", overrides });
  assert.deepEqual(kinds(violations), ["disallowed-property", "disallowed-property", "disallowed-property", "disallowed-property"]);
  assert.deepEqual(violations.map((violation) => violation.property), ["--k-bg", "color", "--k-brandx", "__proto__"]);
  assert.equal(validateBrandOverride({ base: "station", overrides }).accepted.dark, undefined);
});

test("malformed values are rejected, not guessed", () => {
  for (const value of ["red; background:url(x)", "rgb(0, 0, 0)", "#aabbccdd", "#abcd", " #ffffff", "var(--k-brand)", 123, null]) {
    const violations = violationsOf({ base: "station", overrides: { light: { "--k-brand": value } } });
    assert.deepEqual(kinds(violations), ["invalid-value"], `${JSON.stringify(value)}: ${JSON.stringify(violations)}`);
    assert.equal(violations[0].property, "--k-brand");
  }
});

test("action and action-contrast are overridden as a pair", () => {
  // A dark fill that would pass with the shipped white text is still rejected alone.
  const fillOnly = violationsOf({ base: "station", overrides: { light: { "--k-action": "#5b21b6" } } });
  assert.deepEqual(kinds(fillOnly), ["unpaired-action"]);
  assert.equal(fillOnly[0].property, "--k-action-contrast");
  const textOnly = violationsOf({ base: "station", overrides: { dark: { "--k-action-contrast": "#ffffff" } } });
  assert.deepEqual(kinds(textOnly), ["unpaired-action"]);
  assert.equal(textOnly[0].property, "--k-action");
  assert.deepEqual(violationsOf({ base: "station", overrides: { light: { "--k-action": "#5b21b6", "--k-action-contrast": "#ffffff" } } }), []);
});

test("the override's shape is checked; an unknown base throws", () => {
  for (const overrides of [null, "#fff", [], undefined]) {
    assert.deepEqual(kinds(violationsOf({ base: "flow", overrides })), ["invalid-shape"], JSON.stringify(overrides));
  }
  assert.deepEqual(kinds(violationsOf({ base: "flow", overrides: { dim: {} } })), ["invalid-shape"]);
  assert.deepEqual(kinds(violationsOf({ base: "flow", overrides: { dark: "#fff" } })), ["invalid-shape"]);
  assert.deepEqual(violationsOf({ base: "flow", overrides: {} }), []);
  assert.throws(() => validateBrandOverride({ base: "acme", overrides: {} }), TypeError);
  assert.throws(() => validateBrandOverride({ base: "toString", overrides: {} }), TypeError);
});

test("the exported data cannot be mutated by a consumer", () => {
  assert.ok(Object.isFrozen(SHIPPED_THEMES));
  assert.ok(Object.isFrozen(SHIPPED_THEMES.flow));
  assert.ok(Object.isFrozen(SHIPPED_THEMES.flow.dark));
  assert.ok(Object.isFrozen(BRAND_SLOT_PROPERTIES));
  assert.ok(Object.isFrozen(BRAND_SLOT_PAIRS));
  assert.ok(BRAND_SLOT_PAIRS.every((pair) => Object.isFrozen(pair)));
});

test("brand is rated as a UI component on the page", () => {
  // Near-black on the survey dark page (1.06:1). Survey light used to keep
  // this page too (ui#81); every shipped page is now darker than its panel in
  // dark mode and lighter in light mode, so the page pair fails beside the
  // panel pair rather than alone.
  const violations = violationsOf({ base: "survey", overrides: { dark: { "--k-brand": "#111111" } } });
  const page = violations.find((violation) => violation.pair.join(" ") === "--k-brand --k-bg");
  assert.ok(page, JSON.stringify(violations.map((violation) => violation.pair)));
  assert.equal(page.minimum, 3);
  assert.ok(page.ratio < 1.1, `ratio ${page.ratio}`);
  // Survey light now rates an override against the light page (ui#81).
  assert.equal(SHIPPED_THEMES.survey.light["--k-bg"], "#f5f4ef");
  assert.ok(BRAND_SLOT_PAIRS.some((pair) => pair.foreground === "--k-brand" && pair.background === "--k-bg" && pair.minimum === 3));
});

test("a Map, a class instance, or a non-object input is rejected, not inspected", () => {
  class Slot {
    constructor() {
      this["--k-brand"] = "#5ce0c6";
    }
  }
  assert.deepEqual(kinds(violationsOf({ base: "flow", overrides: new Map([["dark", { "--k-brand": "#5ce0c6" }]]) })), ["invalid-shape"]);
  assert.deepEqual(kinds(violationsOf({ base: "flow", overrides: { dark: new Map([["--k-brand", "#5ce0c6"]]) } })), ["invalid-shape"]);
  assert.deepEqual(kinds(violationsOf({ base: "flow", overrides: { dark: new Slot() } })), ["invalid-shape"]);
  for (const input of [null, undefined, "flow", []]) {
    const result = validateBrandOverride(input);
    assert.deepEqual(kinds(result.violations), ["invalid-shape"], String(input));
    assert.deepEqual(Object.keys(result.accepted), []);
  }
});

test("accepted holds exactly the validated values, in fresh null-prototype objects", () => {
  let reads = 0;
  const light = { "--k-brand": "#9a4418" };
  Object.defineProperty(light, "--k-focus", { enumerable: true, get: () => (reads++ === 0 ? "#9a4418" : "#ffffff") });
  const dark = { "--k-action": "#f0a868", "--k-action-contrast": "#06080b" };
  const { violations, accepted } = validateBrandOverride({ base: "flow", overrides: { dark, light } });
  assert.deepEqual(violations, []);
  assert.deepEqual({ ...accepted.light }, { "--k-brand": "#9a4418", "--k-focus": "#9a4418" });
  assert.deepEqual({ ...accepted.dark }, dark);
  assert.equal(reads, 1, "each input value is read once");
  assert.equal(Object.getPrototypeOf(accepted), null);
  assert.equal(Object.getPrototypeOf(accepted.light), null);
  assert.notEqual(accepted.light, light);
  assert.ok(Object.isFrozen(accepted) && Object.isFrozen(accepted.light) && Object.isFrozen(accepted.dark));
});

test("accepted is empty when any part of the override is rejected", () => {
  // A good light mode does not survive a rejected (pale) dark action pair.
  const light = { "--k-brand": "#9a4418", "--k-focus": "#9a4418" };
  const dark = { "--k-action": "#a8e6d8", "--k-action-contrast": "#ffffff" };
  const { violations, accepted } = validateBrandOverride({ base: "flow", overrides: { dark, light } });
  assert.deepEqual(violations.map((violation) => `${violation.mode} ${violation.kind}`), ["dark contrast"]);
  assert.deepEqual(Object.keys(accepted), []);
  assert.equal(Object.getPrototypeOf(accepted), null);
  assert.ok(Object.isFrozen(accepted));
  // An unknown mode key alone empties it too.
  assert.deepEqual(Object.keys(validateBrandOverride({ base: "flow", overrides: { light, dim: {} } }).accepted), []);
});

test("echoed caller data is bounded", () => {
  const long = `#${"f".repeat(500)}`;
  const [invalid] = violationsOf({ base: "flow", overrides: { dark: { "--k-brand": long } } });
  assert.ok(invalid.message.length < 200, invalid.message);
  assert.ok(invalid.message.includes("…"));
  const [unknown] = violationsOf({ base: "flow", overrides: { dark: { ["x".repeat(500)]: "#fff" } } });
  assert.equal(unknown.property.length, 65);
  assert.ok(unknown.message.length < 200);
});
