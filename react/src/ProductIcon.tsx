import type { ReactElement, SVGProps } from "react";
import { isProductBadgeSlug, productBadgePaths, productIconPaths, type ProductBadgeSlug, type ProductIconSlug } from "./product-icon-paths.js";
import { BEARING } from "./marks/bearing.js";
import { CLI } from "./marks/cli.js";
import { CONDUIT } from "./marks/conduit.js";
import { CONSOLE } from "./marks/console.js";
import { DATUM } from "./marks/datum.js";
import { DISPATCH } from "./marks/dispatch.js";
import { EVALS } from "./marks/evals.js";
import { FIELDWORK } from "./marks/fieldwork.js";
import { FLOW } from "./marks/flow.js";
import { FLOW_AGENTS } from "./marks/flow-agents.js";
import { FORAGE } from "./marks/forage.js";
import { HACHURE } from "./marks/hachure.js";
import { KIT_RESEARCH } from "./marks/kit-research.js";
import { LOOKOUT } from "./marks/lookout.js";
import { PLUMB } from "./marks/plumb.js";
import { RELAY } from "./marks/relay.js";
import { STATION } from "./marks/station.js";
import { SURFACE } from "./marks/surface.js";
import { SURVEY } from "./marks/survey.js";
import { TRAVERSE } from "./marks/traverse.js";
import { UI } from "./marks/ui.js";
import { VERITAS } from "./marks/veritas.js";

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
export function ProductIcon({ product, variant = "default", ...props }: ProductIconDefaultProps | ProductIconEitherProps): ReactElement | null {
  const badge = variant === "badge";
  // A variant that does not exist for this product draws nothing, rather than another form of the mark.
  if (variant !== "default" && !(badge && isProductBadgeSlug(product))) return null;
  const inner = badge ? productBadgePaths[product as ProductBadgeSlug] : productIconPaths[product];
  return drawProductIcon(product, inner, badge, props);
}

/**
 * Draws one product mark from its inner markup, returning the svg element
 * itself. ProductIcon looks the markup up in productIconPaths and
 * productBadgePaths, which load every mark; the named icons below pass their
 * own, so a bundle that uses only StationIcon carries only the Station mark
 * (ui#121, scripts/check-tree-shaking.mjs).
 */
function drawProductIcon(product: ProductIconSlug, inner: string, badge: boolean, { size, title, className, ...props }: ProductIconProps) {
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

// Each named icon is built from its own mark's module, never from
// productIconPaths, and each call is marked pure, so a bundle keeps only the
// icons it uses.
function makeProductIcon(product: ProductIconSlug, inner: string) {
  function Icon(props: ProductIconProps) {
    return drawProductIcon(product, inner, false, props);
  }
  Icon.displayName = `${product.replace(/(^|-)([a-z])/g, (_, _sep, ch: string) => ch.toUpperCase())}Icon`;
  return Icon;
}

export const StationIcon = /* @__PURE__ */ makeProductIcon("station", STATION);
export const SurfaceIcon = /* @__PURE__ */ makeProductIcon("surface", SURFACE);
export const FlowIcon = /* @__PURE__ */ makeProductIcon("flow", FLOW);
export const VeritasIcon = /* @__PURE__ */ makeProductIcon("veritas", VERITAS);
export const SurveyIcon = /* @__PURE__ */ makeProductIcon("survey", SURVEY);
export const ConsoleIcon = /* @__PURE__ */ makeProductIcon("console", CONSOLE);
export const FlowAgentsIcon = /* @__PURE__ */ makeProductIcon("flow-agents", FLOW_AGENTS);
export const FieldworkIcon = /* @__PURE__ */ makeProductIcon("fieldwork", FIELDWORK);
export const HachureIcon = /* @__PURE__ */ makeProductIcon("hachure", HACHURE);
export const ForageIcon = /* @__PURE__ */ makeProductIcon("forage", FORAGE);
export const TraverseIcon = /* @__PURE__ */ makeProductIcon("traverse", TRAVERSE);
export const LookoutIcon = /* @__PURE__ */ makeProductIcon("lookout", LOOKOUT);
export const RelayIcon = /* @__PURE__ */ makeProductIcon("relay", RELAY);
export const DispatchIcon = /* @__PURE__ */ makeProductIcon("dispatch", DISPATCH);
export const DatumIcon = /* @__PURE__ */ makeProductIcon("datum", DATUM);
export const BearingIcon = /* @__PURE__ */ makeProductIcon("bearing", BEARING);
export const ConduitIcon = /* @__PURE__ */ makeProductIcon("conduit", CONDUIT);
export const PlumbIcon = /* @__PURE__ */ makeProductIcon("plumb", PLUMB);
export const CliIcon = /* @__PURE__ */ makeProductIcon("cli", CLI);
export const UiIcon = /* @__PURE__ */ makeProductIcon("ui", UI);
export const EvalsIcon = /* @__PURE__ */ makeProductIcon("evals", EVALS);
export const KitResearchIcon = /* @__PURE__ */ makeProductIcon("kit-research", KIT_RESEARCH);

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
