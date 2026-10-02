import { expect, test, type Page } from "@playwright/test";
import { narrativeScore } from "../../components/experience/narrative-score";
import { activateWithKeyboard, waitForStation } from "./hero-interaction-helpers";
import { clearMonitorTextureSamples, getMonitorTextureSamples, observeMonitorTextures, type MonitorTextureSample } from "./monitor-texture-observer";

test.setTimeout(240_000);
test.use({ video: "off", trace: "off" });

async function assertPaintedOwnership(page: Page, screen: MonitorTextureSample["screen"], successor?: string) {
  await expect.poll(async () => {
    const samples = await getMonitorTextureSamples(page, screen);
    return samples.length >= 2 && (!successor || samples.some((sample) => sample.media === successor));
  }, { timeout: 15_000 }).toBe(true);
  const samples = await getMonitorTextureSamples(page, screen);
  expect(samples.filter((sample) => sample.media === "image" || sample.media === "unknown"), JSON.stringify(samples)).toEqual([]);
  // Entrance blending must use the outgoing painted canvas as its base.
  expect(samples.filter((sample) => sample.blend < 0.999 && sample.base === "image"), JSON.stringify(samples)).toEqual([]);
}

async function seek(page: Page, id: string, progress?: number) {
  const beat = narrativeScore.find((item) => item.id === id)!;
  await page.locator("[data-experience-root]").evaluate((root, target) => {
    root.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress: target, sync: true } }));
  }, progress ?? beat.preview);
}

async function reopen(page: Page, station: string) {
  await page.evaluate((target) => window.dispatchEvent(new CustomEvent("mandegar:interaction-request", {
    detail: { station: target, input: "keyboard" },
  })), station);
  await waitForStation(page, station);
}

test("the rendered game keeps painted ownership through Continue, autoplay and a delayed reopening", async ({ page }) => {
  await observeMonitorTextures(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en?intro=0&phase=experiences", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "game");
  await expect(page.locator("[data-game-canvas]")).toHaveAttribute("data-transition-progress", "1.000");
  await activateWithKeyboard(page, "[data-game-action]");
  await activateWithKeyboard(page, "[data-game-finish]");
  await expect(director).toHaveAttribute("data-lifecycle", "complete");
  await clearMonitorTextureSamples(page);
  await activateWithKeyboard(page, "[data-game-finish]");
  await expect(director).toHaveAttribute("data-active-station", "none");
  await expect(page.locator("[data-game-ambient]")).toHaveAttribute("data-ambient-state", "playing");
  await assertPaintedOwnership(page, "game", "ambient");

  // Routing disables the image cache, exposing the legitimate loading gap
  // between the active station and its first painted interactive canvas.
  await page.route("**/screen-game-3x4.webp", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 180));
    await route.continue();
  });
  await clearMonitorTextureSamples(page);
  await reopen(page, "game");
  await expect(page.locator("[data-game-canvas]")).toHaveAttribute("data-transition-progress", "1.000");
  await assertPaintedOwnership(page, "game", "interactive");
  await clearMonitorTextureSamples(page);
  await activateWithKeyboard(page, "[data-interaction-escape]");
  await expect(director).toHaveAttribute("data-active-station", "none");
  await assertPaintedOwnership(page, "game", "ambient");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("[data-webgl='fallback']")).toBeAttached();
  await expect(page.locator("[data-semantic-fallback]")).toBeVisible();
  await expect(director).toHaveAttribute("data-scroll-locked", "false");
});

test("composer and drawing keep painted surfaces after finishing and use them when reopening", async ({ page }) => {
  await observeMonitorTextures(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/en?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "touch");
  await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-transition-progress", "1.000");
  for (const element of ["space", "story", "people"]) {
    await activateWithKeyboard(page, `[data-touch-element='${element}']`);
  }
  await expect(director).toHaveAttribute("data-lifecycle", "complete");
  await clearMonitorTextureSamples(page);
  await activateWithKeyboard(page, "[data-interaction-escape]");
  await expect(director).toHaveAttribute("data-active-station", "none");
  await assertPaintedOwnership(page, "interactive", "interactive");

  const engagement = narrativeScore.find((beat) => beat.id === "engagement")!;
  await clearMonitorTextureSamples(page);
  await seek(page, "engagement", engagement.start + 0.01);
  await expect.poll(async () => (await getMonitorTextureSamples(page, "interactive")).some((sample) => sample.blend > 0 && sample.blend < 0.9)).toBe(true);
  await seek(page, "engagement");
  await expect(director).toHaveAttribute("data-available-station", "touch");
  await clearMonitorTextureSamples(page);
  await reopen(page, "touch");
  await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-transition-progress", "1.000");
  await expect(page.locator("[data-touch-spatial-controls]")).toHaveAttribute("data-touch-complete", "true");
  await assertPaintedOwnership(page, "interactive", "interactive");
  await activateWithKeyboard(page, "[data-interaction-escape]");
  await expect(director).toHaveAttribute("data-active-station", "none");

  await seek(page, "connection");
  await waitForStation(page, "draw");
  const canvas = page.locator("[data-drawing-canvas]");
  await expect(canvas).toHaveAttribute("data-transition-progress", "1.000");
  await canvas.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");
  await activateWithKeyboard(page, "[data-drawing-spatial-controls] button:nth-of-type(3)");
  await expect(director).toHaveAttribute("data-lifecycle", "complete");
  await clearMonitorTextureSamples(page);
  await activateWithKeyboard(page, "[data-interaction-escape]");
  await expect(director).toHaveAttribute("data-active-station", "none");
  await assertPaintedOwnership(page, "main", "retained");
  await clearMonitorTextureSamples(page);
  await reopen(page, "draw");
  await expect(canvas).toHaveAttribute("data-transition-progress", "1.000");
  await assertPaintedOwnership(page, "main", "interactive");
  await activateWithKeyboard(page, "[data-interaction-escape]");
  await expect(director).toHaveAttribute("data-active-station", "none");
});
