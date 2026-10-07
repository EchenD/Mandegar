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
  expect(samples.filter((sample) => sample.media === "neutral" && sample.activation > 0), JSON.stringify(samples)).toEqual([]);
  // Interactive entrance uses the outgoing painted canvas and never a poster.
  expect(samples.filter((sample) => sample.media === "interactive" && sample.blend < 0.999 && sample.base === "image"), JSON.stringify(samples)).toEqual([]);
}

async function assertDefaultMonitor(page: Page, screen: MonitorTextureSample["screen"]) {
  await expect.poll(async () => {
    const sample = (await getMonitorTextureSamples(page, screen)).at(-1);
    return sample?.media === "neutral" && sample.activation === 0;
  }).toBe(true);
}

test("the original center artwork loads while all three interactive monitors start without posters", async ({ page }, testInfo) => {
  await observeMonitorTextures(page);
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en?intro=0&phase=activation", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-runtime", /^(full|adaptive)$/, { timeout: 80_000 });
  await expect(page.locator("[data-experience-root]")).toHaveAttribute("data-story-stage", "activation", { timeout: 80_000 });
  await expect.poll(async () => {
    const sample = (await getMonitorTextureSamples(page, "videoWall")).at(-1);
    return sample?.media === "image" && sample.blend === 1
      || sample?.base === "image" && sample.blend === 0;
  }, { timeout: 15_000 }).toBe(true);
  expect(requests.some((url) => url.includes("lighting-screen-v1.webp"))).toBe(true);
  expect(requests.filter((url) => /connected-experience|race-idle|screen-(?:main|game|interactive|center)-/.test(url))).toEqual([]);
  for (const screen of ["interactive", "game", "main"] as const) {
    expect(await getMonitorTextureSamples(page, screen)).toEqual([]);
  }
  await page.screenshot({ path: testInfo.outputPath("original-monitors-before-interaction.png") });
});

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

  await clearMonitorTextureSamples(page);
  await seek(page, "reveal");
  await expect(director).toHaveAttribute("data-active-station", "none");
  await assertDefaultMonitor(page, "game");
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

test("installation and drawing retain their forward paint and reset before their arrival on reverse", async ({ page }) => {
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
  await assertDefaultMonitor(page, "interactive");
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
  const drawingPhase = narrativeScore.find((beat) => beat.id === "connection")!;
  await seek(page, "connection", drawingPhase.start - 0.004);
  await expect(director).toHaveAttribute("data-active-station", "none");
  await assertDefaultMonitor(page, "main");
  await clearMonitorTextureSamples(page);
  await returnToStationForward(page, "draw");
  await expect(canvas).toHaveAttribute("data-transition-progress", "1.000");
  await expect(page.locator("[data-drawing-spatial-controls]")).toHaveAttribute("data-stroke-count", "0");
  await expect(page.locator("[data-drawing-spatial-controls]")).toHaveAttribute("data-drawing-finished", "false");
  await assertPaintedOwnership(page, "main", "interactive");
  await activateWithKeyboard(page, "[data-interaction-escape]");
  await expect(director).toHaveAttribute("data-active-station", "none");
});
