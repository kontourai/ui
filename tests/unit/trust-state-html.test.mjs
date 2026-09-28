import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// Runs before the build (npm run check), so it compiles react/src/trust-states.ts
// itself. The module imports nothing, which is what lets it load from a data: URL.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = readFileSync(path.join(root, "react/src/trust-states.ts"), "utf8");
const load = (code) => {
  const js = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(`${js}\n// ${Math.random()}`).toString("base64")}`);
};

const HOSTILE = 'M0 0"><img src=x onerror=alert(1)>';
const liveMarkup = (html) => /<img|onerror="|"><|<script/i.test(html.replace(/<(?:\/?span|svg|\/svg|path|\/path)\b[^<>]*>/g, ""));

test("the shared tables cannot be changed at runtime", async () => {
  const module = await load(source);
  const before = module.renderTrustStateHtml("verified", { label: "Checked" });
  const attempts = [
    () => { module.trustStateGlyphs.verified = HOSTILE; },
    () => { module.trustStateGlyphs.pending = HOSTILE; },
    () => { delete module.trustStateGlyphs.verified; },
    () => { module.trustStateLabels.verified = HOSTILE; },
    () => { delete module.trustStateLabels.verified; },
    () => { module.trustStates.push(HOSTILE); },
    () => { module.trustStates[3] = HOSTILE; },
    () => { module.trustStates.length = 0; },
  ];
  for (const attempt of attempts) {
    // ES modules are strict, so a write to a frozen table throws.
    assert.throws(attempt, TypeError, attempt.toString());
  }
  assert.ok(Object.isFrozen(module.trustStates) && Object.isFrozen(module.trustStateLabels) && Object.isFrozen(module.trustStateGlyphs));
  assert.equal(module.trustStateGlyphs.verified, "M3.25 8.5l3 3 6.5-7");
  assert.equal(module.trustStateLabels.verified, "Verified");
  assert.equal(module.trustStates.length, 9);
  assert.equal(module.renderTrustStateHtml("verified", { label: "Checked" }), before);
});

test("glyph and state values are escaped even if a table were writable", async () => {
  // Stand-in for a freeze regression: the same source with Object.freeze made
  // a no-op, so this test reaches the escaping on its own.
  const unfrozen = source.replaceAll("Object.freeze(", "((table) => table)(");
  assert.notEqual(unfrozen, source, "trust-states.ts no longer calls Object.freeze; update this test.");
  const module = await load(unfrozen);
  module.trustStateGlyphs.verified = HOSTILE;
  const glyphHtml = module.renderTrustStateHtml("verified");
  assert.ok(glyphHtml.includes('<path d="M0 0&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"></path>'), glyphHtml);
  assert.equal(liveMarkup(glyphHtml), false, glyphHtml);

  const hostileState = 'x"><img src=x onerror=alert(1)>';
  module.trustStates.push(hostileState);
  module.trustStateLabels[hostileState] = "Label";
  module.trustStateGlyphs[hostileState] = "M1 1";
  const stateHtml = module.renderTrustStateHtml(hostileState);
  assert.ok(stateHtml.includes(' data-trust-state="x&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"'), stateHtml);
  assert.equal(liveMarkup(stateHtml), false, stateHtml);
});
