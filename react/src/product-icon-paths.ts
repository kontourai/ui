export type ProductIconSlug =
  | "station"
  | "surface"
  | "flow"
  | "veritas"
  | "survey"
  | "console"
  | "flow-agents"
  | "fieldwork"
  | "hachure"
  | "forage"
  | "traverse"
  | "lookout"
  | "relay"
  | "dispatch"
  | "datum"
  | "bearing"
  | "conduit"
  | "plumb"
  | "cli"
  | "ui"
  | "evals"
  | "kit-research";

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
  fieldwork:
    '<path d="M8.5 3.5v17"/><path d="M8.5 4.9 18 8.2 8.5 11.5Z"/><path d="M4.5 20.5h9"/>',
  hachure:
    '<path d="M3.5 8C7.5 4.4 16.5 4.4 20.5 8"/><path d="M7.3 6 6.1 12.9"/><path d="M12 5.3V12.4"/><path d="M16.7 6 17.9 12.9"/><path d="M3.5 20C7.5 16.4 16.5 16.4 20.5 20"/>',
  forage:
    '<path d="M4.5 9.5h15v9a1.5 1.5 0 0 1-1.5 1.5h-12a1.5 1.5 0 0 1-1.5-1.5Z"/><path d="M8.5 9.5V7a3.5 3.5 0 0 1 7 0v2.5"/>',
  traverse:
    '<path d="M4 18.5 9 8.5l5.5 6L20 5.5"/><circle cx="4" cy="18.5" r="1.1"/><circle cx="9" cy="8.5" r="1.1"/><circle cx="14.5" cy="14.5" r="1.1"/><circle cx="20" cy="5.5" r="1.1"/>',
  lookout:
    '<path d="M3.5 12S7 6.5 12 6.5 20.5 12 20.5 12 17 17.5 12 17.5 3.5 12 3.5 12Z"/><circle cx="12" cy="12" r="2.5"/>',
  relay:
    '<path d="M4.5 9h11"/><path d="M12.5 5.5 16 9l-3.5 3.5"/><path d="M19.5 15h-11"/><path d="M11.5 18.5 8 15l3.5-3.5"/>',
  dispatch:
    '<path d="M20.5 3.5 10.5 13.5"/><path d="M20.5 3.5 14 20.5l-3.5-7-7-3.5Z"/>',
  datum:
    '<path d="M12 5.5 18 16H6Z"/><circle cx="12" cy="3.6" r="1"/><path d="M4 19.5h16"/>',
  bearing:
    '<circle cx="12" cy="12" r="8.5"/><path d="M15 9l-2 4.5L9 15l2-4.5Z"/>',
  conduit:
    '<path d="M3.5 9.5h17"/><path d="M3.5 14.5h17"/><path d="M9.5 7v10"/><path d="M14.5 7v10"/>',
  plumb:
    '<path d="M12 3.5V8"/><path d="M8.5 8h7v4L12 17l-3.5-5Z"/><path d="M12 17v3.5"/>',
  cli:
    '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M7 9.5 10 12l-3 2.5"/><path d="M12.5 15H17"/>',
  ui:
    '<rect x="4" y="4" width="7" height="7" rx="1.2"/><rect x="13" y="4" width="7" height="7" rx="1.2"/><rect x="4" y="13" width="7" height="7" rx="1.2"/><path d="M13 16.5h7"/><path d="M16.5 13v7"/>',
  evals:
    '<path d="M4 16.5a8 8 0 0 1 16 0"/><path d="M12 16.5 16 10"/><path d="M3.5 20h17"/>',
  "kit-research":
    '<path d="M10 3.5h4"/><path d="M11 3.5v5L5.5 18a2 2 0 0 0 1.8 3h9.4a2 2 0 0 0 1.8-3L13 8.5v-5"/><path d="M8 14.5h8"/>',
};

export const productIconSlugs = Object.keys(productIconPaths) as ProductIconSlug[];
