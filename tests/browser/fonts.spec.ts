import { expect, test } from "@playwright/test";

/**
 * ui#50: the token entry point declared --k-font-* but never loaded a face, and the only
 * font stylesheet was a remote @import. Consumers locked to `default-src 'self'` rendered
 * fallbacks with no error. These tests measure what that bug was found by measuring.
 */
const FIXTURE = "/tests/browser/fixtures/csp-consumer.html";

const pairs = [
  { name: "display (Fraunces)", sample: "#display", control: "#display-control" },
  { name: "ui (Hanken Grotesk)", sample: "#ui", control: "#ui-control" },
  { name: "mono (IBM Plex Mono)", sample: "#mono", control: "#mono-control" },
];

test("loads brand faces under a same-origin CSP, from the tokens entry point alone", async ({ page }) => {
  const blocked: string[] = [];
  page.on("requestfailed", (request) => blocked.push(request.url()));
  const remote: string[] = [];
  page.on("request", (request) => {
    if (!request.url().startsWith("http://127.0.0.1:")) remote.push(request.url());
  });

  await page.goto(FIXTURE);
  await page.evaluate(() => document.fonts.ready);

  // The headline symptom: zero loaded faces.
  const loaded = await page.evaluate(() =>
    [...document.fonts].filter((face) => face.status === "loaded").map((face) => `${face.family} ${face.weight}`),
  );
  expect(loaded.length).toBeGreaterThan(0);

  for (const family of ["Fraunces", "Hanken Grotesk", "IBM Plex Mono"]) {
    expect(loaded.some((entry) => entry.startsWith(family))).toBe(true);
  }

  expect(remote).toEqual([]);
  expect(blocked).toEqual([]);
});

test("brand families measure differently from a family that cannot resolve", async ({ page }) => {
  await page.goto(FIXTURE);
  await page.evaluate(() => document.fonts.ready);

  for (const { name, sample, control } of pairs) {
    const sampleWidth = (await page.locator(sample).boundingBox())?.width ?? 0;
    const controlWidth = (await page.locator(control).boundingBox())?.width ?? 0;
    expect(sampleWidth, `${name}: sample rendered no width`).toBeGreaterThan(0);
    expect(
      Math.abs(sampleWidth - controlWidth),
      `${name}: measures identical to an unresolvable family, so the brand face did not load`,
    ).toBeGreaterThan(0.5);
  }
});
