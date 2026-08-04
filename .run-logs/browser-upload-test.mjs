import { chromium } from "playwright";
import path from "node:path";

const BASE = "https://tmgcre.vercel.app";

async function main() {
  const dealRes = await fetch(`${BASE}/api/deals`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Simplified Upload Test",
      asset_class: "multifamily",
      stage: "sourcing",
      owner: "diagnostic",
    }),
  });
  const deal = await dealRes.json();
  if (!dealRes.ok) throw new Error(`Failed to create test deal: ${JSON.stringify(deal)}`);
  console.log("Created test deal:", deal.id);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const pageLogs = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") pageLogs.push(`[error] ${msg.text()}`);
  });
  page.on("pageerror", (err) => pageLogs.push(`[pageerror] ${err}`));

  await page.goto(`${BASE}/deals/${deal.id}`, { waitUntil: "networkidle" });

  const filePath = path.resolve(".run-logs/test-file.txt");
  await page.setInputFiles('input[type="file"]', filePath);

  try {
    await page.waitForFunction(
      () => (document.body.textContent || "").includes("chunk(s) indexed"),
      { timeout: 45000 }
    );
    console.log("SUCCESS — chunk(s) indexed text appeared");
  } catch (e) {
    console.log("TIMED OUT WAITING, current body:");
    console.log(await page.textContent("body"));
  }

  await page.screenshot({ path: ".run-logs/final-result.png", fullPage: true });
  console.log("PAGE ERRORS:", JSON.stringify(pageLogs));
  console.log("DEAL_ID_FOR_CLEANUP:", deal.id);

  await browser.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
