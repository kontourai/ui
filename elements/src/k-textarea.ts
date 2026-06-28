import { appendClasses, booleanAttribute, textAttribute } from "./base.js";

export class KTextarea extends HTMLElement {
  static observedAttributes = ["placeholder", "value", "name", "rows", "disabled", "invalid"];

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  private render() {
    const invalid = booleanAttribute(this, "invalid");
    const textarea = document.createElement("textarea");
    textarea.className = appendClasses(
      "control",
      "control--textarea",
      invalid ? "control--invalid" : null,
      this.getAttribute("class-name"),
    );
    const placeholder = textAttribute(this, "placeholder", "");
    if (placeholder) textarea.placeholder = placeholder;
    const name = textAttribute(this, "name", "");
    if (name) textarea.name = name;
    const rows = textAttribute(this, "rows", "");
    if (rows) textarea.rows = Number(rows);
    textarea.value = textAttribute(this, "value", this.textContent?.trim() ?? "");
    textarea.disabled = booleanAttribute(this, "disabled");
    if (invalid) textarea.setAttribute("aria-invalid", "true");
    this.replaceChildren(textarea);
  }
}
