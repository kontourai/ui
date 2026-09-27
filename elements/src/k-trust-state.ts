import { trustStatePresentation } from "../react/trust-states.js";

// Light-DOM mirror of the React TrustState primitive. The detail comes from
// the `detail` attribute or, when that is absent, from the element's original
// children (so a detail can hold a link to the evidence).
export class KTrustState extends HTMLElement {
  static observedAttributes = ["state", "label", "detail"];

  private content: Node[] | null = null;

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    if (this.isConnected) this.render();
  }

  private render() {
    if (!this.content) this.content = [...this.childNodes];
    const view = trustStatePresentation(this.getAttribute("state"), this.getAttribute("label"), this.getAttribute("class-name"));
    const root = document.createElement("span");
    root.className = view.className;
    if (view.state) root.dataset.trustState = view.state;

    const chip = document.createElement("span");
    chip.className = "trust-state__chip";
    const glyph = document.createElement("span");
    glyph.className = "trust-state__glyph";
    glyph.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.className = "trust-state__label";
    label.textContent = view.label;
    chip.append(glyph, label);
    root.append(chip);

    const detailText = this.getAttribute("detail")?.trim();
    const hasChildDetail = this.content.some((node) => node.nodeType !== Node.TEXT_NODE || node.textContent?.trim());
    if (detailText || hasChildDetail) {
      const detail = document.createElement("span");
      detail.className = "trust-state__detail";
      if (detailText) detail.textContent = detailText;
      else detail.append(...this.content);
      root.append(detail);
    }
    this.replaceChildren(root);
  }
}
