import { expect, test } from "@playwright/test";
import { enterStationWithKeyboard, getSceneScreenPoint } from "./hero-interaction-helpers";

test("game uses the same action for keyboard and pointer and cleans up", async ({ page }) => {
  await page.goto("/en?intro=0&phase=experiences", { waitUntil: "networkidle" });
  const screenPoint = await getSceneScreenPoint(page, 0.46);
  await enterStationWithKeyboard(page, "game");
  await page.mouse.click(screenPoint.x, screenPoint.y);
  await expect(page.locator("[data-game-status]")).toHaveAttribute("data-game-status", "playing");
  const action = page.getByRole("button", { name: "Hit target" });
  await action.focus();
  await page.keyboard.press("Space");
  await expect(page.locator("[data-interaction-panel='game']")).toHaveAttribute("data-lifecycle", "complete", { timeout: 10_000 });
  await page.getByRole("button", { name: "Replay" }).click();
  await expect(page.locator("[data-game-status]")).toHaveAttribute("data-game-status", "playing");
  await page.getByRole("button", { name: "Continue journey" }).click();
  await expect(page.locator("[data-interaction-panel]")).toHaveCount(0);
});
