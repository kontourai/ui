import { appendClasses, textAttribute } from "./base.js";

/**
 * Modal dialog web component wrapping the native `<dialog>` element. Mirrors the
 * React `Dialog` class contract (`.dialog` + `.dialog__*`). Authored light-DOM
 * children become the dialog body. Toggle the `open` attribute to show/hide;
 * a `k-dialog-close` event fires on dismissal.
 */
export class KDialog extends HTMLElement {
  static observedAttributes = ["open", "title", "dismissible"];

  private dialog: HTMLDialogElement | null = null;

  connectedCallback() {
    this.build();
    this.syncOpen();
  }

  attributeChangedCallback(name: string) {
    if (name === "open") {
      this.syncOpen();
      return;
    }
    this.build();
    this.syncOpen();
  }

  private get dismissible() {
    return this.getAttribute("dismissible") !== "false";
  }

  private build() {
    // Capture body content from a prior build, else from authored light children.
    const prior = this.querySelector(".dialog__body");
    const bodyNodes = prior
      ? Array.from(prior.childNodes)
      : Array.from(this.childNodes).map((node) => node.cloneNode(true));

    const dialog = document.createElement("dialog");
    dialog.className = appendClasses("dialog", this.getAttribute("class-name"));
    const ariaLabel = textAttribute(this, "title", "");
    if (ariaLabel) dialog.setAttribute("aria-label", ariaLabel);

    const surface = document.createElement("div");
    surface.className = "dialog__surface";

    const title = textAttribute(this, "title", "");
    if (title || this.dismissible) {
      const head = document.createElement("header");
      head.className = "dialog__head";
      const heading = document.createElement(title ? "h2" : "span");
      if (title) {
        heading.className = "dialog__title";
        heading.textContent = title;
      }
      head.append(heading);
      if (this.dismissible) {
        const close = document.createElement("button");
        close.type = "button";
        close.className = "dialog__close";
        close.setAttribute("aria-label", "Close");
        close.textContent = "×";
        close.addEventListener("click", () => this.close());
        head.append(close);
      }
      surface.append(head);
    }

    const body = document.createElement("div");
    body.className = "dialog__body";
    body.append(...bodyNodes);
    surface.append(body);

    dialog.append(surface);

    if (this.dismissible) {
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) this.close();
      });
    }
    dialog.addEventListener("cancel", (event) => {
      if (!this.dismissible) event.preventDefault();
    });
    dialog.addEventListener("close", () => {
      this.removeAttribute("open");
      this.dispatchEvent(new CustomEvent("k-dialog-close", { bubbles: true }));
    });

    this.dialog = dialog;
    this.replaceChildren(dialog);
  }

  private syncOpen() {
    const dialog = this.dialog;
    if (!dialog) return;
    const wantOpen = this.hasAttribute("open") && this.getAttribute("open") !== "false";
    if (wantOpen && !dialog.open) dialog.showModal();
    else if (!wantOpen && dialog.open) dialog.close();
  }

  close() {
    this.dialog?.close();
  }
}
