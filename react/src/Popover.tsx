import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export type PopoverPlacement = "bottom-start" | "bottom-end" | "top-start" | "top-end";

export interface PopoverProps {
  /** The clickable trigger (e.g. a Button). */
  trigger: ReactNode;
  /** Panel content. */
  children: ReactNode;
  /** Corner the panel anchors to. Defaults to "bottom-start". */
  placement?: PopoverPlacement;
  className?: string;
  /** Accessible name for the panel. */
  ariaLabel?: string;
}

/**
 * Click-triggered popover panel. Stateful (uses hooks): manages open state,
 * outside-click, and Esc to dismiss. Runs under the consumer's real React
 * runtime; behavior is verified in the browser harness via `k-popover`, with
 * which it shares the `.popover*` class contract.
 */
export function Popover({
  trigger,
  children,
  placement = "bottom-start",
  className,
  ariaLabel,
}: PopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const classes = ["popover", className].filter(Boolean).join(" ");
  return (
    <span className={classes} ref={rootRef}>
      {/* Click wrapper: the consumer's own interactive element (e.g. a Button)
          stays the semantic trigger; clicks/Enter bubble here to toggle. */}
      <span className="popover__trigger" onClick={() => setOpen((value) => !value)}>
        {trigger}
      </span>
      {open ? (
        <div id={panelId} className={`popover__panel popover__panel--${placement}`} role="dialog" aria-label={ariaLabel}>
          {children}
        </div>
      ) : null}
    </span>
  );
}
