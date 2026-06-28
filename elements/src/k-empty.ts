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
    const variant = textAttribute(this, "variant", "default");
    const framed = variant === "prominent" || variant === "compact";
    const className = appendClasses(
      "empty",
      variant === "prominent" ? "empty--prominent" : null,
      variant === "compact" ? "empty--compact" : null,
      this.getAttribute("class-name"),
    );
    const label = textAttribute(this, "label", this.textContent?.trim() ?? "");
    const description = textAttribute(this, "description", "");

    // Inline + label-only keeps the original bare paragraph; a description (or
    // a framed variant) upgrades to the structured block. (Icon + call-to-action
    // are React-only — they take nodes.)
    if (!description && !framed) {
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
