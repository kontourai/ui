import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// Static gates for the production marks in icons/ (ui#75).
//
// Every mark ships in two forms: an SVG file under icons/ and inner markup in
// react/src/*-paths.ts that the React components and custom elements render.
// The path modules are the source; `--write` regenerates the files from them,
// and the check fails when a file differs, so the two forms cannot drift.
//
// Each file is then parsed and held to an allowlist rather than scanned for
// known-bad strings: only plain shape elements, only geometry and paint
// attributes, and only `none` or `currentColor` as a paint. That is what keeps
// a mark single-colour, free of effects, and free of anything that loads or
// runs (scripts, raster embeds, external references, styles).
//
// What needs pixels (legibility at 16/24/32px, contrast on the shipped
// surfaces, standalone favicon rendering, distinctness) is in
// tests/browser/marks.spec.ts.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SVG_NS = "http://www.w3.org/2000/svg";
const HEIGHT = 24;

// Ceilings, with headroom over what ships: the largest square mark has 6
// shapes and is under 500 bytes; the lockup has 7 shapes and is about 6.6 KB,
// nearly all of it the outlined wordmark.
const LIMITS = {
  square: { shapes: 12, bytes: 1024 },
  wide: { shapes: 16, bytes: 12 * 1024 },
};

const SHAPES = new Set(["path", "rect", "circle", "ellipse", "line", "polyline", "polygon"]);
const ELEMENTS = new Set(["svg", "g", ...SHAPES]);
const ATTRIBUTES = new Set([
  "xmlns", "viewBox", "width", "height",
  "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "fill-rule",
  "d", "x", "y", "rx", "ry", "cx", "cy", "r", "x1", "y1", "x2", "y2", "points", "transform",
]);
const PAINTS = new Set(["none", "currentColor"]);
const KEYWORDS = {
  "stroke-linecap": new Set(["round", "butt", "square"]),
  "stroke-linejoin": new Set(["round", "miter", "bevel"]),
  "fill-rule": new Set(["nonzero", "evenodd"]),
};
// Attributes whose value is one plain number. `positive` ones size a shape, so
// zero would draw nothing; the rest are positions and corner radii.
const POSITIONS = new Set(["x", "y", "cx", "cy", "x1", "y1", "x2", "y2", "rx", "ry"]);
const POSITIVE = new Set(["r", "width", "height"]);
const NUMBER = /^-?(?:\d+\.?\d*|\.\d+)$/;
// Stroke weights a mark may use, in viewBox units. The marks are drawn at 1.75;
// below 1 a stroke is under a pixel at 16px, and above 3 it closes the counters.
const STROKE_WIDTH = { min: 1, max: 3 };
// Why a rejected name is rejected, for the message. The allowlist decides; this only explains.
const REASONS = [
  [/^(script|foreignObject|iframe|a)$|^on/, "marks carry no scripts, links or embedded documents"],
  [/^(image|use|feImage)$|href$|^(src)$/, "marks carry no raster embeds or external references"],
  [/^(style|class|id)$/, "marks carry no styles (a stylesheet can import remote content and set other colours)"],
  [/^(filter|mask|clipPath|pattern|marker|linearGradient|radialGradient|stop|defs|symbol|animate.*|set)$|^fe[A-Z]|^(clip-path|opacity|fill-opacity|stroke-opacity|mix-blend-mode|stroke-dasharray)$/, "marks use no filters, gradients, masks or other effects"],
  [/^(text|tspan|textPath)$|^font/, "marks carry no live text; outline it, so no font is needed"],
];
const explain = (name) => REASONS.find(([pattern]) => pattern.test(name))?.[1] ?? "it is not in the marks allowlist";

async function loadModule(file) {
  const source = readFileSync(path.join(root, file), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

const { productIconPaths } = await loadModule("react/src/product-icon-paths.ts");
const { brandMarkPaths, BRAND_MARK_HEIGHT } = await loadModule("react/src/brand-mark-paths.ts");
if (BRAND_MARK_HEIGHT !== HEIGHT) throw new Error(`BRAND_MARK_HEIGHT is ${BRAND_MARK_HEIGHT}; this check expects ${HEIGHT}.`);

// slug -> the file the path modules say should exist.
const expected = new Map();
for (const [slug, inner] of Object.entries(productIconPaths)) {
  expected.set(slug, {
    family: "product",
    width: HEIGHT,
    contents: `<svg xmlns="${SVG_NS}" viewBox="0 0 ${HEIGHT} ${HEIGHT}" width="${HEIGHT}" height="${HEIGHT}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>\n`,
  });
}
for (const [slug, mark] of Object.entries(brandMarkPaths)) {
  if (expected.has(slug)) throw new Error(`"${slug}" is both a product mark and a brand mark.`);
  expected.set(slug, {
    family: "brand",
    width: mark.width,
    contents: `<svg xmlns="${SVG_NS}" viewBox="0 0 ${mark.width} ${HEIGHT}" width="${mark.width}" height="${HEIGHT}" fill="none">${mark.inner}</svg>\n`,
  });
}
// An empty scan would otherwise read as every mark passing.
if (expected.size === 0) throw new Error("No marks are declared in react/src/product-icon-paths.ts or brand-mark-paths.ts.");

const iconsDir = path.join(root, "icons");
if (process.argv.includes("--write")) {
  for (const [slug, mark] of expected) writeFileSync(path.join(iconsDir, `${slug}.svg`), mark.contents);
  console.log(`Wrote ${expected.size} marks to icons/.`);
  process.exit(0);
}

const failures = [];
const rows = [];
const onDisk = readdirSync(iconsDir).sort();
for (const name of onDisk) {
  if (!name.endsWith(".svg")) failures.push(`icons/${name}: only .svg marks belong in icons/.`);
  else if (!expected.has(name.slice(0, -4))) failures.push(`icons/${name}: no mark of that name is declared in react/src/product-icon-paths.ts or brand-mark-paths.ts, so nothing gates it or renders it.`);
}

for (const [slug, mark] of expected) {
  const file = `icons/${slug}.svg`;
  if (!onDisk.includes(`${slug}.svg`)) {
    failures.push(`${file}: declared in the path modules but missing; run node scripts/check-marks.mjs --write.`);
    continue;
  }
  const contents = readFileSync(path.join(iconsDir, `${slug}.svg`), "utf8");
  const before = failures.length;
  const fail = (message) => failures.push(`${file}: ${message}`);
  if (contents !== mark.contents) fail("differs from the markup in the path modules; run node scripts/check-marks.mjs --write, or correct the path module.");

  let svg;
  try {
    svg = parse(contents);
  } catch (error) {
    fail(`not a valid SVG document: ${error.message}`);
    continue;
  }
  if (svg.name !== "svg") fail(`the root element is <${svg.name}>, not <svg>.`);
  if (svg.attributes.get("xmlns") !== SVG_NS) fail(`the root needs xmlns="${SVG_NS}"; without it the file is not an image on its own (a favicon, an <img>).`);

  const viewBox = svg.attributes.get("viewBox");
  const box = viewBox === undefined ? null : /^0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)$/.exec(viewBox)?.slice(1).map(Number);
  if (viewBox === undefined) fail("the root has no viewBox, so the mark cannot scale.");
  else if (!box || box[0] <= 0 || box[1] <= 0) fail(`viewBox "${viewBox}" must be "0 0 <width> <height>" with a positive size.`);
  else {
    if (box[1] !== HEIGHT) fail(`viewBox height is ${box[1]}; every mark uses a ${HEIGHT}-unit-high frame.`);
    for (const [name, size] of [["width", box[0]], ["height", box[1]]]) {
      if (svg.attributes.get(name) !== String(size)) fail(`${name}="${svg.attributes.get(name)}" must equal the viewBox ${name} (${size}), the intrinsic size an <img> or favicon uses.`);
    }
  }
  const square = Boolean(box) && box[0] === box[1];
  // Product marks render in a shared square frame and double as favicons.
  if (mark.family === "product" && box && !square) fail("a product mark must be square.");

  let shapes = 0;
  const paints = new Set();
  walk(svg, { fill: "black", stroke: "none" }, 0);
  function walk(element, inherited, depth) {
    if (!ELEMENTS.has(element.name)) {
      fail(`<${element.name}> is not allowed: ${explain(element.name)}.`);
      return;
    }
    if (element.name === "svg" && depth > 0) fail("nested <svg> is not allowed.");
    const paint = { ...inherited };
    // Geometry must stay on the frame: a shape placed far outside it draws
    // nothing while still counting as a painted shape.
    const reach = Math.max(box?.[0] ?? HEIGHT, HEIGHT);
    for (const [name, value] of element.attributes) {
      if (!ATTRIBUTES.has(name)) fail(`attribute ${name} on <${element.name}> is not allowed: ${explain(name)}.`);
      // A namespace declaration below the root moves the subtree out of SVG: it would parse, count as shapes, and draw nothing.
      else if (name === "xmlns" && depth > 0) fail(`xmlns on <${element.name}> is not allowed: only the root declares a namespace.`);
      else if (/var\(|url\(|data:/i.test(value)) fail(`${name}="${value}" on <${element.name}>: var(), url() and data: values are not allowed; a mark refers to nothing outside itself.`);
      else if (element.name === "svg" && depth === 0 && (name === "width" || name === "height" || name === "viewBox" || name === "xmlns")) continue; // rated above
      else if (name in KEYWORDS) {
        if (!KEYWORDS[name].has(value)) fail(`${name}="${value}" on <${element.name}> must be one of ${[...KEYWORDS[name]].join(", ")}.`);
      } else if (name === "stroke-width") {
        if (!NUMBER.test(value) || Number(value) < STROKE_WIDTH.min || Number(value) > STROKE_WIDTH.max) fail(`stroke-width="${value}" on <${element.name}> must be a plain number from ${STROKE_WIDTH.min} to ${STROKE_WIDTH.max}.`);
      } else if (POSITIONS.has(name) || POSITIVE.has(name)) {
        const least = POSITIVE.has(name) ? Number.MIN_VALUE : 0;
        if (!NUMBER.test(value) || Number(value) < least || Number(value) > reach) fail(`${name}="${value}" on <${element.name}> must be a plain number ${POSITIVE.has(name) ? "above 0" : "from 0"} to ${reach}, the frame's extent.`);
      } else if (name === "points") {
        if (!/^[\d.,\s-]+$/.test(value) || value.split(/[\s,]+/).filter(Boolean).some((part) => !NUMBER.test(part) || Math.abs(Number(part)) > reach)) fail(`points on <${element.name}> must be plain numbers within the frame's extent (${reach}).`);
      } else if (name === "fill" || name === "stroke") {
        if (PAINTS.has(value)) paint[name] = value;
        else fail(`${name}="${value}" on <${element.name}>: a mark's only paint is currentColor (or none), so it takes one colour from its context.`);
      } else if (name === "transform") {
        const offsets = /^translate\((\d+(?:\.\d+)?)(?: (\d+(?:\.\d+)?))?\)$/.exec(value)?.slice(1).filter((part) => part !== undefined).map(Number);
        if (!offsets || offsets.some((offset) => offset > reach)) fail(`transform="${value}": only translate(x y) with offsets from 0 to ${reach} is allowed.`);
      } else if (name === "d") {
        if (!/^[MmLlHhVvCcSsQqTtAaZz0-9+\-.,\s]+$/.test(value)) fail(`path data on <${element.name}> contains characters that are not path commands.`);
        else if ((value.match(/\d+\.?\d*|\.\d+/g) ?? []).some((part) => Number(part) > reach)) fail(`path data on <${element.name}> has a coordinate beyond the frame's extent (${reach}).`);
      }
    }
    if (SHAPES.has(element.name)) {
      shapes += 1;
      // SVG's initial fill is black, not currentColor: a shape that inherits
      // no fill would paint a second, fixed colour.
      if (paint.fill === "black") fail(`<${element.name}> inherits no fill, so it would paint black rather than currentColor; set fill="none" or fill="currentColor" on it or an ancestor.`);
      else if (paint.fill === "none" && paint.stroke === "none") fail(`<${element.name}> has neither a fill nor a stroke, so it paints nothing.`);
      else paints.add(paint.fill === "currentColor" && paint.stroke === "currentColor" ? "fill+stroke" : paint.fill === "currentColor" ? "fill" : "stroke");
      if (element.children.length) fail(`<${element.name}> must be empty.`);
    }
    for (const child of element.children) walk(child, paint, depth + 1);
  }

  const limits = square ? LIMITS.square : LIMITS.wide;
  const bytes = Buffer.byteLength(contents);
  if (shapes === 0) fail("draws nothing: it contains no shape elements.");
  if (shapes > limits.shapes) fail(`${shapes} shapes; the ceiling for a ${square ? "square" : "wide"} mark is ${limits.shapes}. A mark that needs more will not hold at 16px.`);
  if (bytes > limits.bytes) fail(`${bytes} bytes; the ceiling for a ${square ? "square" : "wide"} mark is ${limits.bytes}.`);

  rows.push({ slug, ok: failures.length === before, family: mark.family, frame: box ? `${box[0]}x${box[1]}` : "?", shapes, bytes, paint: [...paints].sort().join(",") || "none", favicon: square ? "yes" : "no (not square)" });
}

for (const row of rows) {
  console.log(`${row.ok ? "ok  " : "FAIL"} ${row.slug.padEnd(26)} ${row.family.padEnd(8)} ${row.frame.padEnd(9)} ${String(row.shapes).padStart(2)} shapes ${String(row.bytes).padStart(5)} bytes  paint: ${row.paint.padEnd(12)} favicon: ${row.favicon}`);
}
if (failures.length) {
  console.error(`\nMarks check failed:\n${failures.map((failure) => `  - ${failure}`).join("\n")}`);
  process.exit(1);
}
console.log(`Marks check passed: ${rows.length} marks (${rows.filter((row) => row.family === "product").length} product, ${rows.filter((row) => row.family === "brand").length} brand) are valid, self-contained, single-colour, effect-free and within their ceilings.`);

// A strict reader for the subset of XML a mark may use: elements and quoted
// attributes. Declarations, doctypes (and so entities), comments, CDATA,
// processing instructions, character references and text are all rejected, so
// nothing reaches the allowlist in a form the allowlist does not see.
function parse(source) {
  let at = 0;
  const stack = [];
  let rootElement = null;
  const NAME = /[A-Za-z_][\w:.-]*/y;
  while (at < source.length) {
    if (source[at] !== "<") {
      const next = source.indexOf("<", at);
      const text = source.slice(at, next === -1 ? source.length : next);
      if (text.trim()) throw new Error(`unexpected text "${text.trim().slice(0, 40)}"`);
      at += text.length;
      continue;
    }
    if (source[at + 1] === "!" || source[at + 1] === "?") throw new Error(`declarations, comments and processing instructions are not allowed (found "${source.slice(at, at + 12)}")`);
    if (source[at + 1] === "/") {
      const end = source.indexOf(">", at);
      const name = source.slice(at + 2, end === -1 ? undefined : end).trim();
      const open = stack.pop();
      if (!open || open.name !== name) throw new Error(`</${name}> does not close ${open ? `<${open.name}>` : "anything"}`);
      at = end + 1;
      continue;
    }
    NAME.lastIndex = at + 1;
    const name = NAME.exec(source)?.[0];
    if (!name) throw new Error(`malformed tag at offset ${at}`);
    if (rootElement && stack.length === 0) throw new Error(`a second root element <${name}>`);
    at += 1 + name.length;
    const element = { name, attributes: new Map(), children: [] };
    for (;;) {
      const space = /\s*/y;
      space.lastIndex = at;
      const gap = space.exec(source)[0].length;
      at += gap;
      if (at >= source.length) throw new Error(`<${name}> is never closed`);
      if (source[at] === ">") { at += 1; break; }
      if (source.startsWith("/>", at)) { at += 2; element.selfClosed = true; break; }
      if (gap === 0) throw new Error(`malformed <${name}> tag`);
      NAME.lastIndex = at;
      const attribute = NAME.exec(source)?.[0];
      if (!attribute) throw new Error(`malformed attribute in <${name}>`);
      at += attribute.length;
      const quote = source[at + 1];
      if (source[at] !== "=" || (quote !== '"' && quote !== "'")) throw new Error(`attribute ${attribute} in <${name}> needs a quoted value`);
      const close = source.indexOf(quote, at + 2);
      if (close === -1) throw new Error(`attribute ${attribute} in <${name}> is never closed`);
      const value = source.slice(at + 2, close);
      if (/[<&]/.test(value)) throw new Error(`attribute ${attribute} in <${name}> contains "<" or a character reference`);
      if (element.attributes.has(attribute)) throw new Error(`attribute ${attribute} is repeated in <${name}>`);
      element.attributes.set(attribute, value);
      at = close + 1;
    }
    if (stack.length) stack.at(-1).children.push(element);
    else rootElement = element;
    if (!element.selfClosed) stack.push(element);
  }
  if (stack.length) throw new Error(`<${stack.at(-1).name}> is never closed`);
  if (!rootElement) throw new Error("the file is empty");
  return rootElement;
}
