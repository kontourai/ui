// Trust basis (DESIGN.md "Trust UX"): the line after a trust-state chip that
// says how the claim's status was established. Surface owns the summary:
// `claimBasisView(claim, evidence)` from `@kontourai/surface/display` picks the
// facets, their order, their labels, which ones are caveats, and the wording of
// every missing state. Kontour UI only renders the view it is given; it never
// adds, drops, reorders, relabels, or truncates facets.
//
// The types below are a structural copy of Surface's TrustBasisView
// (kontourai/surface src/claim-basis-view.ts at 42ab7b3, released in 3.3.0).
// Kontour UI does not depend on Surface at runtime, so this copy is pinned by
// tests/types/trust-basis-parity.ts, which fails when the two shapes diverge.

/** Which field a basis facet summarizes. */
export type TrustBasisFacetField = "derivationMethod" | "result" | "supportStrength" | "counterevidence" | "method" | "reviewerAuthority";

/** One item on the basis line. */
export interface TrustBasisFacet {
  field: TrustBasisFacetField;
  /** Machine-readable value, e.g. a wire enum or a derived state code. */
  code: string;
  /** Reader-facing text, ready to render. */
  label: string;
  /** True for facets that limit how far the status can be relied on. */
  caveat: boolean;
}

/** One labelled inspector row. */
export interface TrustBasisDetailRow {
  label: string;
  value: string;
}

/** A claim whose basis Surface can summarize. */
export interface TrustBasisRecordedView {
  state: "recorded";
  facets: TrustBasisFacet[];
  detail?: TrustBasisDetailRow[];
}

/** Why a claim's basis line has nothing to summarize. Never rendered as blank. */
export type TrustBasisMissingState = "not-recorded" | "restricted" | "unavailable" | "not-available";

/** A claim whose basis cannot be summarized; `label` is always non-empty. */
export interface TrustBasisMissingView {
  state: TrustBasisMissingState;
  label: string;
  /** Inspector rows for what is recorded but not part of the basis line (e.g. a producer rating). */
  detail?: TrustBasisDetailRow[];
}

export type TrustBasisView = TrustBasisRecordedView | TrustBasisMissingView;

export type TrustBasisDensity = "inline" | "inspector";

const MISSING_STATES: readonly string[] = ["not-recorded", "restricted", "unavailable", "not-available"];

// Shown when the input is not a usable view. It is the only basis wording
// Kontour UI owns, and it equals Surface's label for `not-available` (the
// state for "cannot tell which applies"); check:surface-parity pins that.
export const TRUST_BASIS_FALLBACK_LABEL = "Basis not available";

// Internal: shared by the React primitive and the k-trust-basis element so both
// render the same structure. Not a public export.
export interface TrustBasisPresentation {
  /** The view's state; `not-available` when the input was unusable. */
  state: string;
  /** Recorded facets to render, in the view's order. Empty for a missing state. */
  facets: TrustBasisFacet[];
  /** Missing-state text; null when facets render instead. */
  label: string | null;
  /** Inspector rows (rendered at inspector density only). */
  detail: TrustBasisDetailRow[];
  density: TrustBasisDensity;
  className: string;
}

const warned = new Set<string>();
function warn(message: string) {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(`[@kontourai/ui TrustBasis] ${message}`);
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const nonEmpty = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";

function detailRows(value: unknown): TrustBasisDetailRow[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    warn("`detail` is not an array; inspector rows were skipped.");
    return [];
  }
  const rows = value.filter((row): row is TrustBasisDetailRow => isRecord(row) && nonEmpty(row.label) && nonEmpty(row.value));
  if (rows.length !== value.length) warn("Skipped detail rows without a non-empty label and value.");
  return rows;
}

/**
 * Normalizes whatever the host passed into something that always renders
 * text. It validates the view's shape and nothing else: facets are kept in the
 * view's order with the view's labels. An unusable input (not an object, an
 * unknown state, no renderable facet, an empty missing label) renders
 * "Basis not available" and warns, never an empty line.
 */
export function trustBasisPresentation(basis: unknown, density?: string | null, className?: string | null): TrustBasisPresentation {
  const shownDensity: TrustBasisDensity = density === "inspector" ? "inspector" : "inline";
  const classes = ["trust-basis", `trust-basis--${shownDensity}`, className].filter(Boolean).join(" ");
  const fallback = (reason: string): TrustBasisPresentation => {
    warn(`${reason} Rendering "${TRUST_BASIS_FALLBACK_LABEL}".`);
    return { state: "not-available", facets: [], label: TRUST_BASIS_FALLBACK_LABEL, detail: [], density: shownDensity, className: classes };
  };

  if (!isRecord(basis)) return fallback("No basis view was given (expected a TrustBasisView from claimBasisView).");
  const detail = detailRows(basis.detail);
  if (basis.state === "recorded") {
    if (!Array.isArray(basis.facets)) return fallback("A recorded basis view has no `facets` array.");
    const facets = basis.facets.filter(
      (facet): facet is TrustBasisFacet => isRecord(facet) && nonEmpty(facet.label) && typeof facet.field === "string" && typeof facet.code === "string" && typeof facet.caveat === "boolean",
    );
    if (facets.length !== basis.facets.length) warn("Skipped facets without a field, code, non-empty label, and boolean caveat.");
    if (facets.length === 0) return fallback("A recorded basis view has no renderable facets.");
    return { state: "recorded", facets, label: null, detail, density: shownDensity, className: classes };
  }
  if (typeof basis.state === "string" && MISSING_STATES.includes(basis.state)) {
    if (!nonEmpty(basis.label)) return fallback(`The "${basis.state}" basis view has no label.`);
    return { state: basis.state, facets: [], label: basis.label, detail, density: shownDensity, className: classes };
  }
  return fallback(`Unrecognized basis state ${JSON.stringify(basis.state)}.`);
}

/** Parses the `basis-json` attribute; null for absent or unparsable JSON (which then renders the fallback). */
export function parseTrustBasisJson(value: string | null): unknown {
  if (value === null || value.trim() === "") return null;
  try {
    return JSON.parse(value);
  } catch {
    warn("`basis-json` is not valid JSON.");
    return null;
  }
}
