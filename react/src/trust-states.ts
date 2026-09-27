// Trust states: Surface's claim statuses, shown as presentation states
// (DESIGN.md "Trust UX"). The list and its order are Surface's TRUST_STATUSES
// (@kontourai/surface src/validation/constants.ts, mirrored by the Hachure
// status enum); the default labels are Surface's display names
// (src/display-names.ts). Kontour UI does not depend on Surface at runtime, so
// this copy is pinned by tests and must change only when Surface's does.
export const trustStates = [
  "unknown",
  "proposed",
  "assumed",
  "verified",
  "stale",
  "disputed",
  "superseded",
  "rejected",
  "revoked",
] as const;

export type TrustStateName = (typeof trustStates)[number];

/** Default visible label per state (Surface's display names); a product may pass its own wording. */
export const trustStateLabels: Readonly<Record<TrustStateName, string>> = {
  unknown: "No evidence",
  proposed: "Pending review",
  assumed: "Assumed",
  verified: "Verified",
  stale: "Needs refresh",
  disputed: "Disputed",
  superseded: "Superseded",
  rejected: "Rejected",
  revoked: "Revoked",
};

// Glyph shapes (16px grid, stroked with currentColor). Inline SVG rather than
// font characters, so every platform draws the same shape.
const glyphs: Readonly<Record<TrustStateName, string>> = {
  unknown: "M8 2.75a5.25 5.25 0 1 0 0 10.5a5.25 5.25 0 1 0 0-10.5Z", // empty circle: nothing recorded
  proposed: "M8 2.75a5.25 5.25 0 1 0 0 10.5a5.25 5.25 0 1 0 0-10.5ZM8 5.25V8l2 1.5", // clock: awaiting review
  assumed: "M2.75 9.5c1.5-3 3.5-3 5.25-1.5s3.75 1.5 5.25-1.5", // wave: taken as true, not established
  verified: "M3.25 8.5l3 3 6.5-7", // check
  stale: "M12.75 8a4.75 4.75 0 1 1-1.4-3.36M12.75 2.75v3h-3", // refresh arrow
  disputed: "M3 6.25h10M3 9.75h10M10.25 3l-4.5 10", // not equal
  superseded: "M2.75 8h8M8 5l3 3-3 3M13.25 3.25v9.5", // arrow to the newer claim
  rejected: "M4 4l8 8M12 4l-8 8", // cross
  revoked: "M8 2.75a5.25 5.25 0 1 0 0 10.5a5.25 5.25 0 1 0 0-10.5ZM4.3 11.7l7.4-7.4", // circle slash: withdrawn
};

/**
 * Parses a state name, accepting casing and separator variants ("Unknown",
 * " VERIFIED "). Returns null for anything else: an unrecognized word is not
 * coerced into a state it does not name.
 */
export function trustStateFor(value: string | null | undefined): TrustStateName | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  return (trustStates as readonly string[]).includes(normalized) ? (normalized as TrustStateName) : null;
}

// Internal: shared by the React primitive and the k-trust-state element so
// both render the same classes, glyph, and fallbacks. Not a public export.
export interface TrustStatePresentation {
  /** The recognized state, or null when the input names none. */
  state: TrustStateName | null;
  /** Always non-empty: an override, else the state's default label, else the raw input. */
  label: string;
  /** The default label, when an override replaced it, so assistive tech still hears the state. */
  hiddenState: string | null;
  /** SVG path for the state's glyph; null for an unrecognized state (no glyph box). */
  glyph: string | null;
  className: string;
}

export function trustStatePresentation(value: string | null | undefined, label?: string | null, className?: string | null): TrustStatePresentation {
  const state = trustStateFor(value);
  const override = label?.trim();
  const fallback = state ? trustStateLabels[state] : String(value ?? "").trim() || "Unrecognized trust state";
  const shown = override || fallback;
  return {
    state,
    label: shown,
    hiddenState: state && shown !== trustStateLabels[state] ? trustStateLabels[state] : null,
    glyph: state ? glyphs[state] : null,
    className: ["trust-state", state && `trust-state--${state}`, className].filter(Boolean).join(" "),
  };
}
