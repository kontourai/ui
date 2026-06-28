import { defineElement } from "./base.js";
import { KBadge } from "./k-badge.js";
import { KButton } from "./k-button.js";
import { KEmpty } from "./k-empty.js";
import { KMetric } from "./k-metric.js";
import { KPanel } from "./k-panel.js";
import { KProductIcon } from "./k-product-icon.js";
import { KProgress } from "./k-progress.js";
import { KSkeleton } from "./k-skeleton.js";
import { KStatusBadge } from "./k-status-badge.js";
import { KStatusBar } from "./k-statusbar.js";
import { KTopbar } from "./k-topbar.js";

defineElement("k-badge", KBadge);
defineElement("k-button", KButton);
defineElement("k-empty", KEmpty);
defineElement("k-metric", KMetric);
defineElement("k-panel", KPanel);
defineElement("k-product-icon", KProductIcon);
defineElement("k-progress", KProgress);
defineElement("k-skeleton", KSkeleton);
defineElement("k-status-badge", KStatusBadge);
defineElement("k-statusbar", KStatusBar);
defineElement("k-topbar", KTopbar);

export { KBadge } from "./k-badge.js";
export { KButton } from "./k-button.js";
export { KEmpty } from "./k-empty.js";
export { KMetric } from "./k-metric.js";
export { KPanel } from "./k-panel.js";
export { KProductIcon } from "./k-product-icon.js";
export { KProgress } from "./k-progress.js";
export { KSkeleton } from "./k-skeleton.js";
export { KStatusBadge } from "./k-status-badge.js";
export { KStatusBar } from "./k-statusbar.js";
export { KTopbar } from "./k-topbar.js";
export {
  normalizedClassSuffix,
  toneClass,
  toneForValue,
  toneMatchers,
  type SemanticTone,
  type ToneMatcher,
} from "../react/tones.js";
