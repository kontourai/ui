import { appendClasses, textAttribute } from "./base.js";

export class KSpinner extends HTMLElement {
  static observedAttributes = ["size", "label"];

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  private render() {
    const el = document.createElement("span");
    el.className = appendClasses("spinner", this.getAttribute("class-name"));
    el.setAttribute("role", "status");
    el.setAttribute("aria-label", textAttribute(this, "label", "Loading"));
    const size = textAttribute(this, "size", "");
    if (size) el.style.setProperty("--k-spinner-size", `${size}px`);
    this.replaceChildren(el);
  }
}
