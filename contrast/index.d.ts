/** A property a white-label theme may set. */
export type BrandSlotProperty = "--k-brand" | "--k-brand-contrast" | "--k-action" | "--k-action-contrast" | "--k-focus";
/** A surface the brand slot is rated against. */
export type SurfaceProperty = "--k-bg" | "--k-panel";
export type ContrastMode = "dark" | "light";
export type ShippedTheme = "default" | "console" | "flow" | "station" | "surface" | "survey";

export interface BrandSlotPair {
  readonly foreground: BrandSlotProperty;
  readonly background: BrandSlotProperty | SurfaceProperty;
  /** Minimum WCAG contrast ratio: 4.5 for text, 3 for non-text UI. */
  readonly minimum: number;
  readonly purpose: string;
}

export type ResolvedBrandSlot = Readonly<Record<BrandSlotProperty | SurfaceProperty, string>>;

/** `{ dark?, light? }`, each a map of brand-slot properties to `#rgb` / `#rrggbb` values. */
export type BrandOverride = Partial<Record<ContrastMode, Partial<Record<BrandSlotProperty, string>>>>;

export type BrandOverrideViolation =
  /** `mode` and `property` echo caller data, cut to 64 characters. */
  | { kind: "invalid-shape"; mode?: string; message: string }
  | { kind: "disallowed-property"; mode: ContrastMode; property: string; message: string }
  | { kind: "invalid-value"; mode: ContrastMode; property: BrandSlotProperty; message: string }
  | { kind: "unpaired-action"; mode: ContrastMode; property: "--k-action" | "--k-action-contrast"; message: string }
  | {
      kind: "contrast";
      mode: ContrastMode;
      /** The overridden member of the pair (the foreground when both are overridden). */
      property: BrandSlotProperty;
      pair: [BrandSlotProperty, BrandSlotProperty | SurfaceProperty];
      ratio: number;
      minimum: number;
      message: string;
    };

/** True for `#rgb` or `#rrggbb` (either case) and nothing else. */
export function isHexColor(value: unknown): value is string;
/** WCAG 2.x relative luminance. Throws a TypeError for anything but `#rgb` / `#rrggbb`. */
export function relativeLuminance(hex: string): number;
/** WCAG 2.x contrast ratio, 1 to 21. Throws a TypeError for anything but `#rgb` / `#rrggbb`. */
export function contrastRatio(a: string, b: string): number;

export const BRAND_SLOT_PROPERTIES: readonly BrandSlotProperty[];
export const BRAND_SLOT_PAIRS: readonly BrandSlotPair[];
export const SHIPPED_THEMES: Readonly<Record<ShippedTheme, Readonly<Record<ContrastMode, ResolvedBrandSlot>>>>;
export const MODES: readonly ContrastMode[];

/** The validated values, per mode, as fresh frozen null-prototype objects; empty unless the whole override passed. */
export type AcceptedBrandOverride = Readonly<Partial<Record<ContrastMode, Readonly<Partial<Record<BrandSlotProperty, string>>>>>>;

export interface BrandOverrideResult {
  /**
   * Every problem found. Messages echo caller data (cut to 64 characters) and
   * are untrusted text: escape them before rendering.
   */
  violations: BrandOverrideViolation[];
  /**
   * All or nothing: every validated mode's values when `violations` is empty,
   * and an empty object otherwise, so applying it never lands part of a
   * rejected override. Apply these, not the input, so what lands is exactly
   * what was rated.
   */
  accepted: AcceptedBrandOverride;
}

/**
 * Validate a white-label override against a shipped theme. Pass the object as
 * JSON.parse returned it: only plain objects of this realm are accepted, and a
 * Map, class instance, or cross-realm object is an `invalid-shape` violation.
 * A non-object input is an `invalid-shape` violation; an unknown `base` throws.
 * A getter or Proxy trap on the input that throws propagates the exception;
 * JSON.parse output has neither, so it cannot throw here.
 */
export function validateBrandOverride(input: { base: ShippedTheme; overrides: unknown }): BrandOverrideResult;
