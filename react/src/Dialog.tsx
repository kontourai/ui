import { useEffect, useRef, type ReactNode } from "react";

export interface DialogProps {
  /** Controlled visibility. Toggling to `true` opens it modally. */
  open: boolean;
  /** Fired on any dismissal (Esc, backdrop, or the close affordance). */
  onClose?: () => void;
  /** Optional header title. */
  title?: string;
  /** Footer affordances (e.g. confirm/cancel buttons). */
  actions?: ReactNode;
  /** When false, Esc and backdrop clicks won't dismiss. Defaults to true. */
  dismissible?: boolean;
  children: ReactNode;
  className?: string;
  /** Accessible name when no `title` is given. */
  ariaLabel?: string;
}

/**
 * Modal dialog built on the native `<dialog>` element — top-layer rendering,
 * backdrop, focus trapping, and Esc handling come from the platform; we add
 * the token-driven chrome and a controlled `open` prop.
 *
 * Stateful-primitive convention: this reads React hooks and renders under the
 * consumer's real React runtime. The package verifies the same behavior through
 * the mirrored `k-dialog` web component in the browser harness; this wrapper
 * shares the `.dialog` class contract so both render identically.
 */
export function Dialog({
  open,
  onClose,
  title,
  actions,
  dismissible = true,
  children,
  className,
  ariaLabel,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    else if (!open && node.open) node.close();
  }, [open]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const handleClose = () => onClose?.();
    node.addEventListener("close", handleClose);
    return () => node.removeEventListener("close", handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      className={["dialog", className].filter(Boolean).join(" ")}
      aria-label={ariaLabel ?? title}
      onCancel={(event) => {
        if (!dismissible) {
          event.preventDefault();
          return;
        }
        // Native `cancel` (Esc) leads to a `close` event; let it through.
      }}
      onClick={(event) => {
        if (dismissible && event.target === ref.current) ref.current?.close();
      }}
    >
      <div className="dialog__surface">
        {title || dismissible ? (
          <header className="dialog__head">
            {title ? <h2 className="dialog__title">{title}</h2> : <span />}
            {dismissible ? (
              <button
                type="button"
                className="dialog__close"
                aria-label="Close"
                onClick={() => ref.current?.close()}
              >
                ×
              </button>
            ) : null}
          </header>
        ) : null}
        <div className="dialog__body">{children}</div>
        {actions ? <footer className="dialog__actions">{actions}</footer> : null}
      </div>
    </dialog>
  );
}
