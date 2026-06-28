import { appendClasses, textAttribute } from "./base.js";

export class KEmpty extends HTMLElement {
  static observedAttributes = ["label", "description", "variant"];

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  private render() {
    const prominent = textAttribute(this, "variant", "default") === "prominent";
    const className = appendClasses(
      "empty",
      prominent ? "empty--prominent" : null,
      this.getAttribute("class-name"),
    );
    const label = textAttribute(this, "label", this.textContent?.trim() ?? "");
    const description = textAttribute(this, "description", "");

    // Inline + label-only keeps the original bare paragraph; a description (or
    // the prominent variant) upgrades to the structured block. (A call-to-action
    // is React-only — it takes a node.)
    if (!description && !prominent) {
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
    wrapper.append(labelEl);
    if (description) {
      const descEl = document.createElement("p");
      descEl.className = "empty__description";
      descEl.textContent = description;
      wrapper.append(descEl);
    }
    this.replaceChildren(wrapper);
  }
}
