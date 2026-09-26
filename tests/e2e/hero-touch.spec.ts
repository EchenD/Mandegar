import { expect, test, type Locator } from "@playwright/test";
import { enterStationWithKeyboard } from "./hero-interaction-helpers";

async function activateWithKeyboard(button: Locator) {
  await button.focus();
  await button.press("Enter");
}

test("touch composer lives on the 3D screen and completes a three-part composition", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/en?intro=0&phase=engagement", { waitUntil: "networkidle" });
  await enterStationWithKeyboard(page, "touch");

  const director = page.locator("[data-interaction-director]");
  const controls = page.locator("[data-touch-spatial-controls]");
  const canvas = page.locator("[data-composer-canvas]");
  await expect(controls).toBeAttached();
  await expect(canvas).toBeAttached();
  await expect(page.locator("[data-interaction-panel='touch']")).toHaveCount(0);

  const viewport = page.viewportSize();
  if (!viewport) throw new Error("A fixed viewport is required for the 3D touch test");
  await page.mouse.click(viewport.width * 0.445, viewport.height * 0.35);
  await expect(controls).toHaveAttribute("data-touch-selected-count", "1");
  await activateWithKeyboard(controls.getByRole("button", { name: "Story" }));
  await expect(controls).toHaveAttribute("data-touch-selected-count", "2");
  await activateWithKeyboard(controls.getByRole("button", { name: "Reset" }));
  await expect(controls).toHaveAttribute("data-touch-selected-count", "0");

  await activateWithKeyboard(controls.getByRole("button", { name: "Space" }));
  await activateWithKeyboard(controls.getByRole("button", { name: "Story" }));
  await activateWithKeyboard(controls.getByRole("button", { name: "People" }));
  await expect(controls).toHaveAttribute("data-touch-complete", "true");
  await expect(director).toHaveAttribute("data-lifecycle", "complete");
  await expect(controls.getByRole("button", { name: "Continue journey" })).toBeEnabled();
  await activateWithKeyboard(controls.getByRole("button", { name: "Continue journey" }));
  await expect(director).toHaveAttribute("data-active-station", "none");
});
