import type { ReactElement, SVGProps } from "react";
import { isProductBadgeSlug, productBadgePaths, productIconPaths, type ProductBadgeSlug, type ProductIconSlug } from "./product-icon-paths.js";

export type { ProductBadgeSlug, ProductIconSlug } from "./product-icon-paths.js";

/**
 * Which form of a product mark to draw. `default` is the mark itself, for UI
 * sizes. `badge` is the mark inside a ring, for 32px and up (endorsements,
 * product cards, hero use); only the products in `ProductBadgeSlug` have one.
 */
export type ProductIconVariant = "default" | "badge";

export interface ProductIconProps extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  /** Square edge length in px applied to both width and height. */
  size?: number;
  /** Accessible label. When provided the icon is exposed as an image; otherwise it is hidden from assistive tech. */
  title?: string;
  className?: string;
}

interface ProductIconDefaultProps extends ProductIconProps {
  product: ProductIconSlug;
  variant?: "default";
}

interface ProductIconBadgeProps extends ProductIconProps {
  product: ProductBadgeSlug;
  variant: "badge";
}

/** A badge product with the variant chosen at runtime (`variant={big ? "badge" : "default"}`). */
interface ProductIconEitherProps extends ProductIconProps {
  product: ProductBadgeSlug;
  variant: ProductIconVariant;
}

/**
 * Renders a single Kontour product mark. Stroke uses `currentColor`, so colour
 * is themeable via the surrounding text colour. `variant="badge"` draws the
 * badge form, 32px by default; it renders nothing for a product without one.
 *
 * Overloaded rather than typed with a props union so the default form keeps
 * the pre-badge signature: `{ product } & ProductIconProps` in, a
 * `ReactElement` out. The middle signature takes a variant chosen at runtime
 * for a product that has a badge. The default signature is last, so
 * `ComponentProps<typeof ProductIcon>` still names it
 * (tests/types/product-icon-api.tsx).
 */
export function ProductIcon(props: ProductIconBadgeProps): ReactElement | null;
export function ProductIcon(props: ProductIconEitherProps): ReactElement | null;
export function ProductIcon(props: ProductIconDefaultProps): ReactElement;
export function ProductIcon({ product, variant = "default", size, title, className, ...props }: ProductIconDefaultProps | ProductIconEitherProps): ReactElement | null {
  const badge = variant === "badge";
  // A variant that does not exist for this product draws nothing, rather than another form of the mark.
  if (variant !== "default" && !(badge && isProductBadgeSlug(product))) return null;
  const inner = badge ? productBadgePaths[product as ProductBadgeSlug] : productIconPaths[product];
  const accessibility = title ? { role: "img", "aria-label": title } : { "aria-hidden": true };
  const edge = size ?? (badge ? 32 : 24);
  return (
    <svg
      viewBox="0 0 24 24"
      width={edge}
      height={edge}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={["product-icon", `product-icon-${product}`, badge ? "product-icon--badge" : null, className].filter(Boolean).join(" ")}
      {...accessibility}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <g dangerouslySetInnerHTML={{ __html: inner }} />
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
export const FieldworkIcon = makeProductIcon("fieldwork");
export const HachureIcon = makeProductIcon("hachure");
export const ForageIcon = makeProductIcon("forage");
export const TraverseIcon = makeProductIcon("traverse");
export const LookoutIcon = makeProductIcon("lookout");
export const RelayIcon = makeProductIcon("relay");
export const DispatchIcon = makeProductIcon("dispatch");
export const DatumIcon = makeProductIcon("datum");
export const BearingIcon = makeProductIcon("bearing");
export const ConduitIcon = makeProductIcon("conduit");
export const PlumbIcon = makeProductIcon("plumb");
export const CliIcon = makeProductIcon("cli");
export const UiIcon = makeProductIcon("ui");
export const EvalsIcon = makeProductIcon("evals");
export const KitResearchIcon = makeProductIcon("kit-research");

/** Map keyed by product slug, so consumers can look up an icon dynamically. */
export const productIcons: Record<ProductIconSlug, (props: ProductIconProps) => ReactElement> = {
  station: StationIcon,
  surface: SurfaceIcon,
  flow: FlowIcon,
  veritas: VeritasIcon,
  survey: SurveyIcon,
  console: ConsoleIcon,
  "flow-agents": FlowAgentsIcon,
  fieldwork: FieldworkIcon,
  hachure: HachureIcon,
  forage: ForageIcon,
  traverse: TraverseIcon,
  lookout: LookoutIcon,
  relay: RelayIcon,
  dispatch: DispatchIcon,
  datum: DatumIcon,
  bearing: BearingIcon,
  conduit: ConduitIcon,
  plumb: PlumbIcon,
  cli: CliIcon,
  ui: UiIcon,
  evals: EvalsIcon,
  "kit-research": KitResearchIcon,
};
