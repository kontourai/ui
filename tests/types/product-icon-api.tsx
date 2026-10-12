// Type contract for ProductIcon (ui#120 review). Checked by `npm run check:types`
// (`tsc -p tests/types/tsconfig.api.json`); never built or shipped.
//
// The badge variant must stay additive: code written against the pre-badge
// ProductIcon, which took `{ product: ProductIconSlug } & ProductIconProps` and
// returned a ReactElement, has to keep compiling unchanged.
import type { ComponentProps, ReactElement } from "react";
import { ProductIcon, type ProductIconProps, type ProductIconSlug } from "../../react/src/index.js";

// A wrapper typed from the component's own props, forwarding them on.
export function Wrapped({ product, ...rest }: ComponentProps<typeof ProductIcon>) {
  return <ProductIcon product={product} {...rest} />;
}

// The component assigned where an element-returning component is expected.
export const Assigned: (props: { product: ProductIconSlug } & ProductIconProps) => ReactElement = ProductIcon;

// A plain call still returns a ReactElement, not ReactElement | null.
export const element: ReactElement = ProductIcon({ product: "veritas", size: 16 });

// The badge form is accepted for the products that have one...
export const badge = <ProductIcon product="station" variant="badge" size={48} />;
// ...and refused at compile time for the rest.
// @ts-expect-error veritas has no badge form
export const noBadge = <ProductIcon product="veritas" variant="badge" />;
