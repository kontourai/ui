import { Fragment } from "react";
import { trustBasisPresentation, type TrustBasisDensity, type TrustBasisView } from "./trust-basis.js";

export interface TrustBasisProps {
  /** The view from Surface's `claimBasisView(claim, evidence)`, rendered as-is. */
  basis: TrustBasisView;
  /** `inline` (default): the one-line summary. `inspector`: the line plus one labelled row per detail. */
  density?: TrustBasisDensity;
  className?: string;
}

/**
 * How a claim's status was established, as a muted text line that follows its
 * TrustState chip. Never blank: an unusable view renders "Basis not available".
 */
export function TrustBasis({ basis, density, className }: TrustBasisProps) {
  const view = trustBasisPresentation(basis, density, className);
  const line = (
    <span className="trust-basis__line">
      {view.label !== null ? (
        <span className="trust-basis__missing">{view.label}</span>
      ) : (
        <>
          <span className="trust-basis__hidden">Basis: </span>
          {view.facets.map((facet, index) => (
            <Fragment key={index}>
              {index > 0 ? (
                <>
                  <span className="trust-basis__hidden">, </span>{" "}
                  <span className="trust-basis__sep" aria-hidden="true">·</span>{" "}
                </>
              ) : null}
              <span className="trust-basis__facet" data-field={facet.field} data-code={facet.code} data-caveat={String(facet.caveat)}>
                {facet.label}
              </span>
            </Fragment>
          ))}
        </>
      )}
    </span>
  );
  if (view.density === "inline") {
    return <span className={view.className} data-basis-state={view.state}>{line}</span>;
  }
  return (
    <div className={view.className} data-basis-state={view.state}>
      {line}
      {view.detail.length > 0 ? (
        <dl className="trust-basis__detail">
          {view.detail.map((row, index) => (
            <div className="trust-basis__row" key={index}>
              <dt className="trust-basis__term">{row.label}</dt>
              <dd className="trust-basis__value">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
