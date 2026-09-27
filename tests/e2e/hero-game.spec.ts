import { expect, test, type Page } from "@playwright/test";
import { activateWithKeyboard, waitForStation } from "./hero-interaction-helpers";

test.setTimeout(180_000);

async function finishSignalRun(page: Page) {
  const controls = page.locator("[data-game-spatial-controls]");
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await expect(controls).toHaveAttribute("data-game-status", /ready|complete/);
    if (await controls.getAttribute("data-game-status") === "complete") break;
    if (attempt === 0) {
      await activateWithKeyboard(page, "[data-game-spatial-controls] button:nth-of-type(1)");
    } else {
      await controls.locator("button:nth-of-type(1)").evaluate((button: HTMLButtonElement) => button.click());
    }
    await expect(controls).toHaveAttribute("data-game-attempts", String(attempt + 1), { timeout: 30_000 });
    await expect(controls).toHaveAttribute("data-game-status", /ready|complete/, { timeout: 10_000 });
  }
  await expect(controls).toHaveAttribute("data-game-status", "complete");
}

test("signal game completes and exits with keyboard controls", async ({ page }) => {
  await page.goto("/en?intro=0&phase=experiences", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "game");
  const controls = page.locator("[data-game-spatial-controls]");
  await finishSignalRun(page);
  await expect(director).toHaveAttribute("data-lifecycle", "complete");
  await expect(controls.locator("button:nth-of-type(3)")).toBeEnabled();

  await activateWithKeyboard(page, "[data-game-spatial-controls] button:nth-of-type(3)");
  await expect(director).toHaveAttribute("data-active-station", "none", { timeout: 3_000 });
});

test("signal game resets after a launch", async ({ page }) => {
  await page.goto("/en?intro=0&phase=experiences", { waitUntil: "domcontentloaded" });
  await waitForStation(page, "game");
  const controls = page.locator("[data-game-spatial-controls]");
  await activateWithKeyboard(page, "[data-game-spatial-controls] button:nth-of-type(1)");
  await expect(controls).toHaveAttribute("data-game-attempts", "1", { timeout: 30_000 });
  await expect(controls).toHaveAttribute("data-game-status", "ready");
  await activateWithKeyboard(page, "[data-game-spatial-controls] button:nth-of-type(2)");
  await expect(controls).toHaveAttribute("data-game-attempts", "0");
  await expect(controls).toHaveAttribute("data-game-status", "ready");
});
