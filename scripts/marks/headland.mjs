// The corporate symbol, B · Headland (owner decision, 2026-10-12).
//
// The silhouette is a smooth closed curve through 14 hand-placed knots. Every
// inner ring is an exact inset of it (an isoline of the distance to the
// outline), so the spacing is constant and each ring repeats the same lobes;
// the medial-axis creases an inset picks up are relaxed lightly. Each broken
// ring has a dissolve zone round the right side: its dashes shorten and its
// gaps widen smoothly to dots, then recover. The outer rings break furthest.
// Path data is cubic segments carrying the curve's own tangents.
//
// Ported unchanged from the exploration's round3.mjs (Headland only) and
// final.mjs (the three cuts' parameters).
import { spline, isoline, resample, fragment, fmt, lengthOf } from "./geometry.mjs";

// Writes a dense open or closed polyline as cubic segments whose tangents are
// the curve's own (taken from the dense points), not chords: dashes curve with
// their ring and every run ends on the ring's true direction. Knots are evenly
// spaced, so tangent magnitudes match across a knot and S applies.
function hermite(pts, closed, spacing, decimals) {
  const total = lengthOf(pts, closed);
  const count = Math.max(closed ? 8 : 1, Math.round(total / spacing));
  const dense = resample(pts, closed, count * 8);
  const knots = [];
  const tangents = [];
  const n = dense.length;
  for (let i = 0; i <= count; i += 1) {
    if (closed && i === count) break;
    const j = i * 8;
    const a = dense[closed ? (j - 1 + n) % n : Math.max(0, j - 1)];
    const b = dense[closed ? (j + 1) % n : Math.min(n - 1, j + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    knots.push(dense[closed ? j % n : Math.min(n - 1, j)]);
    tangents.push([(b[0] - a[0]) / l, (b[1] - a[1]) / l]);
  }
  const k = 10 ** decimals;
  const r = (p) => [Math.round(p[0] * k) / k, Math.round(p[1] * k) / k];
  const seg = total / count / 3;
  let cur = r(knots[0]);
  let d = `M${fmt(cur[0], decimals)} ${fmt(cur[1], decimals)}`;
  const m = knots.length;
  const segs = closed ? m : m - 1;
  const num = (v, first) => (first || v.startsWith("-") ? v : ` ${v}`);
  const join = (vals) => vals.map((v, i) => num(fmt(v, decimals), i === 0)).join("");
  for (let i = 0; i < segs; i += 1) {
    const p0 = knots[i];
    const p1 = knots[(i + 1) % m];
    const t0 = tangents[i];
    const t1 = tangents[(i + 1) % m];
    const c1 = r([p0[0] + t0[0] * seg, p0[1] + t0[1] * seg]);
    const c2 = r([p1[0] - t1[0] * seg, p1[1] - t1[1] * seg]);
    const e = r(p1);
    if (i === 0) d += `c${join([c1[0] - cur[0], c1[1] - cur[1], c2[0] - cur[0], c2[1] - cur[1], e[0] - cur[0], e[1] - cur[1]])}`;
    else d += `s${join([c2[0] - cur[0], c2[1] - cur[1], e[0] - cur[0], e[1] - cur[1]])}`;
    cur = e;
  }
  return closed ? `${d}z` : d;
}
const dotData = (p, decimals) => `M${fmt(p[0], decimals)} ${fmt(p[1], decimals)}h.01`;

// Knots run clockwise from the left, in a 24-unit frame. Headland: a long, low
// silhouette with a squared shoulder, a deep notch low right and the bottom
// lobe set to the left.
const HEADLAND = [
  [1.8, 11.4], [3.0, 6.8], [6.8, 4.6], [10.6, 4.2], [14.0, 3.1], [18.6, 4.3], [21.6, 7.8],
  [22.1, 12.0], [20.2, 14.6], [17.0, 15.4], [15.6, 18.8], [11.6, 20.9], [6.2, 20.2], [2.8, 16.6],
];

function outlineOf(margin) {
  let pts = spline(HEADLAND, true, 60);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const k = Math.min((24 - 2 * margin) / (x1 - x0), (24 - 2 * margin) / (y1 - y0));
  const [cx, cy] = [(x0 + x1) / 2, (y0 + y1) / 2];
  pts = pts.map(([x, y]) => [12 + (x - cx) * k, 12 + (y - cy) * k]);
  return resample(pts, true, 720);
}

// Inset rings: isolines of the distance to the outline. The medial-axis creases
// an inset picks up are relaxed lightly, more on the inner rings, so the
// innermost stays irregular but never kinked.
function rings(outline, count, step, relaxBase = 3, relaxGrow = 3) {
  const N = 241;
  const h = 24 / (N - 1);
  const grid = new Float64Array(N * N);
  for (let j = 0; j < N; j += 1) for (let i = 0; i < N; i += 1) {
    const x = i * h;
    const y = j * h;
    let best = Infinity;
    for (let k = 0; k < outline.length; k += 2) best = Math.min(best, (x - outline[k][0]) ** 2 + (y - outline[k][1]) ** 2);
    grid[j * N + i] = Math.sqrt(best);
  }
  const inside = (p) => {
    let c = false;
    for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
      const [xi, yi] = outline[i];
      const [xj, yj] = outline[j];
      if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const sdf = (x, y) => {
    const gx = Math.max(0, Math.min(N - 1.001, x / h));
    const gy = Math.max(0, Math.min(N - 1.001, y / h));
    const i = Math.floor(gx);
    const j = Math.floor(gy);
    const fx = gx - i;
    const fy = gy - j;
    const v = grid[j * N + i] * (1 - fx) * (1 - fy) + grid[j * N + i + 1] * fx * (1 - fy) + grid[(j + 1) * N + i] * (1 - fx) * fy + grid[(j + 1) * N + i + 1] * fx * fy;
    return inside([x, y]) ? v : -v;
  };
  // ray centre: the point deepest inside
  let centre = [12, 12];
  let deepest = -Infinity;
  for (let j = 0; j < N; j += 4) for (let i = 0; i < N; i += 4) {
    const v = sdf(i * h, j * h);
    if (v > deepest) { deepest = v; centre = [i * h, j * h]; }
  }
  const relax = (pts, w) => {
    const n = pts.length;
    return pts.map((_, i) => {
      let x = 0;
      let y = 0;
      for (let k = -w; k <= w; k += 1) { x += pts[(i + k + n) % n][0]; y += pts[(i + k + n) % n][1]; }
      return [x / (2 * w + 1), y / (2 * w + 1)];
    });
  };
  const out = [outline];
  for (let n = 1; n < count; n += 1) {
    let pts = isoline(sdf, centre, n * step, 720, 14);
    for (let pass = 0; pass < 3; pass += 1) pts = relax(pts, relaxBase + relaxGrow * n);
    out.push(pts);
  }
  return { rings: out, centre };
}

// Solidity round a ring, by direction from the centre (screen angles: 0 east,
// -90 north). Solid from `from` round the left and bottom back to `to`;
// inside that arc it falls smoothly to `floor` at `low`, then recovers.
const smooth = (t) => t * t * (3 - 2 * t);
const norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const D = Math.PI / 180;
function dissolve(centre, { from, low, to, floor = 0 }) {
  return (p) => {
    const a = Math.atan2(p[1] - centre[1], p[0] - centre[0]) / D;
    const rel = (x) => ((norm((x - from) * D) / D) + 360) % 360;
    const span = rel(to);
    const r = rel(a);
    if (r >= span) return 1;
    const m = rel(low);
    const t = r <= m ? 1 - r / m : (r - m) / (span - m);
    return floor + (1 - floor) * smooth(Math.max(0, Math.min(1, t)));
  };
}


// The symbol's inner markup: one group carrying the stroke, one path per ring.
// `size` is the frame (24 or 96); the construction runs in a 24-unit frame and
// is scaled numerically, so the larger cuts are new path data, not a transform.
function symbol({ size, count, step, margin, stroke, zones, dash, gap, maxGap, dotBelow, knot, decimals, relax = [4, 4] }) {
  const k = size / 24;
  const { rings: rs, centre } = rings(outlineOf(margin), count, step, ...relax);
  const scale = (pts) => pts.map(([x, y]) => [x * k, y * k]);
  const paths = rs.map((pts, i) => {
    if (!zones[i]) return hermite(scale(pts), true, knot, decimals);
    const pcs = fragment(pts, dissolve(centre, zones[i]), { stroke: stroke / k, maxDash: dash, minGap: gap, maxGap, dotBelow, solidAbove: 0.985, leadGap: true });
    return pcs.map((pc) => (pc.kind === "dot" || lengthOf(pc.pts, false) < 0.25 ? dotData(scale([pc.p ?? pc.pts[0]])[0], decimals) : hermite(scale(pc.pts), false, knot, decimals))).join("");
  });
  return `<g stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${paths.map((d) => `<path d="${d}"/>`).join("")}</g>`;
}

// Dissolve zones per ring, outermost first (null: a whole ring). The fine cut's
// zones; the lockup cut reuses its first three and widens the fourth.
const HERO_ZONES = [
  { from: -84, low: 2, to: 76, floor: 0 },
  { from: -70, low: 4, to: 64, floor: 0 },
  { from: -52, low: 6, to: 50, floor: 0.12 },
  { from: -30, low: 6, to: 32, floor: 0.4 },
  null,
  null,
];

/** The three cuts, as inner markup for brand-mark-paths.ts. */
export function headlandCuts() {
  return {
    // 24-unit small cut: 3 rings at stroke 1.25, below 64px and in the 24-unit lockup.
    small: symbol({ size: 24, count: 3, step: 2.6, margin: 1.4, stroke: 1.25, zones: [{ from: -80, low: 2, to: 64, floor: 0 }, { from: -34, low: 6, to: 34, floor: 0.45 }, null], dash: 3.2, gap: 1.6, maxGap: 1.9, dotBelow: 0.45, knot: 6.5, decimals: 2 }),
    // Lockup cut: 96 units, one ring fewer than the fine cut, so a stroke about
    // 70% heavier keeps the same open gaps beside the Fraunces wordmark.
    lockup: symbol({ size: 96, count: 5, step: 1.7, margin: 1.3, stroke: 2.2, zones: [HERO_ZONES[0], HERO_ZONES[1], HERO_ZONES[2], { from: -24, low: 6, to: 26, floor: 0.45 }, null], dash: 1.6, gap: 0.78, maxGap: 1.1, dotBelow: 0.34, knot: 5, decimals: 2, relax: [5, 4] }),
    // Fine cut: 96 units, 6 rings at stroke 1.3, for hero use.
    hero: symbol({ size: 96, count: 6, step: 1.42, margin: 1.2, stroke: 1.3, zones: HERO_ZONES, dash: 1.35, gap: 0.62, maxGap: 0.95, dotBelow: 0.28, knot: 5, decimals: 2, relax: [5, 4] }),
  };
}
