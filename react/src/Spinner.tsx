import type { CSSProperties } from "react";

export interface SpinnerProps {
  /** Diameter in px. Defaults to 18 (inline-with-text size). */
  size?: number;
  /** Accessible label announced to assistive tech. */
  label?: string;
  className?: string;
}

/**
 * Indeterminate activity indicator. Unlike Skeleton (cold-start placeholder),
 * Spinner marks in-flight work. CSS-only ring; brand-colored leading edge.
 */
export function Spinner({ size = 18, label = "Loading", className }: SpinnerProps) {
  const style = { "--k-spinner-size": `${size}px` } as CSSProperties;
  return (
    <span
      className={["spinner", className].filter(Boolean).join(" ")}
      role="status"
      aria-label={label}
      style={style}
    />
  );
}
