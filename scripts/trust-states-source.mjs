import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

// Reads the `trustStates` list from react/src/trust-states.ts without building
// it, so check:tokens and check:contrast (which run before the build) can
// require their pinned copies to match the component's list. A state added to
// the component then fails those checks until it has tokens and a chip rule.
export function trustStatesFromSource(root) {
  const file = "react/src/trust-states.ts";
  const source = ts.createSourceFile(file, readFileSync(path.join(root, file), "utf8"), ts.ScriptTarget.Latest, true);
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== "trustStates") continue;
      let init = declaration.initializer;
      while (init && (ts.isAsExpression(init) || ts.isSatisfiesExpression?.(init))) init = init.expression;
      if (!init || !ts.isArrayLiteralExpression(init) || !init.elements.every(ts.isStringLiteral)) {
        throw new Error(`${file}: trustStates must be an array literal of strings.`);
      }
      return init.elements.map((element) => element.text);
    }
  }
  throw new Error(`${file} no longer declares trustStates; update scripts/trust-states-source.mjs.`);
}
