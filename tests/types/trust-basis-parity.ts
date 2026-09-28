// Type parity (ui#87): Kontour UI's TrustBasisView (react/src/trust-basis.ts)
// must be the same shape as the one @kontourai/surface/display returns from
// claimBasisView. Checked by `tsc -p tests/types` from check:surface-parity;
// never built or shipped. Each Equal is exact (optionality and literal unions
// included), and the assignments check both directions.
import type * as Surface from "@kontourai/surface/display";
import type * as Ui from "../../react/src/trust-basis.js";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;

export type TrustBasisParity = [
  Assert<Equal<Ui.TrustBasisView, Surface.TrustBasisView>>,
  Assert<Equal<Ui.TrustBasisRecordedView, Surface.TrustBasisRecordedView>>,
  Assert<Equal<Ui.TrustBasisMissingView, Surface.TrustBasisMissingView>>,
  Assert<Equal<Ui.TrustBasisFacet, Surface.TrustBasisFacet>>,
  Assert<Equal<Ui.TrustBasisFacetField, Surface.TrustBasisFacetField>>,
  Assert<Equal<Ui.TrustBasisDetailRow, Surface.TrustBasisDetailRow>>,
  Assert<Equal<Ui.TrustBasisMissingState, Surface.ClaimBasisMissingState>>,
];

declare const fromSurface: Surface.TrustBasisView;
declare const fromUi: Ui.TrustBasisView;
// What claimBasisView returns can be passed to TrustBasis unchanged ...
export const surfaceToUi: Ui.TrustBasisView = fromSurface;
// ... and nothing Kontour UI accepts falls outside Surface's shape.
export const uiToSurface: Surface.TrustBasisView = fromUi;
