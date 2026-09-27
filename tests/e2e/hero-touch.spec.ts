import { expect, test } from "@playwright/test";
import { activateWithKeyboard, waitForStation } from "./hero-interaction-helpers";

test.setTimeout(180_000);

test("touch composer resets and completes its three-part composition", async ({ page }) => {
  await page.goto("/en?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "touch");
  const controls = page.locator("[data-touch-spatial-controls]");
  const canvas = page.locator("[data-composer-canvas]");
  await expect(canvas).toHaveAttribute("data-transition-progress", "1.000");

  await activateWithKeyboard(page, "[data-touch-element='space']");
  await activateWithKeyboard(page, "[data-touch-element='story']");
  await expect(controls).toHaveAttribute("data-touch-selected-count", "2");
  await page.evaluate(() => {
    window.dispatchEvent(new Event("blur"));
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
  });
  await expect(controls).toHaveAttribute("data-touch-selected-count", "2");
  await activateWithKeyboard(page, "[data-touch-spatial-controls] button:nth-last-of-type(3)");
  await expect(controls).toHaveAttribute("data-touch-selected-count", "0");

  for (const element of ["space", "story", "people"]) {
    await activateWithKeyboard(page, `[data-touch-element='${element}']`);
  }
  await expect(controls).toHaveAttribute("data-touch-complete", "true");
  await expect(director).toHaveAttribute("data-lifecycle", "complete");
  await activateWithKeyboard(page, "[data-touch-spatial-controls] button:nth-last-of-type(2)");
  await expect(director).toHaveAttribute("data-active-station", "none", { timeout: 3_000 });
});
