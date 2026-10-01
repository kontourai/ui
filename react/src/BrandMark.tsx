import type { ReactElement, SVGProps } from "react";
import { BRAND_MARK_HEIGHT, brandMarkPaths, type BrandMarkSlug } from "./brand-mark-paths.js";

export type { BrandMarkSlug } from "./brand-mark-paths.js";

export interface BrandMarkProps extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  /** Height in px. The width follows from the mark's aspect ratio. */
  size?: number;
  /** Accessible label. When provided the mark is exposed as an image; otherwise it is hidden from assistive tech. */
  title?: string;
  className?: string;
}

interface BrandMarkComponentProps extends BrandMarkProps {
  mark: BrandMarkSlug;
}

/**
 * Renders a Kontour corporate mark (symbol, wordmark, or horizontal lockup).
 * Every shape paints with `currentColor`, so the mark takes the surrounding
 * text colour.
 */
export function BrandMark({ mark, size = BRAND_MARK_HEIGHT, title, className, ...props }: BrandMarkComponentProps) {
  const { width, inner } = brandMarkPaths[mark];
  const accessibility = title ? { role: "img", "aria-label": title } : { "aria-hidden": true };
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
      {title ? <title>{title}</title> : null}
      <g dangerouslySetInnerHTML={{ __html: inner }} />
    </svg>
  );
}

function makeBrandMark(mark: BrandMarkSlug, displayName: string) {
  function Mark(props: BrandMarkProps) {
    return <BrandMark mark={mark} {...props} />;
  }
  Mark.displayName = displayName;
  return Mark;
}

export const KontourSymbol = makeBrandMark("kontour-symbol", "KontourSymbol");
export const KontourWordmark = makeBrandMark("kontour-wordmark", "KontourWordmark");
export const KontourLockup = makeBrandMark("kontour-lockup-horizontal", "KontourLockup");

/** Map keyed by mark slug, so consumers can look up a corporate mark dynamically. */
export const brandMarks: Record<BrandMarkSlug, (props: BrandMarkProps) => ReactElement> = {
  "kontour-symbol": KontourSymbol,
  "kontour-wordmark": KontourWordmark,
  "kontour-lockup-horizontal": KontourLockup,
};
