import type { ReactNode } from "react";
import { trustStatePresentation, type TrustStateName } from "./trust-states.js";

export interface TrustStateProps {
  state: TrustStateName;
  /** Visible label. Defaults to the state's name; an empty string falls back to it too. */
  label?: string;
  /**
   * What was established, against what: "Verified against 12 source records".
   * Rendered as visible text beside the chip, never hidden in a tooltip.
   */
  detail?: ReactNode;
  className?: string;
}

export function TrustState({ state, label, detail, className }: TrustStateProps) {
  const view = trustStatePresentation(state, label, className);
  return (
    <span className={view.className} data-trust-state={view.state ?? undefined}>
      <span className="trust-state__chip">
        <span className="trust-state__glyph" aria-hidden="true" />
        <span className="trust-state__label">{view.label}</span>
      </span>
      {detail ? <span className="trust-state__detail">{detail}</span> : null}
    </span>
  );
}
