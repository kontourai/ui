import { appendClasses, booleanAttribute, textAttribute } from "./base.js";

export class KSelect extends HTMLElement {
  static observedAttributes = ["placeholder", "name", "disabled", "invalid"];

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  private render() {
    // Capture authored <option> children (stable across re-renders since they
    // stay nested in the built select).
    const options = Array.from(this.querySelectorAll("option")).map((option) => option.cloneNode(true));
    const invalid = booleanAttribute(this, "invalid");

    const wrapper = document.createElement("span");
    wrapper.className = "select";

    const select = document.createElement("select");
    select.className = appendClasses(
      "control",
      "control--select",
      invalid ? "control--invalid" : null,
      this.getAttribute("class-name"),
    );
    const name = textAttribute(this, "name", "");
    if (name) select.name = name;
    select.disabled = booleanAttribute(this, "disabled");
    if (invalid) select.setAttribute("aria-invalid", "true");

    const placeholder = textAttribute(this, "placeholder", "");
    if (placeholder) {
      const option = document.createElement("option");
      option.value = "";
      option.disabled = true;
      option.textContent = placeholder;
      select.append(option);
    }
    for (const option of options) select.append(option);

    const chevron = document.createElement("span");
    chevron.className = "select__chevron";
    chevron.setAttribute("aria-hidden", "true");

    wrapper.append(select, chevron);
    this.replaceChildren(wrapper);
  }
}
