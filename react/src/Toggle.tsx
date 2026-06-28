import type { InputHTMLAttributes, ReactNode } from "react";

export interface ToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Optional inline label rendered beside the switch. */
  label?: ReactNode;
}

/**
 * On/off switch. A native checkbox with `role="switch"` styled as a track +
 * thumb, so it stays keyboard- and form-accessible while reading the `--k-*`
 * contract for the on/off colors.
 */
export function Toggle({ label, className, ...props }: ToggleProps) {
  const input = (
    <input
      type="checkbox"
      role="switch"
      className={["toggle", label ? null : className].filter(Boolean).join(" ")}
      {...props}
    />
  );
  if (label == null) return input;
  return (
    <label className={["toggle-field", className].filter(Boolean).join(" ")}>
      {input}
      <span className="toggle-field__label">{label}</span>
    </label>
  );
}
