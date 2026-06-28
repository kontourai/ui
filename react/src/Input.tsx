import type { InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Renders the invalid state and wires `aria-invalid`. */
  invalid?: boolean;
}

/** Single-line text control. Reads the shared `--k-*` control contract. */
export function Input({ invalid, className, ...props }: InputProps) {
  const classes = ["control", "control--input", invalid ? "control--invalid" : null, className]
    .filter(Boolean)
    .join(" ");
  return <input className={classes} aria-invalid={invalid || undefined} {...props} />;
}
