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
import { FLOW_BADGE } from "./marks/flow-badge.js";
import { FORAGE } from "./marks/forage.js";
import { HACHURE } from "./marks/hachure.js";
import { KIT_RESEARCH } from "./marks/kit-research.js";
import { LOOKOUT } from "./marks/lookout.js";
import { PLUMB } from "./marks/plumb.js";
import { RELAY } from "./marks/relay.js";
import { STATION } from "./marks/station.js";
import { STATION_BADGE } from "./marks/station-badge.js";
import { SURFACE } from "./marks/surface.js";
import { SURFACE_BADGE } from "./marks/surface-badge.js";
import { SURVEY } from "./marks/survey.js";
import { TRAVERSE } from "./marks/traverse.js";
import { UI } from "./marks/ui.js";
import { VERITAS } from "./marks/veritas.js";

export type ProductIconSlug =
  | "station"
  | "surface"
  | "flow"
  | "veritas"
  | "survey"
  | "console"
  | "flow-agents"
  | "fieldwork"
  | "hachure"
  | "forage"
  | "traverse"
  | "lookout"
  | "relay"
  | "dispatch"
  | "datum"
  | "bearing"
  | "conduit"
  | "plumb"
  | "cli"
  | "ui"
  | "evals"
  | "kit-research";

/**
 * Inner SVG markup for each product mark by slug, rendered inside a shared
 * 24x24 currentColor frame, for a mark chosen at runtime. Each mark lives in
 * its own module under marks/; the named icons (StationIcon, ...) import only
 * their own.
 */
export const productIconPaths: Record<ProductIconSlug, string> = {
  station: STATION,
  surface: SURFACE,
  flow: FLOW,
  veritas: VERITAS,
  survey: SURVEY,
  console: CONSOLE,
  "flow-agents": FLOW_AGENTS,
  fieldwork: FIELDWORK,
  hachure: HACHURE,
  forage: FORAGE,
  traverse: TRAVERSE,
  lookout: LOOKOUT,
  relay: RELAY,
  dispatch: DISPATCH,
  datum: DATUM,
  bearing: BEARING,
  conduit: CONDUIT,
  plumb: PLUMB,
  cli: CLI,
  ui: UI,
  evals: EVALS,
  "kit-research": KIT_RESEARCH,
};

export const productIconSlugs = /* @__PURE__ */ Object.keys(productIconPaths) as ProductIconSlug[];

/** The products whose mark also has a circular badge form. */
export type ProductBadgeSlug = "station" | "flow" | "surface";

/**
 * Inner SVG markup for the badge form of a product mark: the mark inside a
 * ring, in the same 24x24 currentColor frame. For 32px and up; the frameless
 * mark in `productIconPaths` is the default at UI sizes.
 */
export const productBadgePaths: Record<ProductBadgeSlug, string> = {
  station: STATION_BADGE,
  flow: FLOW_BADGE,
  surface: SURFACE_BADGE,
};

export const productBadgeSlugs = /* @__PURE__ */ Object.keys(productBadgePaths) as ProductBadgeSlug[];

export function isProductBadgeSlug(value: unknown): value is ProductBadgeSlug {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(productBadgePaths, value);
}
