import type { ReactNode, SelectHTMLAttributes } from "react";

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Convenience option list. Omit and pass `<option>` children for full control. */
  options?: SelectOption[];
  /** Leading, non-selectable placeholder option. */
  placeholder?: string;
  /** Renders the invalid state and wires `aria-invalid`. */
  invalid?: boolean;
  children?: ReactNode;
}

/**
 * Styled native `<select>`. Native semantics (keyboard, accessibility, mobile
 * pickers) for free; the chevron + control chrome read the `--k-*` contract.
 */
export function Select({ options, placeholder, invalid, className, children, ...props }: SelectProps) {
  const classes = ["control", "control--select", invalid ? "control--invalid" : null, className]
    .filter(Boolean)
    .join(" ");
  return (
    <span className="select">
      <select className={classes} aria-invalid={invalid || undefined} {...props}>
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options
          ? options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))
          : children}
      </select>
      <span className="select__chevron" aria-hidden="true" />
    </span>
  );
}
