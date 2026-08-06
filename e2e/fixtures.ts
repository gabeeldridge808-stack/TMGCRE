// Extends Playwright's test with a `page` that's already logged in.
// Requires E2E_TEST_EMAIL / E2E_TEST_PASSWORD for an existing account
// (create one via the app's /admin/users page, or the one-time
// /api/setup/create-admin bootstrap route if no account exists yet) —
// tests that need admin-only actions (deleting a deal) additionally
// require that account to have the admin role.
import { test as base, expect } from "@playwright/test";

export const test = base.extend({
  page: async ({ page }, use) => {
    const email = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;
    if (!email || !password) {
      throw new Error("E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set to run authenticated E2E tests.");
    }

    await page.goto("/login");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL("/");

    await use(page);
  },
});

export { expect };
