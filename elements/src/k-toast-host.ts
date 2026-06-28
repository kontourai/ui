import { appendClasses, textAttribute } from "./base.js";

type Tone = "positive" | "caution" | "negative" | "active" | "neutral";

export interface ToastOptions {
  tone?: Tone;
  title?: string;
  message: string;
  /** Auto-dismiss delay in ms. Use 0 to keep until manually dismissed. */
  duration?: number;
}

/**
 * Imperative toast stack. Mirrors the React `Toast`/`ToastHost` class contract
 * and owns the stateful behavior the pure React factories don't: queueing and
 * auto-dismiss timers. Call `host.notify({ tone, title, message, duration })`.
 */
export class KToastHost extends HTMLElement {
  static observedAttributes = ["placement"];

  connectedCallback() {
    this.applyHostClasses();
  }

  attributeChangedCallback() {
    this.applyHostClasses();
  }

  private applyHostClasses() {
    const placement = textAttribute(this, "placement", "bottom");
    this.className = appendClasses("toast-host", `toast-host--${placement}`, this.getAttribute("class-name"));
    this.setAttribute("role", "region");
    if (!this.getAttribute("aria-label")) this.setAttribute("aria-label", "Notifications");
  }

  notify(options: ToastOptions) {
    const tone: Tone = options.tone ?? "neutral";
    const duration = options.duration ?? 4000;

    const toast = document.createElement("div");
    toast.className = `toast toast--${tone}`;
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");

    const body = document.createElement("div");
    body.className = "toast__body";
    if (options.title) {
      const title = document.createElement("p");
      title.className = "toast__title";
      title.textContent = options.title;
      body.append(title);
    }
    const message = document.createElement("p");
    message.className = "toast__message";
    message.textContent = options.message;
    body.append(message);

    const close = document.createElement("button");
    close.type = "button";
    close.className = "toast__close";
    close.setAttribute("aria-label", "Dismiss");
    close.textContent = "×";

    let timer = 0;
    const dismiss = () => {
      if (timer) clearTimeout(timer);
      toast.remove();
      this.dispatchEvent(new CustomEvent("k-toast-dismiss", { bubbles: true }));
    };
    close.addEventListener("click", dismiss);

    toast.append(body, close);
    this.append(toast);

    if (duration > 0) timer = setTimeout(dismiss, duration) as unknown as number;
    return dismiss;
  }
}
