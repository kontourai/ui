import { appendClasses, textAttribute } from "./base.js";

interface StatusBarItem {
  label: string;
  value: string;
}

/** Accept either a JSON array of {label,value} or a `label:value|...` string. */
function parseItems(value: string | null): StatusBarItem[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const record = item as Record<string, unknown>;
      return [
        { label: String(record.label ?? ""), value: String(record.value ?? "") },
      ];
    });
  } catch {
    return value.split("|").flatMap((entry) => {
      const [label, itemValue] = entry.split(":");
      return label && itemValue
        ? [{ label: label.trim(), value: itemValue.trim() }]
        : [{ label: "", value: entry.trim() }];
    });
  }
}

export class KStatusBar extends HTMLElement {
  static observedAttributes = ["start", "items"];

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  private render() {
    const bar = document.createElement("footer");
    bar.className = appendClasses("statusbar", this.getAttribute("class-name"));
    bar.setAttribute("aria-label", "Status bar");

    const start = textAttribute(this, "start", "");
    if (start) {
      const startEl = document.createElement("div");
      startEl.className = "statusbar-start";
      startEl.textContent = start;
      bar.append(startEl);
    }

    const items = parseItems(this.getAttribute("items"));
    if (items.length) {
      const itemsEl = document.createElement("div");
      itemsEl.className = "statusbar-items";
      for (const item of items) {
        const itemEl = document.createElement("span");
        itemEl.className = "statusbar-item";
        if (item.label) {
          const labelEl = document.createElement("span");
          labelEl.className = "statusbar-item-label";
          labelEl.textContent = item.label;
          itemEl.append(labelEl);
        }
        const valueEl = document.createElement("span");
        valueEl.className = "statusbar-item-value";
        valueEl.textContent = item.value;
        itemEl.append(valueEl);
        itemsEl.append(itemEl);
      }
      bar.append(itemsEl);
    }

    this.replaceChildren(bar);
  }
}
