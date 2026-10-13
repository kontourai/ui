// What the brand-mark modules in this directory share: the definition shape
// and the frames. Each mark's path data lives in its own module
// (react/src/marks/<slug>.ts, beside icons/<slug>.svg), so a bundle carries
// only the marks it references (ui#121). The lookup maps in
// brand-mark-paths.ts and product-icon-paths.ts import every module.

export interface BrandMarkDefinition {
  /** Width of the mark's frame in viewBox units. */
  width: number;
  /**
   * Height of the mark's frame in viewBox units: `BRAND_MARK_HEIGHT` (24)
   * unless given. The large cuts drawn for 64px and up are 96 units high.
   */
  height?: number;
  /**
   * The smallest height in px the mark is drawn for: 16 unless given. The
   * large cuts' fine lines are drawn for 64px and up.
   */
  minSize?: number;
  /** Inner SVG markup. Each group carries its own currentColor paint, so the root needs none. */
  inner: string;
  /**
   * The word the mark spells, for marks that contain the wordmark. It is the
   * mark's accessible name unless the caller gives a title or marks it decorative.
   */
  label?: string;
}

/** Height of the small brand marks' viewBox, shared with the product marks' 24x24 frame. */
export const BRAND_MARK_HEIGHT = 24;

/** Where the wordmark starts in the horizontal lockup: the symbol's 24-unit frame plus a 6-unit gap. */
export const LOCKUP_WORDMARK_X = 30;

/** Frame height of the large cuts, their scale over the 24-unit frame, and the smallest height in px they are drawn for. */
export const LARGE_HEIGHT = 96;
export const LARGE_SCALE = LARGE_HEIGHT / BRAND_MARK_HEIGHT;
export const LARGE_MIN_SIZE = 64;

/**
 * A brand mark's accessible name, from its definition: the title if given,
 * else the word the mark spells; none when decorative.
 */
export function brandMarkName(definition: BrandMarkDefinition, title: string | null | undefined, decorative: boolean): string | null {
  if (decorative) return null;
  return title || definition.label || null;
}
