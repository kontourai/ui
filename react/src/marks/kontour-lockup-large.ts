import { LARGE_HEIGHT, LARGE_MIN_SIZE, LARGE_SCALE, LOCKUP_WORDMARK_X, type BrandMarkDefinition } from "./frame.js";
import { SYMBOL_LOCKUP } from "./kontour-symbol-lockup.js";
import { WORDMARK, WORDMARK_TEXT, WORDMARK_WIDTH } from "./kontour-wordmark.js";

/**
 * Multiplies every number in each `d` attribute of `markup` by `factor`, to two
 * decimals. Exact for path data with no arc commands (an arc's flags and
 * rotation are not lengths), which the wordmark's outline has none of.
 */
function scalePathData(markup: string, factor: number): string {
  return markup.replace(/ d="([^"]*)"/g, (_, data: string) => ` d="${data.replace(/-?\d*\.?\d+/g, (number) => String(Math.round(Number(number) * factor * 100) / 100))}"`);
}

// The wordmark at the large cuts' scale: the same outline, scaled numerically,
// so the large lockup needs no transform beyond a translate.
const WORDMARK_LARGE = /* @__PURE__ */ scalePathData(WORDMARK, LARGE_SCALE);

/** The horizontal lockup's arrangement at four times the frame: the lockup cut, the same gap, then the wordmark. */
export const kontourLockupLarge: BrandMarkDefinition = {
  width: (LOCKUP_WORDMARK_X + WORDMARK_WIDTH) * LARGE_SCALE,
  height: LARGE_HEIGHT,
  minSize: LARGE_MIN_SIZE,
  inner: `${SYMBOL_LOCKUP}<g transform="translate(${LOCKUP_WORDMARK_X * LARGE_SCALE} 0)">${WORDMARK_LARGE}</g>`,
  label: WORDMARK_TEXT,
};
