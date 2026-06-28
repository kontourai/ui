import type { ReactNode } from "react";

export interface EmptyProps {
  label: string;
  /**
   * Optional secondary line explaining the empty state. Accepts a node so
   * consumers can include inline markup (e.g. a `<code>` path or a link).
   */
  description?: ReactNode;
  /** Optional call-to-action (e.g. a button) so the state isn't a dead-end. */
  action?: ReactNode;
  /** Optional leading icon/glyph shown above the label. */
  icon?: ReactNode;
  /**
   * `"default"` is an inline, left-aligned note. `"prominent"` is a large
   * centered, dashed-border placeholder card for first-run / get-started
   * states. `"compact"` is the same framed card at a smaller scale for inline
   * list/column placeholders.
   */
  variant?: "default" | "prominent" | "compact";
  className?: string;
}

export function Empty({
  label,
  description,
  action,
  icon,
  variant = "default",
  className,
}: EmptyProps) {
  const classes = [
    "empty",
    variant === "prominent" && "empty--prominent",
    variant === "compact" && "empty--compact",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  // Inline + label-only (no icon) renders the original bare paragraph for
  // back-compat. Anything richer renders the structured, frameable card.
  if (variant === "default" && !description && !action && !icon) {
    return <p className={classes}>{label}</p>;
  }

  return (
    <div className={classes}>
      {icon ? (
        <span className="empty__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <p className="empty__label">{label}</p>
      {description ? <p className="empty__description">{description}</p> : null}
      {action ? <div className="empty__action">{action}</div> : null}
    </div>
  );
}
