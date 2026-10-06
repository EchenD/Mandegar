import { expect, test, type Page } from "@playwright/test";
import { narrativeScore } from "../../components/experience/narrative-score";
import { activateWithKeyboard, continueFromResult, driveRaceToCollision, returnToStationForward, seekStationReview, waitForStation } from "./hero-interaction-helpers";
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
  // Interactive entrance uses the outgoing painted canvas. Authored idle
  // materials remain underneath; replacement posters are never sampled.
  expect(samples.filter((sample) => sample.media === "interactive" && sample.blend < 0.999 && sample.base === "image"), JSON.stringify(samples)).toEqual([]);
}

async function seek(page: Page, id: string, progress?: number) {
  const beat = narrativeScore.find((item) => item.id === id)!;
  await page.locator("[data-experience-root]").evaluate((root, target) => {
    root.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress: target, sync: true } }));
  }, progress ?? beat.preview);
}

test("the rendered game keeps painted ownership through a collision, autoplay and a fresh forward return", async ({ page }) => {
  await observeMonitorTextures(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en?intro=0&phase=experiences", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "game");
  await expect(page.locator("[data-game-canvas]")).toHaveAttribute("data-transition-progress", "1.000");
  await driveRaceToCollision(page);
  await clearMonitorTextureSamples(page);
  await continueFromResult(page, "game");
  await expect(page.locator("[data-game-ambient]")).toHaveAttribute("data-ambient-state", "playing");
  await assertPaintedOwnership(page, "game", "ambient");

  // Routing disables the image cache, exposing the legitimate loading gap
  // between the active station and its first painted interactive canvas.
  await page.route("**/race-idle.webp", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 180));
    await route.continue();
  });
  await clearMonitorTextureSamples(page);
  await returnToStationForward(page, "game");
  await expect(page.locator("[data-game-canvas]")).toHaveAttribute("data-transition-progress", "1.000");
  await expect(page.locator("[data-game-spatial-controls]")).toHaveAttribute("data-game-outcome", "none");
  await expect(page.locator("[data-interaction-replay]")).toHaveCount(0);
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

test("installation retains its monitor on exit and drawing keeps a painted forward handoff", async ({ page }) => {
  await observeMonitorTextures(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/en?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "touch");
  await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-transition-progress", "1.000");
  await activateWithKeyboard(page, "[data-installation-button='details']");
  await clearMonitorTextureSamples(page);
  await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-installation-view", "details");
  await assertPaintedOwnership(page, "interactive", "interactive");
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-composer-canvas]")).toHaveCount(0);
  await seek(page, "activation");
  await expect(director).toHaveAttribute("data-active-station", "none");
  await expect(page.locator("[data-composer-canvas]")).toHaveCount(0);
  await returnToStationForward(page, "touch");
  await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-transition-progress", "1.000");
  await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-installation-view", "assembled");
  await clearMonitorTextureSamples(page);
  await assertPaintedOwnership(page, "interactive", "interactive");
  await page.keyboard.press("Escape");
  await expect(director).toHaveAttribute("data-active-station", "none");

  await seekStationReview(page, "draw");
  await waitForStation(page, "draw");
  const canvas = page.locator("[data-drawing-canvas]");
  await expect(canvas).toHaveAttribute("data-transition-progress", "1.000");
  await canvas.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");
  await activateWithKeyboard(page, "[data-drawing-finish]");
  await clearMonitorTextureSamples(page);
  await continueFromResult(page, "draw");
  await assertPaintedOwnership(page, "main", "retained");
  await clearMonitorTextureSamples(page);
  await returnToStationForward(page, "draw");
  await expect(canvas).toHaveAttribute("data-transition-progress", "1.000");
  await expect(page.locator("[data-drawing-spatial-controls]")).toHaveAttribute("data-stroke-count", "0");
  await expect(page.locator("[data-drawing-spatial-controls]")).toHaveAttribute("data-drawing-finished", "false");
  await assertPaintedOwnership(page, "main", "interactive");
  await activateWithKeyboard(page, "[data-interaction-escape]");
  await expect(director).toHaveAttribute("data-active-station", "none");
});
