import { defineConfig, devices } from "@playwright/test";
const channel = process.env.BROWSER_CHANNEL;
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    channel,
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1440, height: 1100 },
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command:
        "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173 --strictPort",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "node scripts/serve-dist.mjs",
      url: "http://127.0.0.1:4174/photo-date-stamper/",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
