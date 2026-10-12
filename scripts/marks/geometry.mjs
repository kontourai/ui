// Curve geometry for the contour marks: isolines, arc-length resampling,
// Catmull-Rom splines and their path data, and the dissolve that breaks a
// contour into runs, dashes and dots. Ported unchanged from the owner-approved
// exploration (2026-10-12); scripts/generate-marks.mjs builds every contour
// mark from these and the constructions beside them. Everything here draws new
// vector geometry from parameters; nothing is traced from a raster.

export const TAU = Math.PI * 2;
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const len = (a) => Math.hypot(a[0], a[1]);
export const dist = (a, b) => len(sub(a, b));

// The closed isoline of `f` at `level`, found along rays from `centre` (the
// field must fall monotonically along every ray, which holds for these hills).
export function isoline(f, centre, level, n = 720, rMax = 200) {
  const points = [];
  for (let i = 0; i < n; i += 1) {
    const t = (i / n) * TAU;
    const u = [Math.cos(t), Math.sin(t)];
    let lo = 0;
    let hi = rMax;
    // march out to the first crossing, then bisect
    const step = rMax / 400;
    for (let r = step; r <= rMax; r += step) {
      const p = add(centre, mul(u, r));
      if (f(p[0], p[1]) < level) { hi = r; lo = r - step; break; }
    }
    for (let k = 0; k < 40; k += 1) {
      const mid = (lo + hi) / 2;
      const p = add(centre, mul(u, mid));
      if (f(p[0], p[1]) >= level) lo = mid; else hi = mid;
    }
    points.push(add(centre, mul(u, (lo + hi) / 2)));
  }
  return points;
}

export function lengthOf(points, closed) {
  let s = 0;
  for (let i = 1; i < points.length; i += 1) s += dist(points[i - 1], points[i]);
  if (closed) s += dist(points.at(-1), points[0]);
  return s;
}

// Cumulative arc length at each vertex (closed adds the closing edge at the end).
function cumulative(points, closed) {
  const cum = [0];
  for (let i = 1; i < points.length; i += 1) cum.push(cum[i - 1] + dist(points[i - 1], points[i]));
  if (closed) cum.push(cum.at(-1) + dist(points.at(-1), points[0]));
  return cum;
}

// The point at arc length s.
export function at(points, closed, s) {
  const cum = cumulative(points, closed);
  const total = cum.at(-1);
  if (closed) s = ((s % total) + total) % total;
  else s = Math.max(0, Math.min(total, s));
  let i = 1;
  while (i < cum.length - 1 && cum[i] < s) i += 1;
  const a = points[(i - 1) % points.length];
  const b = points[i % points.length];
  const seg = cum[i] - cum[i - 1] || 1;
  const t = (s - cum[i - 1]) / seg;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

// The sub-polyline between arc lengths s0 and s1 (s1 may exceed the length on a closed curve).
export function slice(points, closed, s0, s1, step = 0.05) {
  const out = [];
  const n = Math.max(2, Math.ceil((s1 - s0) / step) + 1);
  for (let i = 0; i < n; i += 1) out.push(at(points, closed, s0 + ((s1 - s0) * i) / (n - 1)));
  return out;
}

export function resample(points, closed, count) {
  const total = lengthOf(points, closed);
  const out = [];
  const n = closed ? count : count + 1;
  for (let i = 0; i < n; i += 1) out.push(at(points, closed, (total * i) / count));
  return out;
}


export function bezierSample(p0, c1, c2, p1, n = 60) {
  const out = [];
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const m = 1 - t;
    out.push([
      m * m * m * p0[0] + 3 * m * m * t * c1[0] + 3 * m * t * t * c2[0] + t * t * t * p1[0],
      m * m * m * p0[1] + 3 * m * m * t * c1[1] + 3 * m * t * t * c2[1] + t * t * t * p1[1],
    ]);
  }
  return out;
}

// A smooth curve through control knots (Catmull-Rom), sampled densely.
export function spline(knots, closed = false, perSegment = 40) {
  const n = knots.length;
  const get = (i) => (closed ? knots[(i + n) % n] : knots[Math.max(0, Math.min(n - 1, i))]);
  const out = [];
  const segments = closed ? n : n - 1;
  for (let i = 0; i < segments; i += 1) {
    const [p0, p1, p2, p3] = [get(i - 1), get(i), get(i + 1), get(i + 2)];
    const c1 = add(p1, mul(sub(p2, p0), 1 / 6));
    const c2 = sub(p2, mul(sub(p3, p1), 1 / 6));
    const pts = bezierSample(p1, c1, c2, p2, perSegment);
    if (i > 0) pts.shift();
    out.push(...pts);
  }
  if (closed) out.pop();
  return out;
}

// --- serialising -----------------------------------------------------------

export function fmt(v, decimals) {
  const k = 10 ** decimals;
  let s = String(Math.round(v * k) / k);
  if (s === "-0") s = "0";
  return s.replace(/^(-?)0\./, "$1.");
}

// Joins numbers the way path data allows: no separator before a minus sign or
// before a leading "." when the previous number already holds a ".".
function join(nums) {
  let out = "";
  let prev = null;
  for (const s of nums) {
    if (prev === null) out = s;
    else if (s.startsWith("-") || (s.startsWith(".") && prev.includes("."))) out += s;
    else out += ` ${s}`;
    prev = s;
  }
  return out;
}

// Path data for a smooth curve through `knots` (uniform Catmull-Rom written as
// one C and then S commands, which is exact because uniform Catmull-Rom tangents
// are symmetric at every knot). Coordinates are rounded once, absolutely, and
// the relative steps are differences of rounded values, so no error accumulates.
export function curveData(knots, closed, decimals = 2) {
  const k = 10 ** decimals;
  const r = (p) => [Math.round(p[0] * k) / k, Math.round(p[1] * k) / k];
  const n = knots.length;
  if (n === 1) {
    const p = r(knots[0]);
    return `M${join([fmt(p[0], decimals), fmt(p[1], decimals)])}h.01`;
  }
  const get = (i) => (closed ? knots[(i + n) % n] : knots[Math.max(0, Math.min(n - 1, i))]);
  const segments = closed ? n : n - 1;
  const start = r(get(0));
  let data = `M${join([fmt(start[0], decimals), fmt(start[1], decimals)])}`;
  let cur = start;
  for (let i = 0; i < segments; i += 1) {
    const [p0, p1, p2, p3] = [get(i - 1), get(i), get(i + 1), get(i + 2)];
    const c1 = r(add(p1, mul(sub(p2, p0), 1 / 6)));
    const c2 = r(sub(p2, mul(sub(p3, p1), 1 / 6)));
    const end = r(p2);
    const rel = (p) => [fmt(p[0] - cur[0], decimals), fmt(p[1] - cur[1], decimals)];
    // Only the first segment needs a full C: uniform Catmull-Rom mirrors the
    // tangent at every interior knot, which is exactly what S assumes.
    if (n === 2 && !closed) data += `l${join(rel(end))}`;
    else if (i > 0) data += `s${join([...rel(c2), ...rel(end)])}`;
    else data += `c${join([...rel(c1), ...rel(c2), ...rel(end)])}`;
    cur = end;
  }
  if (closed) data += "z";
  return data;
}

// A smooth closed or open curve through a dense polyline, with about one knot per `spacing` units.
export function fit(points, closed, spacing, decimals = 2, minKnots = 3) {
  const total = lengthOf(points, closed);
  const count = Math.max(closed ? minKnots : 1, Math.round(total / spacing));
  return curveData(resample(points, closed, count), closed, decimals);
}

// Breaks a closed contour into solid runs, dashes and dots. `solidity(p)` is 1
// where the contour is resolved and falls to 0 where it is uncertain. Walking
// the contour from its most-solid point, a run continues while solidity is
// high; below that, it alternates dash and gap, with dashes shrinking and gaps
// growing as solidity falls, and dashes shorter than `dotBelow` become dots.
export function fragment(points, solidity, opts) {
  const { stroke, maxDash = 6, minGap = 2.6, maxGap = 4.2, dotBelow = 0.9, solidAbove = 0.97, blankBelow = -1, leadGap = false } = opts;
  const total = lengthOf(points, true);
  // start at the most solid point so the solid run is unbroken
  let s0 = 0;
  let bestQ = -1;
  for (let s = 0; s < total; s += total / 360) {
    const q = solidity(at(points, true, s));
    if (q > bestQ) { bestQ = q; s0 = s; }
  }
  const pieces = [];
  let s = s0;
  const end = s0 + total;
  let runStart = null;
  const flush = (s1) => {
    if (runStart !== null && s1 - runStart > 0.01) pieces.push({ kind: "run", pts: slice(points, true, runStart, s1) });
    runStart = null;
  };
  const step = 0.05;
  while (s < end) {
    const q = solidity(at(points, true, s));
    if (q >= solidAbove) {
      if (runStart === null) runStart = s;
      s += step;
      continue;
    }
    // leadGap (round 3 on): leave a gap after a solid run before the first
    // dash, so the break reads as a break (rounds 1-2 were drawn without it)
    if (leadGap && runStart !== null) { flush(s); s += minGap; continue; }
    flush(s);
    if (q < blankBelow) { s += step; continue; }
    const dash = maxDash * Math.pow(q, 1.3);
    if (dash < dotBelow) {
      const g = minGap + (maxGap - minGap) * (1 - q);
      // a dot is a stroke-wide point; centre it half a stroke in
      const c = s + stroke / 2;
      if (c < end - stroke) pieces.push({ kind: "dot", p: at(points, true, c) });
      s = c + g;
    } else {
      const s1 = Math.min(s + dash, end);
      pieces.push({ kind: "dash", pts: slice(points, true, s, s1) });
      const g = minGap + (maxGap - minGap) * (1 - q);
      s = s1 + g;
    }
  }
  flush(Math.min(s, end));
  // The walk starts and ends at the same, fully solid point; join the last run
  // to the first so the seam does not show as a break.
  if (pieces.length > 1 && pieces[0].kind === "run" && pieces.at(-1).kind === "run") {
    const last = pieces.pop();
    pieces[0] = { kind: "run", pts: [...last.pts, ...pieces[0].pts.slice(1)] };
  }
  return pieces;
}
