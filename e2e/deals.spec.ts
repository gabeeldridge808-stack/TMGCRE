import { test, expect } from "./fixtures";

const DEAL_NAME = "E2E Test Deal";

test.describe("deal workspace", () => {
  test.beforeEach(async ({ page }) => {
    // Idempotent cleanup, not just teardown: if a prior run died mid-test
    // and left this deal behind, this test must still start from a clean
    // slate rather than colliding with it.
    const res = await page.request.get("/api/deals");
    const deals = await res.json();
    for (const d of deals) {
      if (d.name === DEAL_NAME) await page.request.delete(`/api/deals/${d.id}`);
    }
  });

  test("create, edit, and view a deal's workspace tabs", async ({ page }) => {
    await page.goto("/deals/new");
    await page.fill('input[name="name"]', DEAL_NAME);
    await page.selectOption('select[name="asset_class"]', "office");
    await page.fill('input[name="owner"]', "e2e");
    // Scoped to the form, not a bare `button[type="submit"]` -- the site
    // header's "Log out" button is *also* type="submit" and appears earlier
    // in the DOM, so an unscoped selector silently clicks that one instead
    // (page.click on an ambiguous selector picks the first match rather
    // than erroring -- this is exactly what happened debugging this test).
    await page.locator("form").getByRole("button", { name: "Create deal" }).click();
    await page.waitForURL(/\/deals\/[0-9a-f-]+$/);
    await expect(page.locator("h1")).toHaveText(DEAL_NAME);

    // Checklist seeded for the default (sourcing) stage
    await expect(page.getByText("Sourcing Checklist")).toBeVisible();

    // Edit
    await page.getByRole("link", { name: "Edit" }).click();
    await page.waitForURL(/\/deals\/[0-9a-f-]+\/edit$/);
    await page.fill('input[name="name"]', `${DEAL_NAME} Renamed`);
    await page.locator("form").getByRole("button", { name: "Save changes" }).click();
    await page.waitForURL(/\/deals\/[0-9a-f-]+$/);
    await expect(page.locator("h1")).toHaveText(`${DEAL_NAME} Renamed`);

    // Underwriting tab renders and computes
    await page.getByRole("button", { name: "Underwriting" }).click();
    await expect(page.getByText("Levered IRR", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Levered IRR Sensitivity" })).toBeVisible();

    // Comps tab renders
    await page.getByRole("button", { name: "Comps" }).click();
    await expect(page.getByText("Import Comps from CSV")).toBeVisible();

    // Activity tab shows the creation event
    await page.getByRole("button", { name: "Activity" }).click();
    await expect(page.getByText("created this deal")).toBeVisible();
  });

  test("portfolio search and filters find a known deal", async ({ page }) => {
    await page.request.post("/api/deals", {
      data: { name: DEAL_NAME, asset_class: "office", stage: "sourcing", owner: "e2e" },
    });

    await page.goto("/?q=E2E+Test");
    await expect(page.getByText(DEAL_NAME)).toBeVisible();

    await page.goto("/?asset_class=office");
    await expect(page.getByText(DEAL_NAME)).toBeVisible();

    await page.goto("/?asset_class=multifamily");
    await expect(page.getByText(DEAL_NAME)).not.toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    const res = await page.request.get("/api/deals");
    const deals = await res.json();
    for (const d of deals) {
      if (d.name === DEAL_NAME || d.name === `${DEAL_NAME} Renamed`) {
        await page.request.delete(`/api/deals/${d.id}`);
      }
    }
  });
});
