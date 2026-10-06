import { expect, test, type Page } from "@playwright/test";
import { narrativeScore } from "../../components/experience/narrative-score";
import { warpNarrativeProgress } from "../../components/experience/narrative-progress-curve";
import { createRaceGame, getAutonomousTarget, raceBoard, stepRace, type RaceGame } from "../../components/experience/interactions/race-game";
import { getScrollScenes } from "../../components/experience/interactions/scroll-scenes";
import { getIntelligencePersonProfile } from "../../components/experience/intelligence-person-profile";
import { activateWithKeyboard, driveRaceToCollision, returnToStationForward, waitForStation } from "./hero-interaction-helpers";

test.setTimeout(120_000);
test.use({ video: "off", trace: "off" });
async function seek(page: Page, progress: number) {
  await page.locator("[data-experience-root]").evaluate((root, value) => {
    root.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress: value, sync: true } }));
  }, progress);
}

test("race collisions end a run, steering respects the road and autonomous driving has no time limit", () => {
  const initial = { ...createRaceGame(), status: "running" as const };
  const crash = stepRace({ ...initial, traffic: [{ id: 0, x: initial.x, y: raceBoard.playerY - 65, color: "#fff" }] }, 0.25);
  expect(crash.status).toBe("complete");
  expect(crash.outcome).toBe("crashed");
  const left = stepRace(initial, 0.25, -1);
  expect(left.x).toBeLessThan(initial.x);
  let game: RaceGame = initial;
  for (let index = 0; index < 120 * 120; index += 1) {
    game = stepRace(game, 1 / 120, 0, getAutonomousTarget(game));
    if (game.status === "complete") throw new Error(`Autonomous driver crashed at ${game.elapsed}`);
  }
  expect(game.elapsed).toBeGreaterThan(119);
  expect(game.score).toBeGreaterThan(4_000);
  expect(game.status).toBe("running");
  expect(game.x).toBeGreaterThanOrEqual(raceBoard.left + 25);
  expect(game.x).toBeLessThanOrEqual(raceBoard.right - 25);
});

test("scroll scenes are reversible samples and person insights stay localized and stable", () => {
  const photo = narrativeScore.find((beat) => beat.id === "activation")!;
  const stage = narrativeScore.find((beat) => beat.id === "reveal")!;
  const earlierProgress = stage.start + (stage.end - stage.start) * 0.65;
  const earlier = getScrollScenes(earlierProgress);
  const building = getScrollScenes(stage.start + (stage.end - stage.start) * 0.85);
  const complete = getScrollScenes(stage.start + (stage.end - stage.start) * 0.88);
  expect(earlier.beams[0]).toBeGreaterThan(0);
  expect(earlier.beams[4]).toBe(0);
  expect(building.beams[4]).toBeGreaterThan(earlier.beams[4]);
  expect(building.beams[4]).toBeLessThan(1);
  expect(complete.beams).toEqual([1, 1, 1, 1, 1]);
  expect(complete.stageVisibility).toBe(1);
  // Pure sampling retraces the build when the story moves backward.
  expect(getScrollScenes(earlierProgress)).toEqual(earlier);
  // The countdown is already visible at the camera midpoint and capture
  // still belongs later in the authored booth beat.
  expect(getScrollScenes(photo.preview).photoStep).toBe("countdown");
  expect(getScrollScenes(photo.start + (photo.end - photo.start) * 0.55).photoStep).toBe("countdown");
  expect(getScrollScenes(photo.start + (photo.end - photo.start) * 0.65).photoStep).toBe("captured");
  expect(getScrollScenes(photo.start + (photo.end - photo.start) * 0.85).photoStep).toBe("idle");
  for (const locale of ["en", "fa", "ar"] as const) {
    const profile = getIntelligencePersonProfile("Human_5", locale);
    expect(profile.lines).toHaveLength(3);
    expect(profile.interest).toBeTruthy();
    expect(profile.expression).toBeTruthy();
    expect(profile).toEqual(getIntelligencePersonProfile("Human_5", locale));
    expect(profile.lines.join(" ")).not.toMatch(/demo|test|simulated/i);
  }
});

test("photo and beams follow reversible scroll samples", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/en?intro=0&phase=activation", { waitUntil: "domcontentloaded" });
  const root = page.locator("[data-experience-root]");
  const director = page.locator("[data-interaction-director]");
  await expect(root).toHaveAttribute("data-story-stage", "activation", { timeout: 80_000 });
  await expect(director).toHaveAttribute("data-active-station", "none");
  const photoCanvas = page.locator("[data-photo-scroll]");
  const photoBeat = narrativeScore.find((beat) => beat.id === "activation")!;
  await expect(photoCanvas).toHaveAttribute("data-photo-state", "countdown");
  await seek(page, photoBeat.start + (photoBeat.end - photoBeat.start) * 0.65);
  await expect(photoCanvas).toHaveAttribute("data-photo-state", "captured");
  await expect(page.locator("[data-photo-capture], [data-stage-beam]")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("photo-scroll.png") });
  await seek(page, photoBeat.start + (photoBeat.end - photoBeat.start) * 0.55);
  await expect(photoCanvas).toHaveAttribute("data-photo-state", "countdown");
  await expect(director).toHaveAttribute("data-active-station", "none");
  const stage = narrativeScore.find((beat) => beat.id === "reveal")!;
  await seek(page, stage.preview + 0.022);
  await waitForStation(page, "stage");
  await page.keyboard.press("Escape");
  await expect(director).toHaveAttribute("data-active-station", "none");
  await seek(page, stage.start + (stage.end - stage.start) * 0.88);
  const stageCanvas = page.locator("[data-stage-scroll]");
  await expect(root).toHaveAttribute("data-story-stage", "reveal");
  await expect(stageCanvas).toHaveAttribute("data-beam-intensities", "[1,1,1,1,1]");
  const before = await stageCanvas.getAttribute("data-beam-intensities");
  await seek(page, stage.start + (stage.end - stage.start) * 0.65);
  await expect.poll(() => stageCanvas.getAttribute("data-beam-intensities")).not.toBe(before);
  const earlierProgress = stage.start + (stage.end - stage.start) * 0.55;
  await seek(page, earlierProgress);
  const expectedBeams = getScrollScenes(warpNarrativeProgress(earlierProgress)).beams;
  await expect.poll(async () => {
    const beams = JSON.parse(await stageCanvas.getAttribute("data-beam-intensities") ?? "[]") as number[];
    return Math.max(...expectedBeams.map((expected, index) => Math.abs(expected - beams[index])));
  }).toBeLessThan(0.005);
  await expect(director).toHaveAttribute("data-scroll-locked", "false");
  await page.screenshot({ path: testInfo.outputPath("beams-scroll.png") });
  expect(errors).toEqual([]);
});

test("small scrolls fill Skip and automatic forward returns start a fresh installation", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/en?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "touch");
  await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-transition-progress", "1.000", { timeout: 20_000 });
  await activateWithKeyboard(page, "[data-installation-button='parts']");
  const before = await page.evaluate(() => window.scrollY);
  const skip = page.locator("[data-interaction-escape]");
  await page.evaluate(() => {
    for (let index = 0; index < 12; index += 1) {
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: 30, bubbles: true, cancelable: true }));
    }
  });
  await expect(director).toHaveAttribute("data-active-station", "touch");
  await expect.poll(async () => Number(await skip.getAttribute("data-scroll-skip-progress"))).toBeCloseTo(1 / 3, 2);
  for (let index = 0; index < 3; index += 1) await page.mouse.wheel(0, 120);
  await expect(director).toHaveAttribute("data-active-station", "touch");
  await expect.poll(async () => Number(await skip.getAttribute("data-scroll-skip-progress"))).toBeCloseTo(2 / 3, 2);
  expect(await page.evaluate(() => scrollY)).toBeCloseTo(before, 0);
  for (let index = 0; index < 3; index += 1) await page.mouse.wheel(0, 120);
  await expect(director).toHaveAttribute("data-active-station", "none");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 50);
  await seek(page, narrativeScore.find((beat) => beat.id === "engagement")!.preview);
  await expect(director).toHaveAttribute("data-active-station", "none");
  await expect(page.locator("[data-interaction-replay]")).toHaveCount(0);
  await returnToStationForward(page, "touch");
  await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-installation-view", "assembled");
});

test("fast passing a station never pulls the camera back or locks scrolling", async ({ page }) => {
  await page.goto("/en?intro=0&phase=discovery", { waitUntil: "domcontentloaded" });
  const root = page.locator("[data-experience-root]");
  await expect(root).toHaveAttribute("data-story-stage", "discovery", { timeout: 80_000 });
  const beat = narrativeScore.find((item) => item.id === "engagement")!;
  const progress = beat.end - 0.007;
  await seek(page, progress);
  await expect(root).toHaveAttribute("data-story-stage", "engagement");
  await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-active-station", "none");
  await page.waitForTimeout(700);
  expect(Number(await root.getAttribute("data-native-progress"))).toBeCloseTo(progress, 4);
});

test("ordinary forward wheel arrivals start each activity with one Skip and no Replay", async ({ page }) => {
  await page.goto("/en?intro=0&phase=discovery", { waitUntil: "domcontentloaded" });
  const root = page.locator("[data-experience-root]");
  const director = page.locator("[data-interaction-director]");
  await expect(root).toHaveAttribute("data-story-stage", "discovery", { timeout: 80_000 });
  for (const [phase, station] of [["engagement", "touch"], ["experiences", "game"], ["connection", "draw"]] as const) {
    const beat = narrativeScore.find((item) => item.id === phase)!;
    const arrival = beat.start + (beat.end - beat.start) * (station === "touch" ? 0.7 : 0.5);
    await seek(page, arrival - 0.004);
    await expect(director).toHaveAttribute("data-available-station", station);
    await expect(page.locator("[data-interaction-replay]")).toHaveCount(0);
    const distance = await root.evaluate((element: HTMLElement) => element.offsetHeight - innerHeight);
    await page.mouse.wheel(0, distance * 0.008);
    await expect(director).toHaveAttribute("data-active-station", station, { timeout: 20_000 });
    await expect(page.locator("[data-interaction-replay]")).toHaveCount(0);
    await page.locator("[data-interaction-escape]").click();
    await expect(director).toHaveAttribute("data-active-station", "none");
    await expect(page.locator("[data-interaction-replay]")).toHaveCount(0);
  }
});

test("the normal Persian introduction enters the installation, holds arrival motion and fills Skip across nine scrolls", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/fa", { waitUntil: "domcontentloaded" });
  const root = page.locator("[data-experience-root]");
  const director = page.locator("[data-interaction-director]");
  await expect(root).not.toHaveAttribute("data-intro-active", "true", { timeout: 80_000 });
  await expect(director).toHaveAttribute("data-runtime", /^(full|adaptive)$/, { timeout: 80_000 });
  await expect(page.locator("[data-interaction-replay]")).toHaveCount(0);
  let entered = false;
  for (let index = 0; index < 120; index += 1) {
    await page.mouse.wheel(0, 330);
    await page.waitForTimeout(80);
    if (await root.getAttribute("data-interaction-active") === "touch") {
      entered = true;
      break;
    }
    if (await root.getAttribute("data-story-stage") === "reveal") break;
  }
  expect(entered).toBe(true);
  // The final arrival wheel can still have Lenis movement pending when entered.
  await expect(director).toHaveAttribute("data-active-station", "touch");
  await expect(director).toHaveAttribute("data-scroll-locked", "true");
  await expect(page.locator("[data-interaction-replay]")).toHaveCount(0);
  const skip = page.locator("[data-interaction-escape]");
  await expect(skip.locator("[data-scroll-skip-fill]")).toBeAttached();
  // Slow browser automation may deliver one more deliberate wheel before it
  // observes entry. That increment counts after the short arrival grace.
  const arrivalProgress = Number(await skip.getAttribute("data-scroll-skip-progress"));
  expect(arrivalProgress).toBeLessThanOrEqual(1 / 3);
  let filled = Math.round(arrivalProgress * 9);
  await page.waitForTimeout(180);
  const before = await page.evaluate(() => scrollY);
  while (filled < 6) {
    const next = Math.min(6, filled + 3);
    for (let index = filled; index < next; index += 1) await page.mouse.wheel(0, 120);
    await expect(director).toHaveAttribute("data-active-station", "touch");
    await expect.poll(async () => Number(await skip.getAttribute("data-scroll-skip-progress"))).toBeCloseTo(next / 9, 2);
    await expect(skip.locator("[data-scroll-skip-fill]")).toBeVisible();
    expect(await page.evaluate(() => scrollY)).toBeCloseTo(before, 0);
    await expect(page.locator("[data-interaction-replay]")).toHaveCount(0);
    filled = next;
  }
  for (let index = filled; index < 9; index += 1) await page.mouse.wheel(0, 120);
  await expect(director).toHaveAttribute("data-active-station", "none");
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before + 50);
  await expect(page.locator("[data-interaction-replay]")).toHaveCount(0);
});

test("the slow scroll tail keeps fractional scene movement between native pixel steps", async ({ page }) => {
  await page.goto("/en?intro=0&phase=discovery", { waitUntil: "domcontentloaded" });
  const root = page.locator("[data-experience-root]");
  await expect(root).toHaveAttribute("data-story-stage", "discovery", { timeout: 80_000 });
  await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-runtime", /^(full|adaptive)$/, { timeout: 80_000 });
  const sample = root.evaluate((element: HTMLElement) => new Promise<Array<{ sceneY: number; nativeY: number }>>((resolve, reject) => {
    const records: Array<{ sceneY: number; nativeY: number }> = [];
    const record = () => ({ sceneY: Number(element.dataset.nativeProgress) * (element.offsetHeight - innerHeight) + element.offsetTop, nativeY: scrollY });
    const timer = window.setTimeout(() => {
      window.removeEventListener("wheel", begin, true);
      reject(new Error("The scroll-tail sampler did not receive its forward wheel."));
    }, 10_000);
    const begin = (event: WheelEvent) => {
      if (event.deltaY <= 0) return;
      window.removeEventListener("wheel", begin, true);
      clearTimeout(timer);
      const start = performance.now();
      records.push(record());
      const sampleFrame = () => {
        records.push(record());
        if (performance.now() - start < 2200) requestAnimationFrame(sampleFrame);
        else resolve(records);
      };
      requestAnimationFrame(sampleFrame);
    };
    window.addEventListener("wheel", begin, { capture: true, passive: true });
    element.dataset.scrollTailObserverReady = "true";
  }));
  await expect(root).toHaveAttribute("data-scroll-tail-observer-ready", "true");
  await page.mouse.wheel(0, 80);
  const records = await sample;
  expect(records.some((record) => Math.abs(record.sceneY - record.nativeY) > 0.05)).toBe(true);
  expect(records.at(-1)!.sceneY).toBeGreaterThan(records[0].sceneY);
});

test("three longer mobile swipes fill Skip and the final swipe continues after leaving an untouched installation", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto("/fa?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "touch");
  const before = await page.evaluate(() => scrollY);
  const skip = page.locator("[data-interaction-escape]");
  await expect(skip.locator("[data-scroll-skip-fill]")).toBeAttached();
  const session = await context.newCDPSession(page);
  for (const progress of [1 / 3, 2 / 3]) {
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 375, y: 800 }] });
    for (const y of [740, 680, 620]) {
      await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 375, y }] });
      await page.waitForTimeout(40);
    }
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(director).toHaveAttribute("data-active-station", "touch");
    await expect.poll(async () => Number(await skip.getAttribute("data-scroll-skip-progress"))).toBeCloseTo(progress, 2);
    await expect(skip.locator("[data-scroll-skip-fill]")).toBeVisible();
    expect(await page.evaluate(() => scrollY)).toBeCloseTo(before, 0);
  }
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 375, y: 800 }] });
  for (const y of [740, 680, 620, 560, 500]) {
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 375, y }] });
    await page.waitForTimeout(40);
  }
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(director).toHaveAttribute("data-active-station", "none");
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(before + 100);
  await expect(page.locator("[data-interaction-replay]")).toHaveCount(0);
  await context.close();
});

test("race starts automatically, keyboard steers, a crash shows a result and the next visit keeps the best", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en?intro=0&phase=experiences", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "game");
  const canvas = page.locator("[data-game-canvas]");
  const controls = page.locator("[data-game-spatial-controls]");
  await expect(controls).toHaveAttribute("data-game-type", "race");
  await expect(controls).toHaveAttribute("data-game-status", "running");
  await canvas.focus();
  const x = Number(await canvas.getAttribute("data-car-x"));
  await page.keyboard.down("ArrowRight");
  await expect.poll(async () => Number(await canvas.getAttribute("data-car-x"))).toBeGreaterThan(x + 30);
  await page.keyboard.up("ArrowRight");
  await page.keyboard.press("Space");
  await expect(controls).toHaveAttribute("data-game-status", "paused");
  await page.screenshot({ path: testInfo.outputPath("race-desktop.png") });
  await page.keyboard.press("Space");
  const finalScore = await driveRaceToCollision(page);
  await expect(director).toHaveAttribute("data-presentation", "result");
  await expect(page.locator("[data-experience-root]")).not.toHaveAttribute("data-interaction-active", "game");
  await expect(page.locator("[data-interaction-replay], [data-interaction-escape]")).toHaveCount(0);
  await page.mouse.wheel(0, 120);
  await expect(director).toHaveAttribute("data-active-station", "none");
  await expect(page.locator("[data-game-ambient]")).toHaveAttribute("data-ambient-state", "playing");
  const score = Number(await page.locator("[data-game-ambient]").getAttribute("data-ambient-score"));
  await expect.poll(async () => Number(await page.locator("[data-game-ambient]").getAttribute("data-ambient-score"))).toBeGreaterThan(score);
  await returnToStationForward(page, "game");
  await expect(controls).toHaveAttribute("data-game-status", "running");
  expect(Number(await controls.getAttribute("data-game-best"))).toBeGreaterThanOrEqual(finalScore);
});

test("drawing exit starts a blank forward visit and Finish presents its result", async ({ page }) => {
  await page.goto("/en?intro=0&phase=connection", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "draw");
  const canvas = page.locator("[data-drawing-canvas]");
  await expect(canvas).toHaveAttribute("data-transition-progress", "1.000");
  await canvas.focus(); await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight"); await page.keyboard.press("Space");
  await page.locator("[data-interaction-escape]").click();
  await expect(director).toHaveAttribute("data-active-station", "none");
  await returnToStationForward(page, "draw");
  await expect(page.locator("[data-drawing-spatial-controls]")).toHaveAttribute("data-stroke-count", "0");
  await expect(canvas).toHaveAttribute("data-transition-progress", "1.000");
  await canvas.focus(); await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight"); await page.keyboard.press("Space");
  await activateWithKeyboard(page, "[data-drawing-finish]");
  await expect(director).toHaveAttribute("data-presentation", "result");
  await expect(page.locator("[data-experience-root]")).not.toHaveAttribute("data-interaction-active", "draw");
  await expect(page.locator("p[data-interaction-result='draw']")).toBeVisible();
  await expect(page.locator("[data-interaction-replay]")).toHaveCount(0);
});

for (const locale of ["fa", "ar"] as const) {
  test(`mobile ${locale} keeps steering and Skip separate and person insights inside the viewport`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await page.goto(`/${locale}?intro=0&phase=experiences`, { waitUntil: "domcontentloaded" });
    const director = await waitForStation(page, "game");
    const canvas = page.locator("[data-game-canvas]");
    await expect(canvas).toHaveAttribute("data-transition-progress", "1.000");
    const before = Number(await canvas.getAttribute("data-car-x"));
    await page.locator("[data-mobile-game-left]").tap();
    await expect.poll(async () => Number(await canvas.getAttribute("data-car-x"))).toBeLessThan(before);
    await expect(director).toHaveAttribute("data-active-station", "game");
    const skip = await page.locator("[data-interaction-escape]").boundingBox();
    const dock = await page.locator("[data-mobile-game-dock]").boundingBox();
    expect(dock!.y + dock!.height).toBeLessThan(skip!.y);
    expect(before).toBeGreaterThan(0);
    await page.screenshot({ path: testInfo.outputPath(`race-${locale}-mobile.png`) });
    await page.locator("[data-interaction-escape]").tap();
    await expect(director).toHaveAttribute("data-active-station", "none");
    await seek(page, narrativeScore.find((beat) => beat.id === "intelligence")!.preview);
    const inspector = page.locator("[data-intelligence-inspector]");
    await expect(inspector).toHaveAttribute("data-available", "true");
    await page.locator("[data-intelligence-explore]").tap();
    await expect(inspector).toHaveAttribute("data-world-readout-kind", "person-insight");
    await expect(inspector).toHaveAttribute("data-world-readout-state", "ready");
    await expect(inspector.locator("[data-person-interest]")).not.toBeEmpty();
    const rect = JSON.parse(await inspector.getAttribute("data-world-readout-rect") ?? "{}");
    expect(rect.x).toBeGreaterThanOrEqual(0); expect(rect.x + rect.width).toBeLessThanOrEqual(390);
    await page.screenshot({ path: testInfo.outputPath(`insight-${locale}-mobile.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await context.close();
  });
}

test("reduced motion retains the accessible chapter sequence", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/fa?intro=0", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-semantic-fallback]")).toBeVisible();
  await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-active-station", "none");
});
