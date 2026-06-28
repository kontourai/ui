import { appendClasses, textAttribute } from "./base.js";

export class KSkeleton extends HTMLElement {
  static observedAttributes = ["variant", "width", "height"];

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  private render() {
    const variant = textAttribute(this, "variant", "block");
    const el = document.createElement("div");
    el.className = appendClasses(
      "skeleton",
      `skeleton--${variant}`,
      this.getAttribute("class-name"),
    );
    el.setAttribute("aria-hidden", "true");
    const width = textAttribute(this, "width", "");
    const height = textAttribute(this, "height", "");
    if (width) el.style.width = width;
    if (height) el.style.height = height;
    this.replaceChildren(el);
  }
}
