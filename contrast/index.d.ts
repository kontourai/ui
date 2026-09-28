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
  | { kind: "invalid-shape"; mode?: string; message: string }
  | { kind: "disallowed-property"; mode: ContrastMode; property: string; message: string }
  | { kind: "invalid-value"; mode: ContrastMode; property: BrandSlotProperty; value: unknown; message: string }
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

/**
 * Validate a white-label override against a shipped theme. `overrides` is
 * treated as untrusted data (every problem is returned as a violation);
 * an unknown `base` throws. An empty result means the override may be applied.
 */
export function validateBrandOverride(input: { base: ShippedTheme; overrides: unknown }): BrandOverrideViolation[];
