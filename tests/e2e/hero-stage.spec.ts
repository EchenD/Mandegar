import { expect, test } from "@playwright/test";
import { enterStationWithKeyboard } from "./hero-interaction-helpers";

test("stage controls accumulate five beams into a finale", async ({ page }) => {
  await page.goto("/en?intro=0&phase=reveal", { waitUntil: "networkidle" });
  await enterStationWithKeyboard(page, "stage");
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("A fixed viewport is required for the stage scene test");
  for (let index = 1; index <= 5; index += 1) {
    const beam = page.getByRole("button", { name: `Beam ${index}` });
    await page.mouse.click(
      viewport.width * ((index - 0.5) / 5),
      viewport.height * 0.24,
    );
    await expect(beam).toHaveAttribute("aria-pressed", "true");
  }
  await expect(page.locator("[data-interaction-panel='stage']")).toHaveAttribute("data-lifecycle", "complete");
});
