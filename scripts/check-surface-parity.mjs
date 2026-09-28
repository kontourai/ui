import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// The trust-state vocabulary is Surface's (owner decision, 2026-09-27): the
// states and their order must equal Surface's TRUST_STATUS_ORDER, and the
// default labels its TRUST_STATUS_LABELS. @kontourai/surface is an
// exact-pinned devDependency used only here; nothing shipped imports it
// (check:pack enforces that). Bumping that devDependency is how a Surface
// vocabulary change reaches Kontour UI: this check then fails until
// react/src/trust-states.ts follows, and check:tokens / check:contrast fail
// until every state in that list has its tokens and chip rule (they read the
// list from that source and require their pinned copies to match it).
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const surface = await import("@kontourai/surface");
const ui = await import(pathToFileURL(path.join(root, "dist/react/trust-states.js")).href);

assert.ok(Array.isArray(surface.TRUST_STATUS_ORDER), "@kontourai/surface no longer exports TRUST_STATUS_ORDER; update this check.");
assert.deepEqual(
  [...ui.trustStates],
  [...surface.TRUST_STATUS_ORDER],
  "trustStates (react/src/trust-states.ts) must equal Surface's TRUST_STATUS_ORDER, in order.",
);
const labels = surface.TRUST_STATUS_LABELS;
assert.ok(labels && typeof labels === "object", "@kontourai/surface no longer exports TRUST_STATUS_LABELS; update this check.");
assert.deepEqual(
  [...ui.trustStates],
  Object.keys(labels),
  "trustStates (react/src/trust-states.ts) must list Surface's TRUST_STATUS_LABELS keys in Surface's order.",
);
for (const state of ui.trustStates) {
  assert.equal(
    ui.trustStateLabels[state],
    labels[state],
    `trustStateLabels.${state} is "${ui.trustStateLabels[state]}" but Surface's TRUST_STATUS_LABELS.${state} is "${labels[state]}".`,
  );
}
console.log(`Surface parity check passed: ${ui.trustStates.length} trust states match @kontourai/surface TRUST_STATUS_ORDER and TRUST_STATUS_LABELS.`);

// Trust basis (ui#87). Surface owns the basis summary (claimBasisView in
// @kontourai/surface/display, first released in 3.3.0); Kontour UI renders the
// view and keeps a structural copy of its type. Three checks, all against the
// installed Surface:
// 1. tests/types/trust-basis-parity.ts: Kontour UI's TrustBasisView is exactly
//    Surface's (tsc, both directions).
// 2. The one basis wording Kontour UI owns, its fallback, is Surface's label
//    for `not-available`.
// 3. The fixture views the browser tests and gallery render are what
//    claimBasisView returns for the fixture inputs, so no test renders a view
//    Surface would not produce.
// PENDING: the repo's pnpm policy (minimumReleaseAge, 24 hours) cannot resolve
// Surface 3.3.0 until about 2026-09-28T23:00Z. Until the devDependency is
// bumped to 3.3.0 or later these checks are reported as pending, not passed;
// once the installed Surface is 3.3.0 or later they are mandatory, and a
// missing export fails instead of skipping. Pending has a hard deadline
// (PENDING_DEADLINE): after it, the old Surface fails this check, so the bump
// cannot be forgotten. The bump commit deletes the pending branch entirely.
const PENDING_DEADLINE = Date.parse("2026-09-29T12:00:00Z");
const require = createRequire(import.meta.url);
// The package's exports map hides package.json, so read the installed copy.
const installed = JSON.parse(readFileSync(path.join(root, "node_modules/@kontourai/surface/package.json"), "utf8")).version;
const [major, minor] = installed.split(".").map(Number);
if (major < 3 || (major === 3 && minor < 3)) {
  if (Date.now() > PENDING_DEADLINE) {
    throw new Error(
      `Trust-basis Surface parity has been pending past ${new Date(PENDING_DEADLINE).toISOString()}: installed @kontourai/surface ${installed} predates claimBasisView. ` +
        "Bump the @kontourai/surface devDependency to exactly 3.3.0 (pnpm add -D -E @kontourai/surface@3.3.0) and delete this pending branch (ui#87).",
    );
  }
  console.log(
    `Surface parity PENDING for the trust basis: installed @kontourai/surface ${installed} predates claimBasisView (3.3.0). ` +
      `Type parity, the fallback label, and the fixture views are not checked until the devDependency is bumped; this fails after ${new Date(PENDING_DEADLINE).toISOString()} (ui#87).`,
  );
} else {
  const tsc = require.resolve("typescript/bin/tsc");
  try {
    execFileSync(process.execPath, [tsc, "-p", path.join(root, "tests/types/tsconfig.json")], { cwd: root, encoding: "utf8", stdio: "pipe" });
  } catch (error) {
    throw new Error(`TrustBasisView (react/src/trust-basis.ts) no longer matches @kontourai/surface/display ${installed}:\n${error.stdout}${error.stderr}`);
  }

  const display = await import("@kontourai/surface/display");
  assert.equal(typeof display.claimBasisView, "function", `@kontourai/surface/display ${installed} does not export claimBasisView; update this check.`);
  assert.equal(typeof display.missingClaimBasisView, "function", `@kontourai/surface/display ${installed} does not export missingClaimBasisView; update this check.`);
  const basis = await import(pathToFileURL(path.join(root, "dist/react/trust-basis.js")).href);
  assert.equal(
    basis.TRUST_BASIS_FALLBACK_LABEL,
    display.CLAIM_BASIS_MISSING_LABELS?.["not-available"],
    "TRUST_BASIS_FALLBACK_LABEL (react/src/trust-basis.ts) must equal Surface's CLAIM_BASIS_MISSING_LABELS['not-available'].",
  );

  const fixture = JSON.parse(readFileSync(path.join(root, "tests/browser/fixtures/trust-basis-views.json"), "utf8"));
  assert.ok(fixture.cases.length >= 8, "trust-basis fixture lost its cases.");
  for (const entry of fixture.cases) {
    const produced = entry.missing ? display.missingClaimBasisView(entry.missing) : display.claimBasisView(entry.claim, entry.evidence);
    assert.deepEqual(entry.view, produced, `Fixture "${entry.name}" differs from what @kontourai/surface ${installed} produces; regenerate it from Surface.`);
  }
  console.log(`Surface parity check passed: TrustBasisView matches @kontourai/surface/display ${installed}; ${fixture.cases.length} fixture views match claimBasisView.`);
}
