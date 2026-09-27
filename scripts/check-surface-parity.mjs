import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// The trust-state vocabulary is Surface's (owner decision, 2026-09-27): the
// states, their order, and their default labels must equal Surface's
// TRUST_STATUS_LABELS. @kontourai/surface is an exact-pinned devDependency used
// only here; nothing shipped imports it (check:pack enforces that). Bumping
// that devDependency is how a Surface vocabulary change reaches Kontour UI:
// this check then fails until trust-states.ts, the tokens, and the styles
// follow.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const surface = await import("@kontourai/surface");
const ui = await import(pathToFileURL(path.join(root, "dist/react/trust-states.js")).href);

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
console.log(`Surface parity check passed: ${ui.trustStates.length} trust states match @kontourai/surface TRUST_STATUS_LABELS.`);
