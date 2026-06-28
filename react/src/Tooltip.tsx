import type { ReactNode } from "react";

export type TooltipPlacement = "top" | "bottom" | "left" | "right";

export interface TooltipProps {
  /** Tooltip content shown on hover/focus of the trigger. */
  label: ReactNode;
  /** Side of the trigger to render on. Defaults to "top". */
  placement?: TooltipPlacement;
  /** The trigger element. */
  children: ReactNode;
  className?: string;
}

/**
 * Hover/focus tooltip. Presentational (pure factory) — visibility is driven by
 * CSS `:hover`/`:focus-within` on the wrapper, so it needs no runtime state and
 * stays keyboard-reachable. Reads the `--k-z-popover` tier for layering.
 */
export function Tooltip({ label, placement = "top", children, className }: TooltipProps) {
  const classes = ["tooltip-wrapper", className].filter(Boolean).join(" ");
  return (
    <span className={classes}>
      {children}
      <span className={`tooltip tooltip--${placement}`} role="tooltip">
        {label}
      </span>
    </span>
  );
}
