import { appendClasses, booleanAttribute, textAttribute } from "./base.js";

export class KInput extends HTMLElement {
  static observedAttributes = ["placeholder", "value", "name", "type", "disabled", "invalid"];

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  private render() {
    const invalid = booleanAttribute(this, "invalid");
    const input = document.createElement("input");
    input.className = appendClasses(
      "control",
      "control--input",
      invalid ? "control--invalid" : null,
      this.getAttribute("class-name"),
    );
    input.type = textAttribute(this, "type", "text");
    const placeholder = textAttribute(this, "placeholder", "");
    if (placeholder) input.placeholder = placeholder;
    const name = textAttribute(this, "name", "");
    if (name) input.name = name;
    const value = textAttribute(this, "value", "");
    if (value) input.value = value;
    input.disabled = booleanAttribute(this, "disabled");
    if (invalid) input.setAttribute("aria-invalid", "true");
    this.replaceChildren(input);
  }
}
