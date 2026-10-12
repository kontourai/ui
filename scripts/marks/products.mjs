// The contour-derived product marks (owner decision, 2026-10-12): Station
// "River", Flow "A · Current" and Surface "A · Mesa". Each is built in the
// product marks' 24-unit frame, in two forms: frameless (the default product
// mark) and a badge inside a ring of r 10.25 at stroke 1.5 (for 32px and up).
//
// Ported unchanged from the owner-approved exploration: station2.mjs (the
// River construction), app-icon/src/canonical.mjs (the one canonical S, at
// 115 degrees) and flat.mjs (its flat rendering), and picks2.mjs (Current and
// Mesa).
import { turtle, translate, evalSeg, offsetChain, pieces, runData, distTo } from "./construct.mjs";
import { curveData, fit, resample } from "./geometry.mjs";

const C = [12, 12];
const RING = { r: 10.25, w: 1.5 };
const INSIDE = RING.r - 0.55;
const deg = (a) => (a * Math.PI) / 180;
const within = (r) => (p) => Math.hypot(p[0] - C[0], p[1] - C[1]) <= r;
const near = (r) => (p) => Math.hypot(p[0] - C[0], p[1] - C[1]) > r - 0.3;
// Inner markup only: the product frame (scripts/check-marks.mjs) supplies the
// root, currentColor and the default 1.75 round stroke.
const path = (d, w) => (d ? `<path${w && w !== 1.75 ? ` stroke-width="${w}"` : ""} d="${d}"/>` : "");
const ring = `<circle cx="12" cy="12" r="${RING.r}" stroke-width="${RING.w}"/>`;

// ============================================================= Station ==

// The canonical S. The centreline is a lead-in, an easing arc, a bowl of
// radius 4.6 sweeping 118 degrees, a 1.4 straight crossing, the
// point-symmetric second bowl, an easing arc and a lead-out, all joined on
// shared tangents. The easing radius is solved so both leads lie on one line
// through the centre, so the river meets the badge ring square-on. At 115
// degrees the same S also fits the Station app icon's tile. `lead` only
// lengthens the straight ends, which every rendering clips.
const CANONICAL = Object.freeze({ R: 4.6, sweep: 118, mid: 1.4, ease: 0.4, axis: 115, lead: 26 });

function walk({ R, sweep, mid, ease, axis, lead }, easeR) {
  const alpha = sweep * ease;
  const t = turtle([0, 0], deg(axis));
  t.line(lead).arc(easeR, deg(alpha)).arc(R, -deg(sweep)).line(mid).arc(R, deg(sweep)).arc(easeR, -deg(alpha)).line(lead);
  const m = evalSeg(t.segs[3], 0.5).p;
  return translate(t.segs, [C[0] - m[0], C[1] - m[1]]);
}
// Signed distance from the centre to the lead-in line.
const lateral = (segs) => {
  const s = segs[0];
  const v = [Math.cos(s.h), Math.sin(s.h)];
  return (C[0] - s.p0[0]) * -v[1] + (C[1] - s.p0[1]) * v[0];
};
function river(g) {
  let lo = 0.3;
  let hi = 30;
  const f = (r) => lateral(walk(g, r));
  if (Math.sign(f(lo)) === Math.sign(f(hi))) throw new Error(`river: no easing radius centres the leads (${f(lo)}, ${f(hi)})`);
  const sign = Math.sign(f(lo));
  for (let k = 0; k < 80; k += 1) {
    const m = (lo + hi) / 2;
    if (Math.sign(f(m)) === sign) lo = m; else hi = m;
  }
  const segs = walk(g, (lo + hi) / 2);
  if (Math.abs(lateral(segs)) > 1e-3) throw new Error(`river: could not centre the leads (${lateral(segs)})`);
  return segs;
}

// River: a 2.75 river with 1.25 contours at offsets 3, 6 and 9 either side.
// Inside a bend an offset is a concentric hairpin; a level with no room left
// is cut where it would cross itself and pulled back 2.8. Pieces under 4.5
// are dropped. In the badge the river's cap ends at the ring's outer edge;
// frameless, it stays inside the frame.
const FLAT = Object.freeze({ riverW: 2.75, thinW: 1.25, offsets: [3, -3, 6, -6, 9, -9] });
function station(frame) {
  const segs = river(CANONICAL);
  const lim = frame ? INSIDE : 10.0;
  const keepIn = within(lim);
  const onRiver = distTo(segs);
  let thin = "";
  for (const d of FLAT.offsets) {
    const off = offsetChain(segs, d, 1.0);
    const runs = pieces(off, (p) => keepIn(p) && onRiver(p) >= Math.abs(d) - 0.06, { boundary: near(lim), trim: 2.8, min: 4.5 });
    thin += runs.map((r) => runData(r)).join("");
  }
  const end = frame ? RING.r + RING.w / 2 - FLAT.riverW / 2 : 12 - FLAT.riverW / 2 - 0.3;
  const body = path(pieces(segs, within(end), { min: 1 }).map((r) => runData(r)).join(""), FLAT.riverW);
  return `${frame ? ring : ""}${path(thin, FLAT.thinW)}${body}`;
}

// ================================================================ Flow ==

// One constructed wave along the diagonal: a lead, a left arc and a right arc
// of radius 14, and a lead. Its exact parallel offsets are four equal
// streamlines; there is no hero line.
function wave(R, sweep) {
  const t = turtle([0, 0], deg(-45 + sweep / 2));
  t.line(14).arc(R, -deg(sweep)).arc(R, deg(sweep)).line(14);
  const m = evalSeg(t.segs[1], 1).p;
  return translate(t.segs, [12 - m[0], 12 - m[1]]);
}
function flow(frame) {
  const segs = wave(14, 46);
  const lim = frame ? INSIDE : 10.9;
  const keep = (p) => within(lim)(p) && p[0] >= 1.2 && p[0] <= 22.8 && p[1] >= 1.2 && p[1] <= 22.8;
  const offs = frame ? [-6.6, -2.2, 2.2, 6.6] : [-6.9, -2.3, 2.3, 6.9];
  const d = offs.map((o) => pieces(offsetChain(segs, o, 1), keep, { min: 2 }).map((r) => runData(r)).join("")).join("");
  return `${frame ? ring : ""}${path(d, 1.75)}`;
}

// ============================================================= Surface ==

// An oblique mesa. The exposed top is one landform outline with two gentle,
// deliberate harmonics, filled; each tier below is the same outline scaled a
// step wider and set a step lower, showing only its front edge.
function surface(frame) {
  const s = frame ? 0.8 : 1;
  const cy = frame ? 10.0 : 9.4;
  const T = ([x, y]) => [12 + (x - 12) * s, cy + (y - 9.4) * s];
  const outline = (scale, dy, from, to, steps = 360) => {
    const pts = [];
    for (let k = 0; k <= steps; k += 1) {
      const t = from + ((to - from) * k) / steps;
      const r = 1 + 0.06 * Math.sin(2 * t + 0.6) + 0.04 * Math.sin(3 * t + 2.2);
      pts.push(T([12 + Math.cos(t) * 8.6 * scale * r, 7.4 + dy + Math.sin(t) * 3.9 * scale * r]));
    }
    return pts;
  };
  const top = outline(0.82, 0, 0, Math.PI * 2).slice(0, -1);
  const fronts = [1, 2].map((i) => outline(0.82 + 0.12 * i, 4.2 * i, deg(6), deg(174), 180));
  const plate = `<path fill="currentColor" d="${curveData(resample(top, true, 14), true, 2)}"/>`;
  const edges = fronts.map((f) => fit(f, false, 2.2, 2)).join("");
  return `${frame ? ring : ""}${path(edges, 1.75)}${plate}`;
}

/** Inner markup per product, frameless (the default mark) and badge. */
export function productCuts() {
  return {
    station: { frameless: station(false), badge: station(true) },
    flow: { frameless: flow(false), badge: flow(true) },
    surface: { frameless: surface(false), badge: surface(true) },
  };
}
