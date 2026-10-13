import { LOCKUP_WORDMARK_X, type BrandMarkDefinition } from "./frame.js";
import { SYMBOL } from "./kontour-symbol.js";
import { WORDMARK, WORDMARK_TEXT, WORDMARK_WIDTH } from "./kontour-wordmark.js";

/** The horizontal lockup: the small symbol cut and the wordmark, composed, never drawn separately. */
export const kontourLockupHorizontal: BrandMarkDefinition = {
  width: LOCKUP_WORDMARK_X + WORDMARK_WIDTH,
  inner: `${SYMBOL}<g transform="translate(${LOCKUP_WORDMARK_X} 0)">${WORDMARK}</g>`,
  label: WORDMARK_TEXT,
};
