import { expect, test, type Page } from "@playwright/test";

const PRODUCTS = ["station", "surface", "flow", "veritas", "survey", "console", "flow-agents"] as const;

test.describe("product icons", () => {
  test("renders every k-product-icon element as a currentColor svg", async ({ page }) => {
    const consoleErrors = await loadKitPage(page, "/elements/demo.html");

    await expect(page.getByRole("main")).toContainText("Product Marks");

    for (const product of PRODUCTS) {
      const svg = page.locator(`k-product-icon[product="${product}"] svg`);
      await expect(svg).toBeVisible();
      await expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
      await expect(svg).toHaveAttribute("stroke", "currentColor");
      await expect(svg).toHaveClass(new RegExp(`product-icon-${product}`));
    }

    // title => exposed as an image with an accessible label; otherwise hidden.
    const labelled = page.locator('k-product-icon[product="station"] svg');
    await expect(labelled).toHaveAttribute("role", "img");
    await expect(labelled).toHaveAttribute("aria-label", "Station");
    const hidden = page.locator('k-product-icon[product="surface"] svg');
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
