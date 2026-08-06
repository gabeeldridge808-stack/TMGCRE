import { test, expect } from "@playwright/test";

test.describe("authentication", () => {
  test("redirects an unauthenticated request to login", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL(/\/login/);
    await expect(page.locator("h1")).toHaveText("Deal Tracker");
  });

  test("rejects an invalid login", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "nobody@example.com");
    await page.fill('input[name="password"]', "wrongpassword123");
    await page.click('button[type="submit"]');
    await expect(page.getByText("Invalid email or password.")).toBeVisible();
  });

  test("unauthenticated API requests get 401, not a silent empty result", async ({ request }) => {
    const res = await request.get("/api/deals");
    expect(res.status()).toBe(401);
  });

  test("logs in and out successfully", async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;
    test.skip(!email || !password, "E2E_TEST_EMAIL/PASSWORD not set");

    await page.goto("/login");
    await page.fill('input[name="email"]', email!);
    await page.fill('input[name="password"]', password!);
    await page.click('button[type="submit"]');
    await page.waitForURL("/");
    await expect(page.locator(".site-header")).toBeVisible();

    await page.click('button:has-text("Log out")');
    await page.waitForURL(/\/login/);
  });
});
