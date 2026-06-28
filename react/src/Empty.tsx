import type { ReactNode } from "react";

export interface EmptyProps {
  label: string;
  /** Optional secondary line explaining the empty state. */
  description?: string;
  /** Optional call-to-action (e.g. a button) so the state isn't a dead-end. */
  action?: ReactNode;
  /**
   * `"default"` is an inline, left-aligned note. `"prominent"` is a centered,
   * dashed-border placeholder card for first-run / get-started states.
   */
  variant?: "default" | "prominent";
  className?: string;
}

export function Empty({
  label,
  description,
  action,
  variant = "default",
  className,
}: EmptyProps) {
  const classes = [
    "empty",
    variant === "prominent" && "empty--prominent",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  // Inline + label-only renders the original bare paragraph (back-compat).
  // Prominent always renders the structured card so it can center + frame.
  if (variant === "default" && !description && !action) {
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
