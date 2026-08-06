import { defineConfig, devices } from "@playwright/test";

// Runs against a deployed URL, not a local dev server — local DATABASE_URL
// is a redacted placeholder in this environment (see README), so there is
// no working local backend to point a dev server at. Set E2E_BASE_URL to
// point at a preview deployment instead of production if you have one.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // tests share one portfolio; parallel runs would race on shared deal names
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "https://tmgcre.vercel.app",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
