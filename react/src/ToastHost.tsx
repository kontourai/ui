import type { ReactNode } from "react";

export type ToastPlacement = "top" | "bottom" | "top-start" | "bottom-start";

export interface ToastHostProps {
  /** Stack corner/edge. Defaults to "bottom" (bottom-right). */
  placement?: ToastPlacement;
  /** Toast nodes to stack. */
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}

/**
 * Fixed-position container that stacks Toasts in the top layer (reads
 * `--k-z-toast`). Presentational: render Toasts as children and control their
 * lifecycle in app state, or use the `k-toast-host` element for an imperative
 * auto-dismissing stack.
 */
export function ToastHost({
  placement = "bottom",
  children,
  className,
  ariaLabel = "Notifications",
}: ToastHostProps) {
  const classes = ["toast-host", `toast-host--${placement}`, className].filter(Boolean).join(" ");
  return (
    <div className={classes} role="region" aria-label={ariaLabel}>
      {children}
    </div>
  );
}
