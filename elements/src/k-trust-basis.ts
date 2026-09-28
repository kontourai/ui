import { parseTrustBasisJson, trustBasisPresentation, type TrustBasisView } from "../react/trust-basis.js";
import { prepareLightDomHost } from "./base.js";

// Light-DOM mirror of the React TrustBasis primitive. The view comes from the
// `basis` property or, until that is set, from the `basis-json` attribute
// (JSON of a TrustBasisView). Rendering waits a microtask, like k-trust-state,
// so a parser-created element renders once with all of its attributes, and
// several changes in one task render once.
export class KTrustBasis extends HTMLElement {
  static observedAttributes = ["basis-json", "density", "class-name"];

  private view: unknown = undefined;
  private hasView = false;
  private connected = false;
  private renderQueued = false;

  /** A TrustBasisView from Surface's claimBasisView. Takes precedence over `basis-json`; null or undefined clears it. */
  get basis(): TrustBasisView | undefined {
    return this.hasView ? (this.view as TrustBasisView) : undefined;
  }

  set basis(value: TrustBasisView | null | undefined) {
    // null and undefined both clear the property, so basis-json applies again.
    this.view = value ?? undefined;
    this.hasView = value != null;
    if (this.connected) this.queueRender();
  }

  connectedCallback() {
    // A `basis` set on the element before it was upgraded is an own property
    // that shadows the accessor; move it onto the accessor.
    if (Object.prototype.hasOwnProperty.call(this, "basis")) {
      const value = (this as { basis?: TrustBasisView }).basis;
      delete (this as { basis?: TrustBasisView }).basis;
      this.basis = value;
    }
    this.connected = true;
    this.queueRender();
  }

  attributeChangedCallback() {
    if (this.connected) this.queueRender();
  }

  private queueRender() {
    if (this.renderQueued) return;
    this.renderQueued = true;
    queueMicrotask(() => {
      this.renderQueued = false;
      if (this.isConnected) this.render();
    });
  }

  private render() {
    prepareLightDomHost(this);
    const input = this.hasView ? this.view : parseTrustBasisJson(this.getAttribute("basis-json"));
    const view = trustBasisPresentation(input, this.getAttribute("density"), this.getAttribute("class-name"));
    const root = document.createElement(view.density === "inline" ? "span" : "div");
    root.className = view.className;
    root.dataset.basisState = view.state;

    const line = document.createElement("span");
    line.className = "trust-basis__line";
    const span = (className: string, text: string) => {
      const node = document.createElement("span");
      node.className = className;
      node.textContent = text;
      return node;
    };
    if (view.label !== null) {
      line.append(span("trust-basis__missing", view.label));
    } else {
      line.append(span("trust-basis__hidden", "Basis: "));
      view.facets.forEach((facet, index) => {
        if (index > 0) {
          const sep = span("trust-basis__sep", "·");
          sep.setAttribute("aria-hidden", "true");
          line.append(span("trust-basis__hidden", ", "), " ", sep, " ");
        }
        const node = span("trust-basis__facet", facet.label);
        node.dataset.field = facet.field;
        node.dataset.code = facet.code;
        node.dataset.caveat = String(facet.caveat);
        line.append(node);
      });
    }
    root.append(line);

    if (view.density === "inspector" && view.detail.length > 0) {
      const list = document.createElement("dl");
      list.className = "trust-basis__detail";
      for (const row of view.detail) {
        const item = document.createElement("div");
        item.className = "trust-basis__row";
        const term = document.createElement("dt");
        term.className = "trust-basis__term";
        term.textContent = row.label;
        const value = document.createElement("dd");
        value.className = "trust-basis__value";
        value.textContent = row.value;
        item.append(term, value);
        list.append(item);
      }
      root.append(list);
    }
    this.replaceChildren(root);
  }
}
