// Trust states: Surface's claim statuses, shown as presentation states
// (DESIGN.md "Trust UX"). The list and its order are Surface's TRUST_STATUSES
// (@kontourai/surface src/validation/constants.ts, mirrored by the Hachure
// status enum); the default labels are Surface's display names
// (src/display-names.ts). Kontour UI does not depend on Surface at runtime, so
// this copy is pinned by tests and must change only when Surface's does.
//
// The three tables below are frozen: renderTrustStateHtml writes their values
// into HTML, and a caller that could reassign one would change every chip
// rendered after it.
export const trustStates = Object.freeze([
  "unknown",
  "proposed",
  "assumed",
  "verified",
  "stale",
  "disputed",
  "superseded",
  "rejected",
  "revoked",
] as const);

export type TrustStateName = (typeof trustStates)[number];

/** Default visible label per state (Surface's display names); a product may pass its own wording. */
export const trustStateLabels: Readonly<Record<TrustStateName, string>> = Object.freeze({
  unknown: "No evidence",
  proposed: "Pending review",
  assumed: "Assumed",
  verified: "Verified",
  stale: "Needs refresh",
  disputed: "Disputed",
  superseded: "Superseded",
  rejected: "Rejected",
  revoked: "Revoked",
});

/**
 * SVG path per state's glyph (16px grid, stroked with currentColor). Inline
 * SVG rather than font characters, so every platform draws the same shape.
 */
export const trustStateGlyphs: Readonly<Record<TrustStateName, string>> = Object.freeze({
  unknown: "M8 2.75a5.25 5.25 0 1 0 0 10.5a5.25 5.25 0 1 0 0-10.5Z", // empty circle: nothing recorded
  proposed: "M8 2.75a5.25 5.25 0 1 0 0 10.5a5.25 5.25 0 1 0 0-10.5ZM8 5.25V8l2 1.5", // clock: awaiting review
  assumed: "M2.75 9.5c1.5-3 3.5-3 5.25-1.5s3.75 1.5 5.25-1.5", // wave: taken as true, not established
  verified: "M3.25 8.5l3 3 6.5-7", // check
  stale: "M12.75 8a4.75 4.75 0 1 1-1.4-3.36M12.75 2.75v3h-3", // refresh arrow
  disputed: "M3 6.25h10M3 9.75h10M10.25 3l-4.5 10", // not equal
  superseded: "M2.75 8h8M8 5l3 3-3 3M13.25 3.25v9.5", // arrow to the newer claim
  rejected: "M4 4l8 8M12 4l-8 8", // cross
  revoked: "M8 2.75a5.25 5.25 0 1 0 0 10.5a5.25 5.25 0 1 0 0-10.5ZM4.3 11.7l7.4-7.4", // circle slash: withdrawn
});

/**
 * Parses a state name, ignoring case and surrounding whitespace ("Unknown",
 * " VERIFIED "). Returns null for anything else: an unrecognized word is not
 * coerced into a state it does not name.
 */
export function trustStateFor(value: string | null | undefined): TrustStateName | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  return (trustStates as readonly string[]).includes(normalized) ? (normalized as TrustStateName) : null;
}

// Shared by the React primitive, the k-trust-state element, and
// renderTrustStateHtml so all three render the same classes, glyph,
// fallbacks, and detail text. Public through @kontourai/ui/trust-state only; @kontourai/ui/react
// does not export it. This module imports nothing, so that subpath pulls in
// neither React nor the custom elements.
export interface TrustStatePresentation<D = never> {
  /** The recognized state, or null when the input names none. */
  state: TrustStateName | null;
  /** Always non-empty: an override, else the state's default label, else the raw input. */
  label: string;
  /** The default label, when an override replaced it, so assistive tech still hears the state. */
  hiddenState: string | null;
  /** SVG path for the state's glyph; null for an unrecognized state (no glyph box). */
  glyph: string | null;
  className: string;
  /**
   * The detail to render, or null for none. A string is trimmed, and a blank
   * one is null; null, undefined, and booleans are null. Anything else (a
   * React node) passes through unchanged.
   */
  detail: Exclude<D, string | boolean | null | undefined> | string | null;
}

export function trustStatePresentation<D = never>(
  value: string | null | undefined,
  label?: string | null,
  className?: string | null,
  detail?: D | string | null,
): TrustStatePresentation<D> {
  const state = trustStateFor(value);
  const override = label?.trim();
  const fallback = state ? trustStateLabels[state] : String(value ?? "").trim() || "Unrecognized trust state";
  const shown = override || fallback;
  return {
    state,
    label: shown,
    // Case-only differences are the same words (and the chip uppercases them).
    hiddenState: state && shown.toLowerCase() !== trustStateLabels[state].toLowerCase() ? trustStateLabels[state] : null,
    glyph: state ? trustStateGlyphs[state] : null,
    className: ["trust-state", state && `trust-state--${state}`, className].filter(Boolean).join(" "),
    detail: typeof detail === "string" ? detail.trim() || null
      : detail == null || typeof detail === "boolean" ? null
      : detail as Exclude<D, string | boolean | null | undefined>,
  };
}

export interface TrustStateHtmlOptions {
  /** Visible label. Defaults to Surface's display name; a blank label falls back to it too. */
  label?: string | null;
  /** Plain-text detail shown beside the chip, like k-trust-state's `detail` attribute. */
  detail?: string | null;
  /** Extra classes on the root element, after the trust-state classes. */
  className?: string | null;
}

/**
 * Renders the trust-state chip as an HTML string, for renderers that build
 * markup as template strings. The output is the markup k-trust-state renders
 * for the same state, label, detail, and class name. Every interpolated value,
 * the shared glyph and state tables included, is HTML-escaped. As in k-trust-state, a value that names no state is
 * never coerced into one: it renders as its own text with no state class,
 * data attribute, or glyph. Style it with @kontourai/ui/trust-state.css and
 * the tokens.
 */
export function renderTrustStateHtml(state: string | null | undefined, options: TrustStateHtmlOptions = {}): string {
  const view = trustStatePresentation(state, options.label, options.className, options.detail);
  const glyph = view.glyph
    ? `<svg class="trust-state__glyph" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="${escapeHtml(view.glyph)}"></path></svg>`
    : "";
  const hidden = view.hiddenState ? `<span class="trust-state__hidden"> (${escapeHtml(view.hiddenState)})</span>` : "";
  return `<span class="${escapeHtml(view.className)}"${view.state ? ` data-trust-state="${escapeHtml(view.state)}"` : ""}>`
    + `<span class="trust-state__chip">${glyph}<span class="trust-state__label">${escapeHtml(view.label)}</span>${hidden}</span>`
    + (view.detail ? `<span class="trust-state__detail">${escapeHtml(view.detail)}</span>` : "")
    + "</span>";
}

function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
