import { appendClasses, textAttribute } from "./base.js";

/**
 * Click-triggered popover web component — the behavior-verified mirror of the
 * React `Popover`. Owns the stateful bits: open/close, outside-click, and Esc.
 * Authored light-DOM markup: a `[data-popover-trigger]` element and a
 * `[data-popover-panel]` element (falling back to first/last child).
 */
export class KPopover extends HTMLElement {
  static observedAttributes = ["placement"];

  private onPointerDown = (event: PointerEvent) => {
    if (!this.contains(event.target as Node)) this.close();
  };

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") this.close();
  };

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  disconnectedCallback() {
    document.removeEventListener("pointerdown", this.onPointerDown);
    document.removeEventListener("keydown", this.onKeyDown);
  }

  private capture(builtSelector: string, taggedSelector: string, fallback: Element | undefined) {
    const source =
      this.querySelector(builtSelector) ?? this.querySelector(taggedSelector) ?? fallback ?? null;
    return source ? source.cloneNode(true) : null;
  }

  private render() {
    const placement = textAttribute(this, "placement", "bottom-start");
    const elementChildren = Array.from(this.children);
    const triggerNode = this.capture(
      ".popover__trigger > *",
      "[data-popover-trigger]",
      elementChildren[0],
    );
    const panelNode = this.capture(
      ".popover__panel > *",
      "[data-popover-panel]",
      elementChildren[1] ?? elementChildren[0],
    );

    const root = document.createElement("span");
    root.className = appendClasses("popover", this.getAttribute("class-name"));

    // Click wrapper: the authored trigger (e.g. a <button>) stays the semantic
    // control; clicks bubble here to toggle.
    const trigger = document.createElement("span");
    trigger.className = "popover__trigger";
    if (triggerNode) trigger.append(triggerNode);

    const panel = document.createElement("div");
    panel.className = `popover__panel popover__panel--${placement}`;
    panel.setAttribute("role", "dialog");
    panel.hidden = true;
    if (panelNode) panel.append(panelNode);

    trigger.addEventListener("click", () => this.toggle());

    root.append(trigger, panel);
    this.replaceChildren(root);
  }

  private get panel() {
    return this.querySelector<HTMLElement>(".popover__panel");
  }

  toggle() {
    if (this.panel?.hidden) this.open();
    else this.close();
  }

  open() {
    const panel = this.panel;
    if (!panel || !panel.hidden) return;
    panel.hidden = false;
    document.addEventListener("pointerdown", this.onPointerDown);
    document.addEventListener("keydown", this.onKeyDown);
    this.dispatchEvent(new CustomEvent("k-popover-open", { bubbles: true }));
  }

  close() {
    const panel = this.panel;
    if (!panel || panel.hidden) return;
    panel.hidden = true;
    document.removeEventListener("pointerdown", this.onPointerDown);
    document.removeEventListener("keydown", this.onKeyDown);
    this.dispatchEvent(new CustomEvent("k-popover-close", { bubbles: true }));
  }
}
