import { expect, test } from "@playwright/test";
import { enterStationWithKeyboard, getSceneScreenPoint } from "./hero-interaction-helpers";

test("touch composer supports presets, drag, reset and completion", async ({ page }) => {
  await page.goto("/en?intro=0&phase=engagement", { waitUntil: "networkidle" });
  const screenPoint = await getSceneScreenPoint(page);
  await enterStationWithKeyboard(page, "touch");
  const canvas = page.locator("[data-composer-canvas]");
  await expect(canvas).toBeAttached();
  await expect(page.getByRole("button", { name: "Finish" })).toBeDisabled();
  await page.mouse.move(screenPoint.x - 35, screenPoint.y - 12);
  await page.mouse.down();
  await page.mouse.move(screenPoint.x + 35, screenPoint.y + 12, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole("button", { name: "Finish" })).toBeEnabled();
  await page.getByRole("button", { name: "Magenta field" }).click();
  await expect(page.getByRole("button", { name: "Magenta field" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Finish" }).click();
  await expect(page.locator("[data-interaction-panel='touch']")).toHaveAttribute("data-lifecycle", "complete");
});
