import { trustStatePresentation } from "../react/trust-states.js";
import { prepareLightDomHost } from "./base.js";

const SVG = "http://www.w3.org/2000/svg";

// Light-DOM mirror of the React TrustState primitive. The detail comes from
// the `detail` attribute or, when that is absent, from the element's children.
// Children are read once, on the first render: like k-panel, rendering waits
// a microtask so children the parser creates after the start tag are included,
// but children added later are not picked up.
export class KTrustState extends HTMLElement {
  static observedAttributes = ["state", "label", "detail"];

  private content: Node[] | null = null;
  private connected = false;
  private renderQueued = false;

  connectedCallback() {
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
    if (!this.content) this.content = [...this.childNodes];
    const view = trustStatePresentation(this.getAttribute("state"), this.getAttribute("label"), this.getAttribute("class-name"));
    const root = document.createElement("span");
    root.className = view.className;
    if (view.state) root.dataset.trustState = view.state;

    const chip = document.createElement("span");
    chip.className = "trust-state__chip";
    if (view.glyph) {
      const svg = document.createElementNS(SVG, "svg");
      svg.setAttribute("class", "trust-state__glyph");
      svg.setAttribute("viewBox", "0 0 16 16");
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("focusable", "false");
      const path = document.createElementNS(SVG, "path");
      path.setAttribute("d", view.glyph);
      svg.append(path);
      chip.append(svg);
    }
    const label = document.createElement("span");
    label.className = "trust-state__label";
    label.textContent = view.label;
    chip.append(label);
    if (view.hiddenState) {
      const hidden = document.createElement("span");
      hidden.className = "trust-state__hidden";
      hidden.textContent = ` (${view.hiddenState})`;
      chip.append(hidden);
    }
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
