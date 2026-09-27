// Trust states (DESIGN.md "Trust UX"): what Kontour can establish about a
// value. They are presentation states, deliberately separate from the five
// status tones: two different trust states never render identically, and none
// of them reads a product accent.
//
// This vocabulary is not Surface's claim `TrustStatus` (unknown, proposed,
// assumed, verified, stale, disputed, superseded, rejected, revoked). The two
// sets overlap only on `verified`; DESIGN.md OPEN-7 records the mapping and
// why no automatic translation ships here.
export const trustStates = [
  "verified",
  "known",
  "inferred",
  "estimated",
  "uncertain",
  "conflicting",
  "failed",
  "unavailable",
  "not-checked",
] as const;

export type TrustStateName = (typeof trustStates)[number];

/** Default visible label per state; a product may pass its own wording. */
export const trustStateLabels: Readonly<Record<TrustStateName, string>> = {
  verified: "Verified",
  known: "Known",
  inferred: "Inferred",
  estimated: "Estimated",
  uncertain: "Uncertain",
  conflicting: "Conflicting",
  failed: "Failed",
  unavailable: "Unavailable",
  "not-checked": "Not checked",
};

/**
 * Parses a state name, accepting the spellings a data source is likely to use
 * ("not checked", "NOT_CHECKED", "Not-Checked"). Returns null for anything
 * else: an unknown word is not coerced into a state it does not name.
 */
export function trustStateFor(value: string | null | undefined): TrustStateName | null {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");
  return (trustStates as readonly string[]).includes(normalized) ? (normalized as TrustStateName) : null;
}

export interface TrustStatePresentation {
  /** The recognized state, or null when the input names none. */
  state: TrustStateName | null;
  /** Always non-empty: an override, else the state's default label, else the raw input. */
  label: string;
  className: string;
}

// Shared by the React primitive and the k-trust-state element so both render
// the same classes and the same fallback.
export function trustStatePresentation(value: string | null | undefined, label?: string | null, className?: string | null): TrustStatePresentation {
  const state = trustStateFor(value);
  const override = label?.trim();
  const fallback = state ? trustStateLabels[state] : String(value ?? "").trim() || "Unrecognized trust state";
  return {
    state,
    label: override || fallback,
    className: ["trust-state", state && `trust-state--${state}`, className].filter(Boolean).join(" "),
  };
}
