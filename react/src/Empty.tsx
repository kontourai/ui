import type { ReactNode } from "react";

export interface EmptyProps {
  label: string;
  /** Optional secondary line explaining the empty state. */
  description?: string;
  /** Optional call-to-action (e.g. a button) so the state isn't a dead-end. */
  action?: ReactNode;
  className?: string;
}

export function Empty({ label, description, action, className }: EmptyProps) {
  const classes = ["empty", className].filter(Boolean).join(" ");

  // Label-only renders the original bare paragraph, unchanged for back-compat.
  if (!description && !action) {
    return <p className={classes}>{label}</p>;
  }

  return (
    <div className={classes}>
      <p className="empty__label">{label}</p>
      {description ? <p className="empty__description">{description}</p> : null}
      {action ? <div className="empty__action">{action}</div> : null}
    </div>
  );
}
