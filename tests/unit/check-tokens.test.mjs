import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

// Runs check:tokens as a child process against a copy of the repo with one
// injected violation, so each rule's rejection path keeps running (ui#89,
// ui#92). The copy holds only what the check reads; node_modules is linked.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const STYLES = "react/styles.css";
const pristine = readFileSync(path.join(root, STYLES), "utf8");
const work = mkdtempSync(path.join(tmpdir(), "kui-check-tokens-"));
after(() => rmSync(work, { recursive: true, force: true }));

let copies = 0;
function runCheck(styles) {
  const dir = path.join(work, String(copies++));
  for (const entry of ["scripts", "tokens", "react/src/trust-states.ts"]) cpSync(path.join(root, entry), path.join(dir, entry), { recursive: true });
  writeFileSync(path.join(dir, STYLES), styles);
  symlinkSync(path.join(root, "node_modules"), path.join(dir, "node_modules"), "dir");
  const result = spawnSync(process.execPath, [path.join(dir, "scripts/check-tokens.mjs")], { encoding: "utf8" });
  // The thrown message is the first "Error: " line of the uncaught exception.
  const message = /^Error: (.*)$/m.exec(result.stderr)?.[1] ?? null;
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, message };
}

// Replaces exactly one occurrence, so an injection whose anchor moved fails
// here instead of silently testing the unmodified stylesheet.
function replaceOnce(text, from, to) {
  const at = text.indexOf(from);
  assert.notEqual(at, -1, `anchor not found: ${from}`);
  assert.equal(text.indexOf(from, at + 1), -1, `anchor not unique: ${from}`);
  return text.slice(0, at) + to + text.slice(at + from.length);
}
const chipRule = (state) => `.trust-state--${state} .trust-state__chip {
  color: var(--k-trust-${state});
  background: var(--k-trust-${state}-fill);
  border-color: var(--k-trust-${state});
  border-style: var(--k-trust-${state}-line);
}`;
const editChip = (state, body) => replaceOnce(pristine, chipRule(state), `.trust-state--${state} .trust-state__chip {\n${body}\n}`);
const append = (css) => `${pristine}\n${css}\n`;

test("the shipped stylesheet passes (control)", () => {
  const result = runCheck(pristine);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /token smoke check passed/);
});

// Each case: the stylesheet with one violation, and what the error must name.
const cases = [
  // ui#89: each state's chip rule sets its paint to exactly its own tokens.
  {
    name: "stale's line token moved to outline-style",
    styles: editChip("stale", "  color: var(--k-trust-stale);\n  background: var(--k-trust-stale-fill);\n  border-color: var(--k-trust-stale);\n  outline-style: var(--k-trust-stale-line);"),
    expect: { selector: ".trust-state--stale .trust-state__chip", says: /must set border-style: var\(--k-trust-stale-line\)/ },
  },
  {
    name: "revoked's border-style removed",
    styles: editChip("revoked", "  color: var(--k-trust-revoked);\n  background: var(--k-trust-revoked-fill);\n  border-color: var(--k-trust-revoked);"),
    expect: { selector: ".trust-state--revoked .trust-state__chip", says: /must set border-style/ },
  },
  {
    name: "superseded's ink and fill swapped",
    styles: editChip("superseded", "  color: var(--k-trust-superseded-fill);\n  background: var(--k-trust-superseded);\n  border-color: var(--k-trust-superseded);\n  border-style: var(--k-trust-superseded-line);"),
    expect: { selector: ".trust-state--superseded .trust-state__chip", says: /color: var\(--k-trust-superseded-fill\) must be exactly var\(--k-trust-superseded\)/ },
  },
  {
    name: "verified's border-color reads a neutral line token",
    styles: editChip("verified", "  color: var(--k-trust-verified);\n  background: var(--k-trust-verified-fill);\n  border-color: var(--k-line-strong);\n  border-style: var(--k-trust-verified-line);"),
    expect: { selector: ".trust-state--verified .trust-state__chip", says: /border-color: var\(--k-line-strong\) must be exactly var\(--k-trust-verified\)/ },
  },
  {
    name: "unknown's chip rule adds a side longhand after border-style",
    styles: editChip("unknown", "  color: var(--k-trust-unknown);\n  background: var(--k-trust-unknown-fill);\n  border-color: var(--k-trust-unknown);\n  border-style: var(--k-trust-unknown-line);\n  border-top-style: dotted;"),
    expect: { selector: ".trust-state--unknown .trust-state__chip", says: /sets border-top-style/ },
  },
  {
    name: "a later rule overrides stale's line with a literal",
    styles: append(".trust-state--stale .trust-state__chip { border-style: dotted; }"),
    expect: { selector: ".trust-state--stale .trust-state__chip", says: /border-style: dotted must be exactly var\(--k-trust-stale-line\)/ },
  },
  {
    name: "an escaped state class overrides stale's line",
    styles: append(".trust\\-state--stale .trust-state__chip { border-style: dotted; }"),
    expect: { selector: ".trust\\-state--stale .trust-state__chip", says: /must be exactly var\(--k-trust-stale-line\)/ },
  },
  {
    name: "a same-specificity rule paints every chip",
    styles: append(".trust-state .trust-state__chip { border-style: dotted; }"),
    expect: { selector: ".trust-state .trust-state__chip", says: /only \.trust-state__chip and each state's one top-level/ },
  },
  {
    name: "a state's chip is repainted inside @media",
    styles: append("@media (min-width: 1px) { .trust-state--stale .trust-state__chip { border-style: solid; } }"),
    expect: { selector: ".trust-state--stale .trust-state__chip (inside @media (min-width: 1px))", says: /may paint the chip/ },
  },
  {
    name: "the base chip paint made !important",
    styles: replaceOnce(pristine, "  border-style: dotted;\n", "  border-style: dotted !important;\n"),
    expect: { selector: ".trust-state__chip", says: /must not be !important/ },
  },
  // ui#92: basis rules are found by parsing the selector, not by substring.
  {
    name: "[data-basis-state] descendant reads a status tone",
    styles: append("[data-basis-state] span { color: var(--k-negative); }"),
    expect: { selector: "[data-basis-state] span", says: /reads --k-negative/ },
  },
  {
    name: "[data-code] reads a status tone",
    styles: append('[data-code="model"] { color: var(--k-negative); }'),
    expect: { selector: '[data-code="model"]', says: /reads --k-negative/ },
  },
  {
    name: "[class*=basis__facet] reads a status tone",
    styles: append('[class*="basis__facet"] { color: var(--k-negative); }'),
    expect: { selector: '[class*="basis__facet"]', says: /reads --k-negative/ },
  },
  {
    name: "an escaped .trust\\-basis__facet reads a status tone",
    styles: append(".trust\\-basis__facet { color: var(--k-negative); }"),
    expect: { selector: ".trust\\-basis__facet", says: /reads --k-negative/ },
  },
  {
    name: "the k-trust-basis element, in upper case, reads a trust ink",
    styles: append("K-TRUST-BASIS span { color: var(--k-trust-verified); }"),
    expect: { selector: "K-TRUST-BASIS span", says: /reads --k-trust-verified/ },
  },
  {
    name: "[data-basis-state] redefines the muted text token",
    styles: append("[data-basis-state] { --k-text-muted: var(--k-negative); }"),
    expect: { selector: "[data-basis-state]", says: /declares --k-text-muted/ },
  },
  {
    name: "[data-caveat] adds weight",
    styles: append("[data-caveat] { font-weight: 700; }"),
    expect: { selector: "[data-caveat]", says: /font-weight is not allowed/ },
  },
  {
    name: ":where([data-caveat=true]) adds weight",
    styles: append(':where([data-caveat="true"]) { font-weight: 700; }'),
    expect: { selector: ':where([data-caveat="true"])', says: /font-weight is not allowed/ },
  },
  {
    name: "a second data-caveat rule draws the underline on every facet",
    styles: append("[data-caveat] { text-decoration: var(--k-basis-caveat-decoration); }"),
    expect: { selector: "[data-caveat]", says: /the one rule that references data-caveat must be/ },
  },
];

for (const entry of cases) {
  test(`check:tokens rejects: ${entry.name}`, () => {
    assert.notEqual(entry.styles, pristine, "the injection changed nothing");
    const result = runCheck(entry.styles);
    assert.notEqual(result.status, 0, `check:tokens passed with the violation:\n${result.stdout}`);
    assert.ok(result.message, `no Error line in stderr:\n${result.stderr}`);
    assert.ok(result.message.startsWith(`react/styles.css ${entry.expect.selector}`), `wrong rule named: ${result.message}`);
    assert.match(result.message, entry.expect.says);
  });
}
