import type { ReactNode } from "react";
import { trustStatePresentation, type TrustStateName } from "./trust-states.js";

export interface TrustStateProps {
  state: TrustStateName;
  /** Visible label. Defaults to Surface's display name; an empty string falls back to it too. */
  label?: string;
  /**
   * What was checked, against what: "12 source records matched". Rendered as
   * visible text beside the chip, never hidden in a tooltip.
   */
  detail?: ReactNode;
  className?: string;
}

export function TrustState({ state, label, detail, className }: TrustStateProps) {
  const view = trustStatePresentation(state, label, className);
  return (
    <span className={view.className} data-trust-state={view.state ?? undefined}>
      <span className="trust-state__chip">
        {view.glyph ? (
          <svg className="trust-state__glyph" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path d={view.glyph} />
          </svg>
        ) : null}
        <span className="trust-state__label">{view.label}</span>
        {view.hiddenState ? <span className="trust-state__hidden"> ({view.hiddenState})</span> : null}
      </span>
      {detail != null && detail !== false && detail !== "" ? <span className="trust-state__detail">{detail}</span> : null}
    </span>
  );
}
