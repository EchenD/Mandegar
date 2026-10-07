import { expect, test, type Page } from "@playwright/test";
import { narrativeScore } from "../../components/experience/narrative-score";
import { getNarrativeCopyTiming } from "../../components/experience/narrative-copy-timing";
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
  }, { timeout: 15_000 }).toBe(true);
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

async function suspendAndResumeTab(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    window.dispatchEvent(new Event("blur"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  // Let React switch R3F to its suspended frame loop before resuming it.
  await page.waitForTimeout(100);
  await clearMonitorTextureSamples(page);
  await page.evaluate(() => {
    Reflect.deleteProperty(document, "visibilityState");
    Reflect.deleteProperty(document, "hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
  });
}

test("returning backward to Touch restores its buttons and selected chapter until the phase fades out", async ({ page }) => {
  await observeMonitorTextures(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/en?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "touch");
  const touchCanvas = page.locator("[data-composer-canvas]");
  const physicalCanvas = page.locator("[data-experience-canvas='true'] canvas");
  const phase = narrativeScore.find((item) => item.id === "engagement")!;
  const timing = getNarrativeCopyTiming("engagement");
  await expect(touchCanvas).toHaveAttribute("data-transition-progress", "1.000");
  await activateWithKeyboard(page, "[data-installation-button='details']");
  await expect(touchCanvas).toHaveAttribute("data-installation-view", "details");
  await expect(touchCanvas).toHaveAttribute("data-transition-progress", "1.000");

  await seek(page, "engagement", phase.end + 0.008);
  await expect(director).toHaveAttribute("data-active-station", "none");
  await expect(touchCanvas).toHaveCount(0);
  await seek(page, "engagement", timing.enterEnd + 0.012);
  await waitForStation(page, "touch");
  await expect(touchCanvas).toHaveAttribute("data-installation-view", "details");
  await expect(physicalCanvas).toHaveAttribute("data-installation-buttons-opacity", "1.000");
  await activateWithKeyboard(page, "[data-installation-button='parts']");
  await expect(touchCanvas).toHaveAttribute("data-installation-view", "parts");
  await expect(touchCanvas).toHaveAttribute("data-transition-progress", "1.000");

  // Escape within the backward visit stays dismissed until another phase visit.
  await page.keyboard.press("Escape");
  await expect(director).toHaveAttribute("data-active-station", "none");
  await page.waitForTimeout(600);
  await expect(touchCanvas).toHaveCount(0);
  await clearMonitorTextureSamples(page);
  await seek(page, "engagement", phase.start - 0.004);
  await expect(director).toHaveAttribute("data-active-station", "none");
  await assertDefaultMonitor(page, "interactive");
  await expect(physicalCanvas).toHaveAttribute("data-installation-buttons-opacity", "0.000");

  await returnToStationForward(page, "touch");
  await expect(touchCanvas).toHaveAttribute("data-installation-view", "assembled");
  await activateWithKeyboard(page, "[data-installation-button='image']");
  await expect(touchCanvas).toHaveAttribute("data-installation-view", "image");
});

test("all three interactive monitors fade on reverse, replay and keep paint across tab suspension", async ({ page }) => {
  await observeMonitorTextures(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/en?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  const physicalCanvas = page.locator("[data-experience-canvas='true'] canvas");
  const screens = [
    { screen: "interactive", station: "touch", phase: "engagement" },
    { screen: "game", station: "game", phase: "experiences" },
    { screen: "main", station: "draw", phase: "connection" },
  ] as const;

  for (const { screen, station, phase } of screens) {
    await seekStationReview(page, station);
    await waitForStation(page, station);
    const timing = getNarrativeCopyTiming(phase);
    await seek(page, phase, timing.enterEnd + 0.004);
    await expect.poll(async () => (await getMonitorTextureSamples(page, screen)).at(-1)?.activation).toBeGreaterThan(0.99);
    if (screen === "interactive") await expect(physicalCanvas).toHaveAttribute("data-installation-buttons-opacity", "1.000");

    await suspendAndResumeTab(page);
    await expect.poll(async () => (await getMonitorTextureSamples(page, screen)).length).toBeGreaterThan(1);
    const resumed = await getMonitorTextureSamples(page, screen);
    expect(resumed.every((sample) => sample.activation > 0.99 && sample.media !== "neutral"), JSON.stringify(resumed)).toBe(true);
    if (screen === "interactive") await expect(physicalCanvas).toHaveAttribute("data-installation-buttons-opacity", "1.000");

    await clearMonitorTextureSamples(page);
    await seek(page, phase, (timing.enterStart + timing.enterEnd) / 2);
    await expect.poll(async () => {
      const sample = (await getMonitorTextureSamples(page, screen)).at(-1);
      return Boolean(sample && sample.activation > 0.3 && sample.activation < 0.7 && sample.media !== "neutral");
    }).toBe(true);
    if (screen === "interactive") {
      await expect.poll(async () => {
        const opacity = Number(await physicalCanvas.getAttribute("data-installation-buttons-opacity"));
        return opacity > 0.3 && opacity < 0.9;
      }).toBe(true);
    }

    // A large reverse jump must still draw a partially faded painted texture
    // before releasing it and returning to the unpainted monitor.
    await clearMonitorTextureSamples(page);
    await seek(page, phase, timing.enterStart - 0.004);
    await expect.poll(async () => (await getMonitorTextureSamples(page, screen)).some(
      (sample) => sample.activation > 0.02 && sample.activation < 0.48 && sample.media !== "neutral",
    )).toBe(true);
    await assertDefaultMonitor(page, screen);
    const reversed = await getMonitorTextureSamples(page, screen);
    expect(reversed.some((sample) => sample.activation > 0 && sample.media === "neutral"), JSON.stringify(reversed)).toBe(false);
    if (screen === "interactive") await expect(physicalCanvas).toHaveAttribute("data-installation-buttons-opacity", "0.000");

    await returnToStationForward(page, station);
    await expect.poll(async () => (await getMonitorTextureSamples(page, screen)).at(-1)?.activation).toBeGreaterThan(0.99);
    if (screen === "interactive") await expect(physicalCanvas).toHaveAttribute("data-installation-buttons-opacity", "1.000");
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-active-station", "none");
  }
});

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
