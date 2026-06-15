export type ProductIconSlug =
  | "station"
  | "surface"
  | "flow"
  | "veritas"
  | "survey"
  | "console"
  | "flow-agents";

/** Inner SVG markup for each product mark, rendered inside a shared 24x24 currentColor frame. */
export const productIconPaths: Record<ProductIconSlug, string> = {
  station:
    '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M14.5 5v14"/><path d="M6.5 9.5H11"/><path d="M6.5 12.5H11"/><circle cx="17.5" cy="9.6" r="1"/>',
  surface:
    '<path d="M12 3.5 20.5 8 12 12.5 3.5 8Z"/><path d="M3.5 12 12 16.5 20.5 12"/><path d="M3.5 16 12 20.5 20.5 16"/>',
  flow: '<rect x="7" y="3" width="10" height="5" rx="1.4"/><path d="M12 8V10.2"/><path d="M12 10.2 16.4 14.8 12 19.4 7.6 14.8Z"/><path d="M16.4 14.8H19.2V20.5"/>',
  veritas: '<path d="M12 3 19 6v5c0 5-7 9.5-7 9.5S5 16 5 11V6Z"/><path d="M9 12 11 14 15 9.6"/>',
  survey:
    '<circle cx="10" cy="10" r="5.5"/><path d="M14 14 19.5 19.5"/><path d="M7.6 9H12.4"/><path d="M7.6 11.2H11.2"/>',
  console: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9h17"/><path d="M11.5 9v10.5"/>',
  "flow-agents": '<path d="M12 3 19.5 7.5v9L12 21 4.5 16.5v-9Z"/><path d="M10.2 9.4 15 12 10.2 14.6Z"/>',
};

export const productIconSlugs = Object.keys(productIconPaths) as ProductIconSlug[];
