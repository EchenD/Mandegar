import { expect, test } from "@playwright/test";
import { activateWithKeyboard, returnToStationForward, seekStationReview, waitForStation } from "./hero-interaction-helpers";

test.setTimeout(150_000);
test.use({ video: "off", trace: "off" });

test("each installation view stays selected and a fresh forward visit resets to the assembled scene", async ({ page }) => {
  await page.goto("/en?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  await seekStationReview(page, "touch");
  const director = await waitForStation(page, "touch");
  const canvas = page.locator("[data-composer-canvas]");
  for (const view of ["parts", "details", "image", "assembled"] as const) {
    await activateWithKeyboard(page, `[data-installation-button='${view}']`);
    await expect(canvas).toHaveAttribute("data-installation-view", view);
    await expect(page.locator(`[data-installation-button='${view}']`)).toHaveAttribute("aria-pressed", "true");
    await expect(director).toHaveAttribute("data-active-station", "touch");
  }
  await activateWithKeyboard(page, "[data-installation-button='details']");
  await expect(page.locator("[data-touch-spatial-controls] [role='status']")).toContainText("Content gives the idea a voice.");
  await activateWithKeyboard(page, "[data-installation-button='parts']");
  await expect(canvas).toHaveAttribute("data-explosion-progress", "1.000");
  await page.keyboard.press("Escape");
  await expect(director).toHaveAttribute("data-active-station", "none");
  await expect(canvas).toHaveCount(0);
  await returnToStationForward(page, "touch");
  await expect(canvas).toHaveAttribute("data-installation-view", "assembled");
  await expect(page.locator("[data-installation-button='assembled']")).toHaveAttribute("aria-pressed", "true");
});

test("missing final artwork keeps the installation diagram and controls usable", async ({ page }) => {
  await page.route("**/media/services/events.webp", (route) => route.abort());
  await page.goto("/en?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  await seekStationReview(page, "touch");
  const director = await waitForStation(page, "touch");
  const canvas = page.locator("[data-composer-canvas]");
  await activateWithKeyboard(page, "[data-installation-button='image']");
  await expect(canvas).toHaveAttribute("data-artwork-status", "missing");
  await expect(canvas).toHaveAttribute("data-installation-view", "image");
  const distinctColors = await canvas.evaluate((element: HTMLCanvasElement) => {
    const pixels = element.getContext("2d")!.getImageData(0, 0, element.width, element.height).data;
    const colors = new Set<number>();
    for (let index = 0; index < pixels.length; index += 64) colors.add(pixels[index] * 65536 + pixels[index + 1] * 256 + pixels[index + 2]);
    return colors.size;
  });
  expect(distinctColors).toBeGreaterThan(10);
  await activateWithKeyboard(page, "[data-installation-button='details']");
  await expect(canvas).toHaveAttribute("data-installation-view", "details");
  await activateWithKeyboard(page, "[data-interaction-escape]");
  await expect(director).toHaveAttribute("data-scroll-locked", "false");
});
