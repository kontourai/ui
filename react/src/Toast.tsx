import type { ReactNode } from "react";
import type { SemanticTone } from "./tones.js";

export interface ToastProps {
  /** Accent tone for the leading edge. Defaults to neutral. */
  tone?: SemanticTone;
  /** Optional bold heading. */
  title?: string;
  /** Body message. */
  children: ReactNode;
  /** Optional inline action (e.g. an undo button). */
  action?: ReactNode;
  /** Dismiss handler; renders a close affordance when provided. */
  onClose?: () => void;
  className?: string;
}

/**
 * A single transient notification. Presentational (pure factory) — for an
 * imperative "fire from anywhere" stack with auto-dismiss, use the `k-toast-host`
 * web component, which renders this same `.toast` contract.
 */
export function Toast({ tone = "neutral", title, children, action, onClose, className }: ToastProps) {
  const classes = ["toast", `toast--${tone}`, className].filter(Boolean).join(" ");
  return (
    <div className={classes} role="status" aria-live="polite">
      <div className="toast__body">
        {title ? <p className="toast__title">{title}</p> : null}
        <p className="toast__message">{children}</p>
        {action ? <div className="toast__action">{action}</div> : null}
      </div>
      {onClose ? (
        <button type="button" className="toast__close" aria-label="Dismiss" onClick={onClose}>
          ×
        </button>
      ) : null}
    </div>
  );
}
