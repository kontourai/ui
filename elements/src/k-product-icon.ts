import { productIconPaths, type ProductIconSlug } from "../react/product-icon-paths.js";
import { appendClasses, numberAttribute, textAttribute } from "./base.js";

const SVG_NS = "http://www.w3.org/2000/svg";

function isProductSlug(value: string): value is ProductIconSlug {
  return Object.prototype.hasOwnProperty.call(productIconPaths, value);
}

export class KProductIcon extends HTMLElement {
  static observedAttributes = ["product", "size", "title"];

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  private render() {
    const product = textAttribute(this, "product");
    if (!isProductSlug(product)) {
      this.replaceChildren();
      return;
    }
    const size = numberAttribute(this, "size", 24) || 24;
    const title = this.getAttribute("title");

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.75");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("class", appendClasses("product-icon", `product-icon-${product}`, this.getAttribute("class-name")));

    if (title) {
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", title);
      const titleEl = document.createElementNS(SVG_NS, "title");
      titleEl.textContent = title;
      svg.append(titleEl);
    } else {
      svg.setAttribute("aria-hidden", "true");
    }

    const group = document.createElementNS(SVG_NS, "g");
    group.innerHTML = productIconPaths[product];
    svg.append(group);
    this.replaceChildren(svg);
  }
}
