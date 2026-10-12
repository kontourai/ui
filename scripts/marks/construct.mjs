// Constructed geometry for the Station, Flow and Surface marks: centrelines
// built from straight lines and circular arcs joined on shared tangents (a
// turtle walk), their exact parallel offsets (an arc offsets to a concentric
// arc, a line to a parallel line), and clipping by parameter range so every
// kept piece is still an exact line or arc. Path data is written with L and A
// commands, so nothing is approximated or smoothed by hand. Ported unchanged
// from the owner-approved exploration (2026-10-12).

const TAU = Math.PI * 2;
const fmt = (v, d = 2) => {
  const k = 10 ** d;
  let s = String(Math.round(v * k) / k);
  if (s === "-0") s = "0";
  return s.replace(/^(-?)0\./, "$1.");
};
const pt = (p, d) => `${fmt(p[0], d)} ${fmt(p[1], d)}`;

// A chain of primitives. Heading h in radians, y down, so increasing h turns
// clockwise on screen. arc(R, turn): turn > 0 turns right, turn < 0 left.
export function turtle(start, heading) {
  let p = [...start];
  let h = heading;
  const segs = [];
  const api = {
    line(len) {
      const q = [p[0] + len * Math.cos(h), p[1] + len * Math.sin(h)];
      segs.push({ type: "line", p0: p, p1: q, h, len });
      p = q;
      return api;
    },
    arc(R, turn) {
      const side = Math.sign(turn); // +1: centre on the right
      const n = [Math.cos(h + Math.PI / 2), Math.sin(h + Math.PI / 2)];
      const c = [p[0] + side * R * n[0], p[1] + side * R * n[1]];
      const a0 = Math.atan2(p[1] - c[1], p[0] - c[0]);
      segs.push({ type: "arc", c, R, a0, turn, side, h0: h });
      p = [c[0] + R * Math.cos(a0 + turn), c[1] + R * Math.sin(a0 + turn)];
      h += turn;
      return api;
    },
    get segs() { return segs; },
    get end() { return p; },
  };
  return api;
}

export const translate = (segs, [dx, dy]) => segs.map((s) => s.type === "line"
  ? { ...s, p0: [s.p0[0] + dx, s.p0[1] + dy], p1: [s.p1[0] + dx, s.p1[1] + dy] }
  : { ...s, c: [s.c[0] + dx, s.c[1] + dy] });

// Point and heading at parameter t in [0, 1] along one primitive.
export function evalSeg(s, t) {
  if (s.type === "line") return { p: [s.p0[0] + (s.p1[0] - s.p0[0]) * t, s.p0[1] + (s.p1[1] - s.p0[1]) * t], h: s.h };
  const a = s.a0 + s.turn * t;
  return { p: [s.c[0] + s.R * Math.cos(a), s.c[1] + s.R * Math.sin(a)], h: s.h0 + s.turn * t };
}
export const segLength = (s) => (s.type === "line" ? s.len : Math.abs(s.turn) * s.R);

// The exact parallel offset of a chain, `d` to the right of travel. An arc
// whose offset radius would fall under `minR` is dropped (its neighbours are
// then trimmed by the validity test in `pieces`).
export function offsetChain(segs, d, minR = 0.8) {
  return segs.map((s) => {
    if (s.type === "line") {
      const n = [Math.cos(s.h + Math.PI / 2) * d, Math.sin(s.h + Math.PI / 2) * d];
      return { ...s, p0: [s.p0[0] + n[0], s.p0[1] + n[1]], p1: [s.p1[0] + n[0], s.p1[1] + n[1]] };
    }
    const R = s.R - s.side * d;
    return R < minR ? null : { ...s, R };
  });
}

// Dense samples of a chain, each tagged with its segment and parameter.
export function sample(segs, step = 0.04) {
  const out = [];
  segs.forEach((s, i) => {
    if (!s) return;
    const n = Math.max(2, Math.ceil(segLength(s) / step));
    for (let k = 0; k <= n; k += 1) out.push({ i, t: k / n, ...evalSeg(s, k / n) });
  });
  return out;
}

// Splits a chain into the runs where keep(p) holds, as exact sub-primitives.
// A run that ends inside the field (not on `boundary`) is pulled back by
// `trim` along its length, so it stops short of what it met.
export function pieces(segs, keep, { boundary = () => false, trim = 0, min = 1 } = {}) {
  const samples = sample(segs);
  const runs = [];
  let run = [];
  let prev = null;
  for (const s of samples) {
    const gapInChain = prev && s.i !== prev.i && s.i !== prev.i + 1;
    if (keep(s.p) && !gapInChain) run.push(s);
    else { if (run.length > 1) runs.push(run); run = keep(s.p) ? [s] : []; }
    prev = s;
  }
  if (run.length > 1) runs.push(run);
  const lengthOf = (r) => r.reduce((l, s, k) => (k ? l + Math.hypot(s.p[0] - r[k - 1].p[0], s.p[1] - r[k - 1].p[1]) : 0), 0);
  return runs.map((r) => {
    let a = 0;
    let b = r.length - 1;
    const back = (from, dir) => {
      let k = from;
      let l = 0;
      while (k + dir >= 0 && k + dir < r.length && l < trim) { l += Math.hypot(r[k].p[0] - r[k + dir].p[0], r[k].p[1] - r[k + dir].p[1]); k += dir; }
      return k;
    };
    if (trim && !boundary(r[0].p)) a = back(0, 1);
    if (trim && !boundary(r.at(-1).p)) b = back(r.length - 1, -1);
    return r.slice(a, b + 1);
  }).filter((r) => r.length > 1 && lengthOf(r) >= min).map((r) => ({ segs, from: r[0], to: r.at(-1) }));
}

// Path data for one run: M, then an exact L or A for each primitive it spans.
export function runData({ segs, from, to }, d = 2) {
  let data = `M${pt(from.p, d)}`;
  for (let i = from.i; i <= to.i; i += 1) {
    const s = segs[i];
    if (!s) continue;
    const t0 = i === from.i ? from.t : 0;
    const t1 = i === to.i ? to.t : 1;
    if (t1 - t0 < 1e-6) continue;
    const end = evalSeg(s, t1).p;
    if (s.type === "line") data += `L${pt(end, d)}`;
    else {
      const sweep = Math.abs(s.turn) * (t1 - t0);
      data += `A${fmt(s.R, d)} ${fmt(s.R, d)} 0 ${sweep > Math.PI ? 1 : 0} ${s.turn > 0 ? 1 : 0} ${pt(end, d)}`;
    }
  }
  return data;
}

// Minimum distance from p to a chain (exact per primitive).
export function distTo(segs) {
  return (p) => {
    let best = Infinity;
    for (const s of segs) {
      if (!s) continue;
      if (s.type === "line") {
        const v = [s.p1[0] - s.p0[0], s.p1[1] - s.p0[1]];
        const t = Math.max(0, Math.min(1, ((p[0] - s.p0[0]) * v[0] + (p[1] - s.p0[1]) * v[1]) / (s.len * s.len)));
        best = Math.min(best, Math.hypot(p[0] - s.p0[0] - v[0] * t, p[1] - s.p0[1] - v[1] * t));
      } else {
        const a = Math.atan2(p[1] - s.c[1], p[0] - s.c[0]);
        // is the angle within the swept range?
        const lo = Math.min(s.a0, s.a0 + s.turn);
        const span = Math.abs(s.turn);
        const rel = (((a - lo) % TAU) + TAU) % TAU;
        if (rel <= span) best = Math.min(best, Math.abs(Math.hypot(p[0] - s.c[0], p[1] - s.c[1]) - s.R));
        const e0 = evalSeg(s, 0).p;
        const e1 = evalSeg(s, 1).p;
        best = Math.min(best, Math.hypot(p[0] - e0[0], p[1] - e0[1]), Math.hypot(p[0] - e1[0], p[1] - e1[1]));
      }
    }
    return best;
  };
}

export { fmt, pt };
