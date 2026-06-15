import type { ReactElement, SVGProps } from "react";
import { productIconPaths, type ProductIconSlug } from "./product-icon-paths.js";

export type { ProductIconSlug } from "./product-icon-paths.js";

export interface ProductIconProps extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  /** Square edge length in px applied to both width and height. */
  size?: number;
  /** Accessible label. When provided the icon is exposed as an image; otherwise it is hidden from assistive tech. */
  title?: string;
  className?: string;
}

interface ProductIconComponentProps extends ProductIconProps {
  product: ProductIconSlug;
}

/**
 * Renders a single Kontour product mark. Stroke uses `currentColor`, so colour
 * is themeable via the surrounding text colour.
 */
export function ProductIcon({ product, size = 24, title, className, ...props }: ProductIconComponentProps) {
  const accessibility = title ? { role: "img", "aria-label": title } : { "aria-hidden": true };
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={["product-icon", `product-icon-${product}`, className].filter(Boolean).join(" ")}
      {...accessibility}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <g dangerouslySetInnerHTML={{ __html: productIconPaths[product] }} />
    </svg>
  );
}

function makeProductIcon(product: ProductIconSlug) {
  function Icon(props: ProductIconProps) {
    return <ProductIcon product={product} {...props} />;
  }
  Icon.displayName = `${product.replace(/(^|-)([a-z])/g, (_, _sep, ch: string) => ch.toUpperCase())}Icon`;
  return Icon;
}

export const StationIcon = makeProductIcon("station");
export const SurfaceIcon = makeProductIcon("surface");
export const FlowIcon = makeProductIcon("flow");
export const VeritasIcon = makeProductIcon("veritas");
export const SurveyIcon = makeProductIcon("survey");
export const ConsoleIcon = makeProductIcon("console");
export const FlowAgentsIcon = makeProductIcon("flow-agents");

/** Map keyed by product slug, so consumers can look up an icon dynamically. */
export const productIcons: Record<ProductIconSlug, (props: ProductIconProps) => ReactElement> = {
  station: StationIcon,
  surface: SurfaceIcon,
  flow: FlowIcon,
  veritas: VeritasIcon,
  survey: SurveyIcon,
  console: ConsoleIcon,
  "flow-agents": FlowAgentsIcon,
};
