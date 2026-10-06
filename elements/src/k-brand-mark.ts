import { BRAND_MARK_HEIGHT, brandMarkAccessibleName, brandMarkPaths, isBrandMarkSlug } from "../react/brand-mark-paths.js";
import { appendClasses, booleanAttribute, numberAttribute, textAttribute } from "./base.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * A Kontour corporate mark. `size` is the height in px; the width follows from
 * the mark. The wordmark and lockup are named "Kontour" for assistive tech
 * unless `title` renames them or `decorative` hides them.
 */
export class KBrandMark extends HTMLElement {
  static observedAttributes = ["mark", "size", "title", "decorative"];

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  private render() {
    const mark = textAttribute(this, "mark");
    if (!isBrandMarkSlug(mark)) {
      this.replaceChildren();
      return;
    }
    const { width, inner } = brandMarkPaths[mark];
    const size = numberAttribute(this, "size", BRAND_MARK_HEIGHT) || BRAND_MARK_HEIGHT;
    const title = brandMarkAccessibleName(mark, this.getAttribute("title"), booleanAttribute(this, "decorative"));

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${BRAND_MARK_HEIGHT}`);
    svg.setAttribute("width", String(Math.round(((size * width) / BRAND_MARK_HEIGHT) * 100) / 100));
    svg.setAttribute("height", String(size));
    svg.setAttribute("fill", "none");
    svg.setAttribute("class", appendClasses("brand-mark", `brand-mark-${mark}`, this.getAttribute("class-name")));

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
