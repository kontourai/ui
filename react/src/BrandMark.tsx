import type { ReactElement, SVGProps } from "react";
import { BRAND_MARK_HEIGHT, brandMarkAccessibleName, brandMarkPaths, isBrandMarkSlug, type BrandMarkSlug } from "./brand-mark-paths.js";

export type { BrandMarkSlug } from "./brand-mark-paths.js";

export interface BrandMarkProps extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  /** Height in px. The width follows from the mark's aspect ratio. */
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
 * Renders a Kontour corporate mark (symbol, wordmark, or horizontal lockup).
 * Every shape paints with `currentColor`, so the mark takes the surrounding
 * text colour. Renders nothing for a mark it does not know.
 */
export function BrandMark({ mark, size = BRAND_MARK_HEIGHT, title, decorative = false, className, ...props }: BrandMarkComponentProps): ReactElement | null {
  if (!isBrandMarkSlug(mark)) return null;
  const { width, inner } = brandMarkPaths[mark];
  const name = brandMarkAccessibleName(mark, title, decorative);
  const accessibility = name ? { role: "img", "aria-label": name } : { "aria-hidden": true };
  return (
    <svg
      viewBox={`0 0 ${width} ${BRAND_MARK_HEIGHT}`}
      width={Math.round(((size * width) / BRAND_MARK_HEIGHT) * 100) / 100}
      height={size}
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
export function KontourSymbol(props: BrandMarkProps) {
  return <BrandMark mark="kontour-symbol" {...props} />;
}

export function KontourWordmark(props: BrandMarkProps) {
  return <BrandMark mark="kontour-wordmark" {...props} />;
}

export function KontourLockup(props: BrandMarkProps) {
  return <BrandMark mark="kontour-lockup-horizontal" {...props} />;
}

/** Map keyed by mark slug, so consumers can look up a corporate mark dynamically. */
export const brandMarks: Record<BrandMarkSlug, (props: BrandMarkProps) => ReactElement | null> = {
  "kontour-symbol": KontourSymbol,
  "kontour-wordmark": KontourWordmark,
  "kontour-lockup-horizontal": KontourLockup,
};
