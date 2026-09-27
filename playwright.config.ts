import { defineConfig, devices } from "@playwright/test";

// Parallel worktrees each need their own server: with reuseExistingServer, a
// server another checkout left on the port would serve that checkout's files.
const port = Number(process.env.KUI_TEST_PORT ?? 4182);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`KUI_TEST_PORT must be a TCP port, got ${process.env.KUI_TEST_PORT}`);

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run build && python3 -m http.server ${port} --bind 127.0.0.1`,
    url: `http://127.0.0.1:${port}/docs/gallery.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "chromium-mobile",
      use: {
        ...devices["Pixel 7"],
      },
    },
  ],
});
