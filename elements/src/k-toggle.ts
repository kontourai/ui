import { appendClasses, booleanAttribute, textAttribute } from "./base.js";

export class KToggle extends HTMLElement {
  static observedAttributes = ["label", "name", "checked", "disabled"];

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  private render() {
    const label = textAttribute(this, "label", "");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("role", "switch");
    input.className = appendClasses("toggle", label ? null : this.getAttribute("class-name"));
    const name = textAttribute(this, "name", "");
    if (name) input.name = name;
    input.checked = booleanAttribute(this, "checked");
    input.disabled = booleanAttribute(this, "disabled");

    if (!label) {
      this.replaceChildren(input);
      return;
    }

    const wrapper = document.createElement("label");
    wrapper.className = appendClasses("toggle-field", this.getAttribute("class-name"));
    const text = document.createElement("span");
    text.className = "toggle-field__label";
    text.textContent = label;
    wrapper.append(input, text);
    this.replaceChildren(wrapper);
  }
}
