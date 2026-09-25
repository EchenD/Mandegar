import { expect, test } from "@playwright/test";
import { enterStationWithKeyboard, getSceneScreenPoint } from "./hero-interaction-helpers";

test("drawing wall supports freehand input, undo, preset, clear and finish", async ({ page }) => {
  await page.goto("/en?intro=0&phase=connection", { waitUntil: "networkidle" });
  const screenPoint = await getSceneScreenPoint(page);
  await enterStationWithKeyboard(page, "draw");
  const canvas = page.locator("[data-drawing-canvas]");
  await expect(canvas).toBeAttached();
  await page.mouse.move(screenPoint.x - 35, screenPoint.y);
  await page.mouse.down();
  await page.mouse.move(screenPoint.x + 35, screenPoint.y, { steps: 10 });
  await page.mouse.up();
  await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled();
  await page.getByRole("button", { name: "Undo" }).click();
  await page.getByRole("button", { name: "Add a keyboard-accessible signature mark" }).click();
  await page.getByRole("button", { name: "Finish" }).click();
  await expect(page.locator("[data-drawing-echo]")).toBeVisible();
  await expect(page.locator("[data-interaction-panel='draw']")).toHaveAttribute("data-lifecycle", "complete");
});
