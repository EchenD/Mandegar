import { expect, test } from "@playwright/test";
import { activateWithKeyboard, waitForStation } from "./hero-interaction-helpers";

test.setTimeout(180_000);
test.use({ video: "off", trace: "off" });

for (const station of [
  { name: "game", phase: "experiences", file: "race-idle.webp", canvas: "[data-game-canvas]" },
  { name: "draw", phase: "connection", file: "screen-main-4x3.webp", canvas: "[data-drawing-canvas]" },
  { name: "touch", phase: "engagement", file: "connected-experience.webp", canvas: "[data-composer-canvas]" },
]) {
  test(`${station.name} starts without idle artwork and keeps visitor keyboard input`, async ({ page }) => {
    let requested = false;
    await page.route(`**/${station.file}`, async (route) => {
      requested = true;
      await route.abort();
    });
    await page.goto(`/en?intro=0&phase=${station.phase}`, { waitUntil: "domcontentloaded" });
    const director = await waitForStation(page, station.name);
    const canvas = page.locator(station.canvas);
    await expect(canvas).toHaveAttribute("data-transition-progress", "1.000", { timeout: 10_000 });

    if (station.name === "game") {
      await activateWithKeyboard(page, "[data-game-action]");
      await expect(page.locator("[data-game-spatial-controls]")).toHaveAttribute("data-game-status", "paused");
    } else if (station.name === "touch") {
      await activateWithKeyboard(page, "[data-installation-button='parts']");
      await expect(canvas).toHaveAttribute("data-installation-view", "parts");
      await expect(canvas).toHaveAttribute("data-view-transition-progress", "1.000");
    } else {
      await canvas.focus();
      await page.keyboard.press("Space");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("Space");
      await expect(page.locator("[data-drawing-spatial-controls]")).toHaveAttribute("data-stroke-count", "1");
    }
    expect(requested).toBe(false);
    await expect(canvas).toHaveAttribute("data-transition-progress", "1.000");
    await page.keyboard.press("Escape");
    await expect(director).toHaveAttribute("data-active-station", "none");
    await expect(director).toHaveAttribute("data-scroll-locked", "false");
  });
}

test("the memory chapter plays with no dependency on former static artwork", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.route("**/media/hero/touch/*.webp", (route) => route.abort());
  await page.goto("/en?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  await waitForStation(page, "touch");
  const canvas = page.locator("[data-composer-canvas]");
  await expect(canvas).toHaveAttribute("data-transition-progress", "1.000");
  await activateWithKeyboard(page, "[data-installation-button='image']");
  await expect(canvas).toHaveAttribute("data-artwork-status", "generated");
  await expect(canvas).toHaveAttribute("data-story-chapter", "4");
  await expect(canvas).toHaveAttribute("data-installation-view", "image");
  await expect(canvas).toHaveAttribute("data-view-transition-progress", "1.000", { timeout: 15_000 });
  const picture = await canvas.evaluate((element: HTMLCanvasElement) => {
    const pixels = element.getContext("2d")!.getImageData(0, 0, element.width, element.height).data;
    const colors = new Set<number>();
    for (let index = 0; index < pixels.length; index += 388) colors.add(pixels[index] * 65536 + pixels[index + 1] * 256 + pixels[index + 2]);
    return colors.size;
  });
  expect(picture).toBeGreaterThan(30);
  await activateWithKeyboard(page, "[data-installation-button='parts']");
  await expect(canvas).toHaveAttribute("data-story-chapter", "2");
  await expect(canvas).toHaveAttribute("data-transition-progress", "1.000");
  expect(requests.filter((url) => /media\/hero\/touch\/|connected-experience/.test(url))).toEqual([]);
});
