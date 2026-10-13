import { BRAND_MARK_HEIGHT, brandMarkName, type BrandMarkDefinition } from "./marks/frame.js";
import { kontourLockupHorizontal } from "./marks/kontour-lockup-horizontal.js";
import { kontourLockupLarge } from "./marks/kontour-lockup-large.js";
import { kontourSymbol } from "./marks/kontour-symbol.js";
import { kontourSymbolHero } from "./marks/kontour-symbol-hero.js";
import { kontourSymbolLockup } from "./marks/kontour-symbol-lockup.js";
import { kontourWordmark } from "./marks/kontour-wordmark.js";

export { BRAND_MARK_HEIGHT, type BrandMarkDefinition };

export type BrandMarkSlug =
  | "kontour-symbol"
  | "kontour-wordmark"
  | "kontour-lockup-horizontal"
  | "kontour-symbol-lockup"
  | "kontour-symbol-hero"
  | "kontour-lockup-large";

/**
 * Corporate marks by slug, for a mark chosen at runtime. Each definition lives
 * in its own module under marks/, so this map is the one place that loads
 * them all; the named components (KontourWordmark, ...) import only their own.
 * The corporate symbol, Headland, has three cuts (kontour-symbol,
 * kontour-symbol-lockup, kontour-symbol-hero); the lockups are composed from a
 * symbol cut and the wordmark, never drawn separately.
 */
export const brandMarkPaths: Record<BrandMarkSlug, BrandMarkDefinition> = {
  "kontour-symbol": kontourSymbol,
  "kontour-wordmark": kontourWordmark,
  "kontour-lockup-horizontal": kontourLockupHorizontal,
  "kontour-symbol-lockup": kontourSymbolLockup,
  "kontour-symbol-hero": kontourSymbolHero,
  "kontour-lockup-large": kontourLockupLarge,
};

export const brandMarkSlugs = /* @__PURE__ */ Object.keys(brandMarkPaths) as BrandMarkSlug[];

export function isBrandMarkSlug(value: unknown): value is BrandMarkSlug {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(brandMarkPaths, value);
}

/**
 * How a brand mark is exposed to assistive tech. A title names it; otherwise a
 * mark that spells the company name is named by that word, so a header that
 * shows only the lockup still announces it; `decorative` hides the mark, for
 * use beside visible text that already says the name. The symbol alone has no
 * default name and is hidden unless titled.
 */
export function brandMarkAccessibleName(mark: BrandMarkSlug, title: string | null | undefined, decorative: boolean): string | null {
  return brandMarkName(brandMarkPaths[mark], title, decorative);
}
