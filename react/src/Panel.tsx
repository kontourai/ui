import type { ReactNode } from "react";

export interface PanelProps {
  title: string;
  count: number;
  children: ReactNode;
  /**
   * Optional header affordances (buttons, menus) rendered on the trailing edge
   * of the panel head. Lets consumers stop hand-rolling a `.panel-head` row to
   * attach collapse/refresh controls. (Console Kit proposal CK2.)
   */
  actions?: ReactNode;
  /** Accessible name for the section landmark. */
  ariaLabel?: string;
  className?: string;
}

export function Panel({ title, count, children, actions, ariaLabel, className }: PanelProps) {
  return (
    <section
      className={["panel", className].filter(Boolean).join(" ")}
      aria-label={ariaLabel ?? title}
    >
      <div className="panel-head">
        <h2>{title}</h2>
        <span>{count}</span>
        {actions ? <div className="panel-head__actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
