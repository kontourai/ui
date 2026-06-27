import type { ReactNode } from "react";

export interface StatusBarItem {
  /** Optional dim label shown before the value. */
  label?: string;
  value: ReactNode;
  /** Native tooltip / accessible hint. */
  title?: string;
}

export interface StatusBarProps {
  /** Leading cluster — e.g. a status indicator + current context. */
  start?: ReactNode;
  /** Status segments shown after the lead. */
  items?: StatusBarItem[];
  /** Trailing cluster, pushed to the end — e.g. shortcuts / actions. */
  actions?: ReactNode;
  className?: string;
  ariaLabel?: string;
}

/**
 * A thin, single-line status bar for the bottom edge of an app window — the
 * IDE/desktop "where am I + what's happening" strip. Presentational only:
 * callers pass content for the lead, the status segments, and the trailing
 * actions.
 */
export function StatusBar({
  start,
  items = [],
  actions,
  className,
  ariaLabel,
}: StatusBarProps) {
  return (
    <footer
      className={["statusbar", className].filter(Boolean).join(" ")}
      aria-label={ariaLabel ?? "Status bar"}
    >
      {start ? <div className="statusbar-start">{start}</div> : null}
      {items.length ? (
        <div className="statusbar-items">
          {items.map((item, index) => (
            <span
              className="statusbar-item"
              title={item.title}
              key={item.label ?? index}
            >
              {item.label ? (
                <span className="statusbar-item-label">{item.label}</span>
              ) : null}
              <span className="statusbar-item-value">{item.value}</span>
            </span>
          ))}
        </div>
      ) : null}
      {actions ? <div className="statusbar-actions">{actions}</div> : null}
    </footer>
  );
}
