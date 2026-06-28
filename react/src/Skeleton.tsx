import type { CSSProperties } from "react";

export interface SkeletonProps {
  /** `line` for text, `block` for cards/regions, `circle` for avatars/icons. */
  variant?: "line" | "block" | "circle";
  width?: string;
  height?: string;
  className?: string;
}

/**
 * A single pulsing placeholder. Use during cold start / data loading to hold
 * layout and signal progress instead of a blank flash or a spinner.
 */
export function Skeleton({
  variant = "block",
  width,
  height,
  className,
}: SkeletonProps) {
  const style: CSSProperties = {};
  if (width) style.width = width;
  if (height) style.height = height;
  return (
    <div
      className={`skeleton skeleton--${variant}${className ? ` ${className}` : ""}`}
      style={style}
      aria-hidden="true"
    />
  );
}
