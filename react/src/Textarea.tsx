import type { TextareaHTMLAttributes } from "react";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Renders the invalid state and wires `aria-invalid`. */
  invalid?: boolean;
}

/** Multi-line text control sharing the same control contract as Input. */
export function Textarea({ invalid, className, ...props }: TextareaProps) {
  const classes = ["control", "control--textarea", invalid ? "control--invalid" : null, className]
    .filter(Boolean)
    .join(" ");
  return <textarea className={classes} aria-invalid={invalid || undefined} {...props} />;
}
