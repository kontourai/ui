import type { InputHTMLAttributes, ReactNode } from "react";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Optional inline label rendered beside the box. */
  label?: ReactNode;
}

/**
 * Checkbox built on the native input (accent-colored via `--k-brand`), so
 * indeterminate state, keyboard, and form semantics come for free.
 */
export function Checkbox({ label, className, ...props }: CheckboxProps) {
  const input = (
    <input
      type="checkbox"
      className={["checkbox", label ? null : className].filter(Boolean).join(" ")}
      {...props}
    />
  );
  if (label == null) return input;
  return (
    <label className={["checkbox-field", className].filter(Boolean).join(" ")}>
      {input}
      <span className="checkbox-field__label">{label}</span>
    </label>
  );
}
