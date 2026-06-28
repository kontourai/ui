import { appendClasses, textAttribute } from "./base.js";

/**
 * Hover/focus tooltip web component. Mirrors the React `Tooltip` class contract.
 * Authored light-DOM children are the trigger; the `label` attribute is the
 * tooltip text. Visibility is CSS-driven (`:hover`/`:focus-within`).
 */
export class KTooltip extends HTMLElement {
  static observedAttributes = ["label", "placement"];

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  private render() {
    const placement = textAttribute(this, "placement", "top");
    const existing = this.querySelector(".tooltip-wrapper");
    const triggerNodes = existing
      ? Array.from(existing.childNodes).filter((node) => !(node as Element).classList?.contains("tooltip"))
      : Array.from(this.childNodes).map((node) => node.cloneNode(true));

    const wrapper = document.createElement("span");
    wrapper.className = appendClasses("tooltip-wrapper", this.getAttribute("class-name"));
    wrapper.append(...triggerNodes);

    const tip = document.createElement("span");
    tip.className = `tooltip tooltip--${placement}`;
    tip.setAttribute("role", "tooltip");
    tip.textContent = textAttribute(this, "label", "");
    wrapper.append(tip);

    this.replaceChildren(wrapper);
  }
}
