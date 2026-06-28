import type { ReactNode } from "react";

export interface FieldProps {
  /** Visible field label, associated to the control via `htmlFor`. */
  label: string;
  /** `id` of the control this label describes. */
  htmlFor?: string;
  /** Optional helper text shown below the control when there's no error. */
  hint?: ReactNode;
  /** Error message. When present it replaces the hint and flags the field. */
  error?: ReactNode;
  /** Marks the field required (adds a visible marker). */
  required?: boolean;
  /** The control (Input, Select, Textarea, …). */
  children: ReactNode;
  className?: string;
}

/**
 * Label + control + hint/error wrapper. Standardizes form-row layout and the
 * label/hint/error vocabulary so every product stops re-implementing it.
 */
export function Field({ label, htmlFor, hint, error, required, children, className }: FieldProps) {
  const classes = ["field", error ? "field--error" : null, className].filter(Boolean).join(" ");
  return (
    <div className={classes}>
      <label className="field__label" htmlFor={htmlFor}>
        {label}
        {required ? (
          <span className="field__required" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p className="field__error">{error}</p>
      ) : hint ? (
        <p className="field__hint">{hint}</p>
      ) : null}
    </div>
  );
}
