import { expect, test } from "@playwright/test";
import { activateWithKeyboard, waitForStation } from "./hero-interaction-helpers";

test.setTimeout(120_000);

test("stage controls accumulate five beams into a finale", async ({ page }) => {
  await page.goto("/en?intro=0&phase=reveal", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "stage");
  const controls = page.locator("[data-stage-spatial-controls]");
  await expect(controls).toBeAttached();
  for (let index = 1; index <= 5; index += 1) {
    const beam = controls.locator(`[data-stage-beam='${index}']`);
    await activateWithKeyboard(page, `[data-stage-beam='${index}']`);
    await expect(beam).toHaveAttribute("aria-pressed", "true");
  }
  await expect(director).toHaveAttribute("data-lifecycle", "complete");
  await activateWithKeyboard(page, "[data-stage-spatial-controls] button:nth-last-of-type(2)");
  await expect(director).toHaveAttribute("data-active-station", "none", { timeout: 3_000 });
});
