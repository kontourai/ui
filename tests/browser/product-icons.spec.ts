import { expect, test, type Page } from "@playwright/test";

const PRODUCTS = ["station", "surface", "flow", "veritas", "survey", "console", "flow-agents", "fieldwork", "hachure", "forage", "traverse", "lookout", "relay", "dispatch", "datum", "bearing", "conduit", "plumb", "cli", "ui", "evals", "kit-research"] as const;

test.describe("product icons", () => {
  test("renders every k-product-icon element as a currentColor svg", async ({ page }) => {
    const consoleErrors = await loadKitPage(page, "/elements/demo.html");

    await expect(page.getByRole("main")).toContainText("Product Marks");

    for (const product of PRODUCTS) {
      const svg = page.locator(`#product-icons-mount k-product-icon[product="${product}"] svg`);
      await expect(svg).toBeVisible();
      await expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
      await expect(svg).toHaveAttribute("stroke", "currentColor");
      await expect(svg).toHaveClass(new RegExp(`product-icon-${product}`));
    }

    // title => exposed as an image with an accessible label; otherwise hidden.
    const labelled = page.locator('#product-icons-mount k-product-icon[product="station"] svg');
    await expect(labelled).toHaveAttribute("role", "img");
    await expect(labelled).toHaveAttribute("aria-label", "Station");
    const hidden = page.locator('#product-icons-mount k-product-icon[product="surface"] svg');
    await expect(hidden).toHaveAttribute("aria-hidden", "true");

    expect(consoleErrors).toEqual([]);
  });

  test("renders every React ProductIcon with the approved markup", async ({ page }) => {
    const consoleErrors = await loadKitPage(page, "/elements/demo.html");

    const results = await page.evaluate(async (products) => {
      const mod = await import("../dist/react/ProductIcon.js");
      return products.map((product) => {
        // ProductIcon returns the svg element directly (jsx shim yields plain {type, props}).
        const element = mod.ProductIcon({ product, title: product });
        const svgProps = element.props;
        const group = (Array.isArray(svgProps.children) ? svgProps.children : [svgProps.children]).find(
          (child: unknown) => child && typeof child === "object" && (child as { type?: string }).type === "g",
        ) as { props?: { dangerouslySetInnerHTML?: { __html?: string } } } | undefined;
        return {
          product,
          viewBox: svgProps.viewBox,
          stroke: svgProps.stroke,
          role: svgProps["role"],
          ariaLabel: svgProps["aria-label"],
          inner: group?.props?.dangerouslySetInnerHTML?.__html ?? "",
        };
      });
    }, PRODUCTS as unknown as string[]);

    expect(results.map((r) => r.product)).toEqual([...PRODUCTS]);
    for (const result of results) {
      expect(result.viewBox).toBe("0 0 24 24");
      expect(result.stroke).toBe("currentColor");
      expect(result.role).toBe("img");
      expect(result.ariaLabel).toBe(result.product);
      expect(result.inner.length).toBeGreaterThan(0);
    }

    expect(consoleErrors).toEqual([]);
  });

  test("draws the badge form for Station, Flow and Surface only, the same in React and the element", async ({ page }) => {
    const consoleErrors = await loadKitPage(page, "/elements/demo.html");
    const BADGES = ["station", "flow", "surface"];
    for (const product of BADGES) {
      const svg = page.locator(`#product-badges-mount k-product-icon[product="${product}"] svg`);
      await expect(svg).toBeVisible();
      // 32px by default: the badge is for 32px and up.
      await expect(svg).toHaveAttribute("width", "32");
      await expect(svg).toHaveClass(new RegExp(`product-icon-${product} product-icon--badge`));
      // The ring is what makes it the badge, and the frameless mark has none.
      await expect(svg.locator('circle[r="10.25"]')).toHaveCount(1);
      await expect(page.locator(`#product-icons-mount k-product-icon[product="${product}"] svg circle[r="10.25"]`)).toHaveCount(0);
    }

    const results = await page.evaluate(async (products) => {
      const mod = await import("../dist/react/ProductIcon.js");
      const inner = (element: { props: { children: unknown } } | null) => {
        if (!element) return null;
        const children = Array.isArray(element.props.children) ? element.props.children : [element.props.children];
        const group = children.find((child: { type?: string } | null) => child && child.type === "g") as { props: { dangerouslySetInnerHTML: { __html: string } } };
        const parsed = document.createElementNS("http://www.w3.org/2000/svg", "g");
        parsed.innerHTML = group.props.dangerouslySetInnerHTML.__html;
        return parsed.innerHTML;
      };
      const probe = (attributes: Record<string, string>) => {
        const element = document.createElement("k-product-icon");
        for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
        document.body.append(element);
        const svg = element.querySelector("svg");
        const state = svg ? { width: svg.getAttribute("width"), inner: svg.querySelector("g")!.innerHTML } : "nothing";
        element.remove();
        return state;
      };
      return {
        badges: products.map((product) => {
          const element = mod.ProductIcon({ product, variant: "badge" });
          const rendered = document.querySelector(`#product-badges-mount k-product-icon[product="${product}"] svg > g`);
          return { product, width: element.props.width, sameMarkup: inner(element) === rendered?.innerHTML, differsFromDefault: inner(element) !== inner(mod.ProductIcon({ product })) };
        }),
        // A product without a badge, or a variant that does not exist, draws nothing rather than another form.
        reactNoBadge: mod.ProductIcon({ product: "veritas", variant: "badge" } as never),
        reactUnknownVariant: mod.ProductIcon({ product: "station", variant: "outline" } as never),
        elementNoBadge: probe({ product: "veritas", variant: "badge" }),
        elementUnknownVariant: probe({ product: "station", variant: "outline" }),
        elementSized: probe({ product: "flow", variant: "badge", size: "48" }).width,
        elementDefault: probe({ product: "flow" }).width,
      };
    }, BADGES);
    expect(results).toEqual({
      badges: BADGES.map((product) => ({ product, width: 32, sameMarkup: true, differsFromDefault: true })),
      reactNoBadge: null,
      reactUnknownVariant: null,
      elementNoBadge: "nothing",
      elementUnknownVariant: "nothing",
      elementSized: "48",
      elementDefault: "24",
    });
    expect(consoleErrors).toEqual([]);
  });
});

async function loadKitPage(page: Page, path: string): Promise<string[]> {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await page.goto(path);
  await expect(page.locator("body")).toBeVisible();
  return consoleErrors;
}
