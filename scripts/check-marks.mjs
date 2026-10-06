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
  walk(svg, { fill: "black", stroke: "none" }, 0, [0, 0]);
  function walk(element, inherited, depth, inheritedOffset) {
    if (!ELEMENTS.has(element.name)) {
      fail(`<${element.name}> is not allowed: ${explain(element.name)}.`);
      return;
    }
    if (element.name === "svg" && depth > 0) fail("nested <svg> is not allowed.");
    const paint = { ...inherited };
    // Geometry must stay on the frame: a shape placed far outside it draws
    // nothing while still counting as a painted shape.
    const reach = Math.max(box?.[0] ?? HEIGHT, HEIGHT);
    // A translate on this element moves its own path data and its children;
    // a malformed one is reported below and contributes no offset.
    const ownOffset = /^translate\((\d+(?:\.\d+)?)(?: (\d+(?:\.\d+)?))?\)$/.exec(element.attributes.get("transform") ?? "");
    const offset = ownOffset ? [inheritedOffset[0] + Number(ownOffset[1]), inheritedOffset[1] + Number(ownOffset[2] ?? 0)] : inheritedOffset;
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
        else {
          let extent;
          try {
            extent = pathExtent(value);
          } catch (error) {
            fail(`path data on <${element.name}> is malformed: ${error.message}.`);
            continue;
          }
          // Bounded by where the path actually draws: absolute positions after
          // relative moves accumulate, arcs and curves by their true extent.
          const [width, height] = [box?.[0] ?? HEIGHT, HEIGHT];
          const [minX, maxX, minY, maxY] = [extent.minX + offset[0], extent.maxX + offset[0], extent.minY + offset[1], extent.maxY + offset[1]];
          const EPSILON = 1e-6;
          if (minX < -EPSILON || minY < -EPSILON || maxX > width + EPSILON || maxY > height + EPSILON) {
            const round = (number) => Math.round(number * 100) / 100;
            fail(`path data on <${element.name}> draws beyond the ${width}x${height} frame: x from ${round(minX)} to ${round(maxX)}, y from ${round(minY)} to ${round(maxY)}.`);
          }
        }
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
    for (const child of element.children) walk(child, paint, depth + 1, offset);
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

// Reads path data by the SVG path grammar and returns the box it draws in.
// Enforced: the data starts with a moveto; every command has its full
// argument count (implicit repeats included); at most one comma separates two
// arguments, and none follows a command letter, precedes one, or ends the
// data; an arc's flags are single "0"/"1" characters, which may be written
// without separators ("a8 8 0 0116 0"). The box follows the current point
// through relative commands and covers each segment's true extent: the
// extrema of quadratic and cubic Béziers, and of arcs after the SVG 2
// endpoint-to-centre conversion (radii scaled up when too small, rotation
// applied). Stroke width is not added. It does not judge whether a path draws
// anything visible: a single moveto parses.
function pathExtent(data) {
  const ARITY = { m: 2, l: 2, t: 2, h: 1, v: 1, c: 6, s: 4, q: 4, a: 7, z: 0 };
  const number = /[+-]?(?:\d+\.?\d*|\.\d+)/y;
  let at = 0;
  const space = () => { while (at < data.length && /\s/.test(data[at])) at += 1; };
  const segments = [];
  space();
  if (data[at] !== "M" && data[at] !== "m") throw new Error("path data must start with a moveto (M or m)");
  let command = null;
  let afterComma = false;
  for (;;) {
    space();
    if (at >= data.length) {
      if (afterComma) throw new Error("a comma ends the path data");
      break;
    }
    if (/[A-Za-z]/.test(data[at])) {
      if (afterComma) throw new Error(`a comma precedes the command at offset ${at}`);
      if (!(data[at].toLowerCase() in ARITY)) throw new Error(`"${data[at]}" is not a path command`);
      command = data[at];
      at += 1;
      if (command.toLowerCase() === "z") { segments.push({ command, args: [] }); continue; }
    } else if (command === null || command.toLowerCase() === "z") {
      throw new Error(`a number at offset ${at} follows no command`);
    }
    const lower = command.toLowerCase();
    const args = [];
    for (let index = 0; index < ARITY[lower]; index += 1) {
      space();
      if (index > 0 && data[at] === ",") { at += 1; space(); }
      if (lower === "a" && (index === 3 || index === 4)) {
        if (data[at] !== "0" && data[at] !== "1") throw new Error(`an arc flag must be 0 or 1 (offset ${at})`);
        args.push(Number(data[at]));
        at += 1;
        continue;
      }
      number.lastIndex = at;
      const match = number.exec(data);
      if (!match) throw new Error(`"${command}" needs ${ARITY[lower]} numbers (offset ${at})`);
      at += match[0].length;
      args.push(Number(match[0]));
    }
    segments.push({ command, args });
    space();
    afterComma = data[at] === ",";
    if (afterComma) at += 1;
    // After a moveto's first pair, further pairs are linetos of the same kind.
    if (lower === "m") command = command === "m" ? "l" : "L";
  }

  const box = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  const include = (x, y) => {
    box.minX = Math.min(box.minX, x); box.maxX = Math.max(box.maxX, x);
    box.minY = Math.min(box.minY, y); box.maxY = Math.max(box.maxY, y);
  };
  let [x, y] = [0, 0];
  let start = [0, 0];
  let previous = null; // { kind: "c" | "q", control: [x, y] } for S and T reflection
  for (const { command, args } of segments) {
    const lower = command.toLowerCase();
    const relative = command === lower && lower !== "z";
    const point = (index) => [args[index] + (relative ? x : 0), args[index + 1] + (relative ? y : 0)];
    let next;
    if (lower === "m") { [x, y] = point(0); start = [x, y]; include(x, y); previous = null; continue; }
    if (lower === "z") { [x, y] = start; previous = null; continue; }
    if (lower === "l") next = point(0);
    else if (lower === "h") next = [args[0] + (relative ? x : 0), y];
    else if (lower === "v") next = [x, args[0] + (relative ? y : 0)];
    else if (lower === "c" || lower === "s") {
      const first = lower === "c" ? point(0) : previous?.kind === "c" ? [2 * x - previous.control[0], 2 * y - previous.control[1]] : [x, y];
      const second = point(lower === "c" ? 2 : 0);
      next = point(lower === "c" ? 4 : 2);
      for (const [px, py] of cubicExtrema([x, y], first, second, next)) include(px, py);
      previous = { kind: "c", control: second };
    } else if (lower === "q" || lower === "t") {
      const control = lower === "q" ? point(0) : previous?.kind === "q" ? [2 * x - previous.control[0], 2 * y - previous.control[1]] : [x, y];
      next = point(lower === "q" ? 2 : 0);
      for (const [px, py] of quadraticExtrema([x, y], control, next)) include(px, py);
      previous = { kind: "q", control };
    } else if (lower === "a") {
      next = point(5);
      for (const [px, py] of arcExtrema([x, y], args[0], args[1], args[2], args[3], args[4], next)) include(px, py);
    }
    if (lower !== "c" && lower !== "s" && lower !== "q" && lower !== "t") previous = null;
    include(x, y);
    [x, y] = next;
    include(x, y);
  }
  return box;
}

// Points on a quadratic Bézier where x or y is extreme within 0 < t < 1.
function quadraticExtrema(p0, p1, p2) {
  const points = [];
  for (const axis of [0, 1]) {
    const denominator = p0[axis] - 2 * p1[axis] + p2[axis];
    if (denominator === 0) continue;
    const t = (p0[axis] - p1[axis]) / denominator;
    if (t > 0 && t < 1) points.push([0, 1].map((k) => (1 - t) ** 2 * p0[k] + 2 * (1 - t) * t * p1[k] + t ** 2 * p2[k]));
  }
  return points;
}

// Points on a cubic Bézier where x or y is extreme within 0 < t < 1.
function cubicExtrema(p0, p1, p2, p3) {
  const points = [];
  for (const axis of [0, 1]) {
    const [d0, d1, d2] = [p1[axis] - p0[axis], p2[axis] - p1[axis], p3[axis] - p2[axis]];
    const [a, b, c] = [d0 - 2 * d1 + d2, 2 * (d1 - d0), d0];
    const roots = [];
    if (Math.abs(a) < 1e-12) { if (b !== 0) roots.push(-c / b); }
    else {
      const discriminant = b * b - 4 * a * c;
      if (discriminant >= 0) roots.push((-b + Math.sqrt(discriminant)) / (2 * a), (-b - Math.sqrt(discriminant)) / (2 * a));
    }
    for (const t of roots) {
      if (t > 0 && t < 1) points.push([0, 1].map((k) => (1 - t) ** 3 * p0[k] + 3 * (1 - t) ** 2 * t * p1[k] + 3 * (1 - t) * t ** 2 * p2[k] + t ** 3 * p3[k]));
    }
  }
  return points;
}

// Points on an elliptical arc where x or y is extreme, by the SVG 2
// endpoint-to-centre conversion (implementation notes, B.2.4 and B.2.5).
function arcExtrema([x1, y1], rxIn, ryIn, degrees, largeArc, sweep, [x2, y2]) {
  if (x1 === x2 && y1 === y2) return []; // the arc is omitted
  let [rx, ry] = [Math.abs(rxIn), Math.abs(ryIn)];
  if (rx === 0 || ry === 0) return []; // drawn as a straight line; the endpoints bound it
  const phi = (degrees * Math.PI) / 180;
  const [cos, sin] = [Math.cos(phi), Math.sin(phi)];
  const [dx, dy] = [(x1 - x2) / 2, (y1 - y2) / 2];
  const [x1p, y1p] = [cos * dx + sin * dy, -sin * dx + cos * dy];
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) { rx *= Math.sqrt(lambda); ry *= Math.sqrt(lambda); }
  const numerator = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const denominator = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const coefficient = (largeArc !== sweep ? 1 : -1) * Math.sqrt(Math.max(0, numerator / denominator));
  const [cxp, cyp] = [(coefficient * rx * y1p) / ry, (-coefficient * ry * x1p) / rx];
  const [cx, cy] = [cos * cxp - sin * cyp + (x1 + x2) / 2, sin * cxp + cos * cyp + (y1 + y2) / 2];
  const angle = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let delta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;
  const thetaX = Math.atan2(-ry * sin, rx * cos);
  const thetaY = Math.atan2(ry * cos, rx * sin);
  const TAU = 2 * Math.PI;
  const swept = (theta) => {
    const offset = delta >= 0 ? ((theta - theta1) % TAU + TAU) % TAU : -((((theta1 - theta) % TAU) + TAU) % TAU);
    return delta >= 0 ? offset <= delta : offset >= delta;
  };
  return [thetaX, thetaX + Math.PI, thetaY, thetaY + Math.PI].filter(swept).map((theta) => [
    cx + rx * cos * Math.cos(theta) - ry * sin * Math.sin(theta),
    cy + rx * sin * Math.cos(theta) + ry * cos * Math.sin(theta),
  ]);
}

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
