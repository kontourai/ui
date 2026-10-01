import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

// The wordmark's outline is committed, not built, so nothing in the Node
// toolchain can tell whether it still comes from the vendored font. Where
// Python with fontTools and brotli is installed, re-derive it and compare.
// Elsewhere (CI installs neither) the test is skipped, and says so: a skip is
// not evidence that the outline matches.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const python = process.env.KUI_PYTHON ?? "python3";
const probe = spawnSync(python, ["-c", "import fontTools, brotli"], { encoding: "utf8" });
const skip = probe.status === 0 ? false : `${python} with fontTools and brotli is not available; the wordmark outline was not re-derived`;

test("the committed wordmark is the outline of the vendored Fraunces face", { skip }, () => {
  const result = spawnSync(python, [path.join(root, "scripts/generate-wordmark.py"), "--check"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Wordmark provenance check passed: "Kontour"/);
});
