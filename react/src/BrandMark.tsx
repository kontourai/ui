import type { ReactElement, SVGProps } from "react";
import { brandMarkPaths, isBrandMarkSlug, type BrandMarkSlug } from "./brand-mark-paths.js";
import { BRAND_MARK_HEIGHT, brandMarkName, type BrandMarkDefinition } from "./marks/frame.js";
import { kontourLockupHorizontal } from "./marks/kontour-lockup-horizontal.js";
import { kontourLockupLarge } from "./marks/kontour-lockup-large.js";
import { kontourSymbol } from "./marks/kontour-symbol.js";
import { kontourSymbolHero } from "./marks/kontour-symbol-hero.js";
import { kontourSymbolLockup } from "./marks/kontour-symbol-lockup.js";
import { kontourWordmark } from "./marks/kontour-wordmark.js";

export type { BrandMarkSlug } from "./brand-mark-paths.js";

export interface BrandMarkProps extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  /**
   * Height in px. The width follows from the mark's aspect ratio. Defaults to
   * the mark's frame height: 24, or 96 for the large cuts.
   */
  size?: number;
  /**
   * Accessible label. The wordmark and lockup default to the word they spell
   * ("Kontour"); the symbol has no default and is hidden unless titled.
   */
  title?: string;
  /** Hide the mark from assistive tech, for use beside visible text that already names the company. */
  decorative?: boolean;
  className?: string;
}

interface BrandMarkComponentProps extends BrandMarkProps {
  mark: BrandMarkSlug;
}

/**
 * Renders a Kontour corporate mark: the symbol, the wordmark, the horizontal
 * lockup, or one of the large cuts drawn for 64px and up (the symbol's lockup
 * and hero cuts, and the large lockup). Every shape paints with
 * `currentColor`, so the mark takes the surrounding text colour. Renders
 * nothing for a mark it does not know.
 */
export function BrandMark({ mark, ...props }: BrandMarkComponentProps): ReactElement | null {
  if (!isBrandMarkSlug(mark)) return null;
  return drawBrandMark(mark, brandMarkPaths[mark], props);
}

/**
 * Draws one mark from its definition, returning the svg element itself.
 * BrandMark looks the definition up in brandMarkPaths, which loads every mark;
 * the named components below pass their own, so a bundle that uses only
 * KontourWordmark carries only the wordmark (ui#121,
 * scripts/check-tree-shaking.mjs).
 */
function drawBrandMark(mark: BrandMarkSlug, definition: BrandMarkDefinition, { size, title, decorative = false, className, ...props }: BrandMarkProps) {
  const { width, height = BRAND_MARK_HEIGHT, inner } = definition;
  const name = brandMarkName(definition, title, decorative);
  const accessibility = name ? { role: "img", "aria-label": name } : { "aria-hidden": true };
  const edge = size ?? height;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={Math.round(((edge * width) / height) * 100) / 100}
      height={edge}
      fill="none"
      className={["brand-mark", `brand-mark-${mark}`, className].filter(Boolean).join(" ")}
      {...accessibility}
      {...props}
    >
      {name ? <title>{name}</title> : null}
      <g dangerouslySetInnerHTML={{ __html: inner }} />
    </svg>
  );
}

// Plain function declarations, with no module-level calls or assignments, so a
// bundler can drop this module (and the wordmark's outline) when none is used.
// Each imports only its own mark's definition, never brandMarkPaths.
export function KontourSymbol(props: BrandMarkProps) {
  return drawBrandMark("kontour-symbol", kontourSymbol, props);
}

export function KontourWordmark(props: BrandMarkProps) {
  return drawBrandMark("kontour-wordmark", kontourWordmark, props);
}

export function KontourLockup(props: BrandMarkProps) {
  return drawBrandMark("kontour-lockup-horizontal", kontourLockupHorizontal, props);
}

/** The symbol's lockup cut: heavier rings on a 96-unit frame, for 64px and up. */
export function KontourSymbolLockup(props: BrandMarkProps) {
  return drawBrandMark("kontour-symbol-lockup", kontourSymbolLockup, props);
}

/** The symbol's hero cut: six fine rings on a 96-unit frame, for 64px and up. */
export function KontourSymbolHero(props: BrandMarkProps) {
  return drawBrandMark("kontour-symbol-hero", kontourSymbolHero, props);
}

/** The horizontal lockup built on the lockup cut, for 64px and up. */
export function KontourLockupLarge(props: BrandMarkProps) {
  return drawBrandMark("kontour-lockup-large", kontourLockupLarge, props);
}

/** Map keyed by mark slug, so consumers can look up a corporate mark dynamically. */
export const brandMarks: Record<BrandMarkSlug, (props: BrandMarkProps) => ReactElement | null> = {
  "kontour-symbol": KontourSymbol,
  "kontour-wordmark": KontourWordmark,
  "kontour-lockup-horizontal": KontourLockup,
  "kontour-symbol-lockup": KontourSymbolLockup,
  "kontour-symbol-hero": KontourSymbolHero,
  "kontour-lockup-large": KontourLockupLarge,
};
