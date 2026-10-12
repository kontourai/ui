import { isProductBadgeSlug, productBadgePaths, productIconPaths, type ProductIconSlug } from "../react/product-icon-paths.js";
import { appendClasses, numberAttribute, textAttribute } from "./base.js";

const SVG_NS = "http://www.w3.org/2000/svg";

function isProductSlug(value: string): value is ProductIconSlug {
  return Object.prototype.hasOwnProperty.call(productIconPaths, value);
}

/**
 * A Kontour product mark. `variant="badge"` draws the badge form (the mark
 * inside a ring, 32px by default) for the products that have one; a variant
 * the product does not have renders nothing, as an unknown product does.
 */
export class KProductIcon extends HTMLElement {
  static observedAttributes = ["product", "size", "title", "variant"];

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  private render() {
    const product = textAttribute(this, "product");
    const variant = this.getAttribute("variant") ?? "default";
    const badge = variant === "badge";
    if (!isProductSlug(product) || (variant !== "default" && !(badge && isProductBadgeSlug(product)))) {
      this.replaceChildren();
      return;
    }
    const inner = badge && isProductBadgeSlug(product) ? productBadgePaths[product] : productIconPaths[product];
    const fallbackSize = badge ? 32 : 24;
    const size = numberAttribute(this, "size", fallbackSize) || fallbackSize;
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
    svg.setAttribute("class", appendClasses("product-icon", `product-icon-${product}`, badge ? "product-icon--badge" : undefined, this.getAttribute("class-name")));

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
    group.innerHTML = inner;
    svg.append(group);
    this.replaceChildren(svg);
  }
}
