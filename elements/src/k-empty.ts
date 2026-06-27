import { appendClasses, textAttribute } from "./base.js";

export class KEmpty extends HTMLElement {
  static observedAttributes = ["label", "description"];

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  private render() {
    const className = appendClasses("empty", this.getAttribute("class-name"));
    const label = textAttribute(this, "label", this.textContent?.trim() ?? "");
    const description = textAttribute(this, "description", "");

    // Label-only keeps the original bare paragraph; a description upgrades to
    // the structured block. (A call-to-action is React-only — it takes a node.)
    if (!description) {
      const empty = document.createElement("p");
      empty.className = className;
      empty.textContent = label;
      this.replaceChildren(empty);
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = className;
    const labelEl = document.createElement("p");
    labelEl.className = "empty__label";
    labelEl.textContent = label;
    const descEl = document.createElement("p");
    descEl.className = "empty__description";
    descEl.textContent = description;
    wrapper.replaceChildren(labelEl, descEl);
    this.replaceChildren(wrapper);
  }
}
