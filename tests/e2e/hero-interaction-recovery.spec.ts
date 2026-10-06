import { expect, test, type Page } from "@playwright/test";
import { heroTimeline } from "../../components/experience/hero-timeline-config";
import { driveRaceToCollision, returnToStationForward, seekStationReview, waitForStation } from "./hero-interaction-helpers";

test.setTimeout(180_000);
test.use({ video: "off", trace: "off" });

function observeRaceDeparture(page: Page) {
  return page.locator("[data-experience-root]").evaluate((root: HTMLElement) => new Promise<{
    readingMs: number;
    requests: number;
    resultPainted: boolean;
    controlsCompleted: boolean;
    replayControls: number;
    intermediateFrames: boolean;
    finalFrame: number;
  }>((resolve, reject) => {
    const started = performance.now();
    let resultAt: number | null = null;
    let advanceAt: number | null = null;
    let requests = 0;
    let resultPainted = false;
    let controlsCompleted = false;
    let replayControls = -1;
    let intermediateFrames = false;
    const finish = () => { requests += 1; };
    root.addEventListener("mandegar:finish-phase", finish);
    root.dataset.resultObserverReady = "true";
    const tick = () => {
      const now = performance.now();
      const frame = Number(root.dataset.heroFrame);
      if (root.dataset.interactionResult === "game") {
        const result = root.querySelector<HTMLElement>("p[data-interaction-result='game']");
        if (result && getComputedStyle(result).visibility !== "hidden") {
          resultAt ??= now;
          resultPainted = true;
          controlsCompleted ||= root.querySelector<HTMLElement>("[data-game-spatial-controls]")?.dataset.gameStatus === "complete";
          replayControls = root.querySelectorAll("[data-game-finish], [data-game-replay], [data-interaction-replay]").length;
        }
      }
      if (root.dataset.finishScrolling === "true") advanceAt ??= now;
      intermediateFrames ||= advanceAt !== null && frame > 1535 && frame < 1620;
      if (frame >= 1629.99 && advanceAt !== null && resultAt !== null) {
        root.removeEventListener("mandegar:finish-phase", finish);
        resolve({
          readingMs: advanceAt - resultAt,
          requests,
          resultPainted,
          controlsCompleted,
          replayControls,
          intermediateFrames,
          finalFrame: frame,
        });
      } else if (now - started > 40_000) {
        root.removeEventListener("mandegar:finish-phase", finish);
        reject(new Error("The completed race did not advance through its authored window."));
      } else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
}

test("Escape restores the previous keyboard focus without moving the reading position", async ({ page }) => {
  await page.goto("/en?intro=0&phase=discovery", { waitUntil: "domcontentloaded" });
  const root = page.locator("[data-experience-root]");
  await expect(root).toHaveAttribute("data-story-stage", "discovery", { timeout: 80_000 });
  await page.keyboard.press("Tab");
  const previous = page.getByLabel("Primary navigation").getByRole("link", { name: "Projects", exact: true });
  await previous.focus();
  await seekStationReview(page, "touch");
  const director = await waitForStation(page, "touch");
  await expect(page.locator("[data-interaction-escape]")).toBeFocused();
  const before = await page.evaluate(() => scrollY);
  await page.keyboard.press("Escape");
  await expect(director).toHaveAttribute("data-active-station", "none");
  await expect(previous).toBeFocused();
  expect(Math.abs(await page.evaluate(() => scrollY) - before)).toBeLessThan(2);
});

test("a completed race advances once and a fresh forward race resets while retaining the best score", async ({ page }) => {
  await page.goto("/en?intro=0&phase=experiences", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "game");
  await expect(page.locator("[data-game-canvas]")).toHaveAttribute("data-transition-progress", "1.000");
  const departure = observeRaceDeparture(page);
  await expect(page.locator("[data-experience-root]")).toHaveAttribute("data-result-observer-ready", "true");
  const score = await driveRaceToCollision(page);
  const sample = await departure;
  expect(sample.resultPainted).toBe(true);
  expect(sample.controlsCompleted).toBe(true);
  expect(sample.replayControls).toBe(0);
  expect(sample.readingMs).toBeGreaterThanOrEqual(900);
  expect(sample.requests).toBe(1);
  expect(sample.intermediateFrames).toBe(true);
  expect(sample.finalFrame).toBeCloseTo(1630, 1);
  await expect(director).toHaveAttribute("data-active-station", "none");
  await returnToStationForward(page, "game");
  await expect(page.locator("[data-game-canvas]")).toHaveAttribute("data-transition-progress", "1.000");
  await expect(page.locator("[data-game-spatial-controls]")).toHaveAttribute("data-game-outcome", "none");
  await expect.poll(async () => Number(await page.locator("[data-game-spatial-controls]").getAttribute("data-game-best"))).toBeGreaterThanOrEqual(score);
  await page.waitForTimeout(1_100);
  await expect(director).toHaveAttribute("data-active-station", "game");
  await expect(director).toHaveAttribute("data-presentation", "active");
  await expect(page.locator("[data-game-spatial-controls]")).toHaveAttribute("data-game-status", "running");
});

test("a mobile race result remains readable before automatically scrolling through its authored window", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await page.goto("/fa?intro=0&phase=experiences", { waitUntil: "domcontentloaded" });
    const director = await waitForStation(page, "game");
    await expect(page.locator("[data-game-canvas]")).toHaveAttribute("data-transition-progress", "1.000");
    const departure = observeRaceDeparture(page);
    await expect(page.locator("[data-experience-root]")).toHaveAttribute("data-result-observer-ready", "true");
    await driveRaceToCollision(page);
    const sample = await departure;
    expect(sample.resultPainted).toBe(true);
    expect(sample.controlsCompleted).toBe(true);
    expect(sample.readingMs).toBeGreaterThanOrEqual(900);
    expect(sample.requests).toBe(1);
    expect(sample.intermediateFrames).toBe(true);
    expect(sample.finalFrame).toBeCloseTo(1630, 1);
    await expect(director).toHaveAttribute("data-active-station", "none");
    await expect(director).toHaveAttribute("data-scroll-locked", "false");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
  } finally {
    await context.close();
  }
});

test("fresh installation visits restore navigation focus after Escape and authored Skip", async ({ page }) => {
  await page.goto("/en?intro=0&phase=discovery", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-experience-root]")).toHaveAttribute("data-story-stage", "discovery", { timeout: 80_000 });
  await page.keyboard.press("Tab");
  const previous = page.getByLabel("Primary navigation").getByRole("link", { name: "Projects", exact: true });
  await previous.focus();
  await seekStationReview(page, "touch");
  const director = await waitForStation(page, "touch");
  for (const [index, exitKey] of ["Escape", "Enter"].entries()) {
    if (index > 0) {
      await previous.focus();
      await returnToStationForward(page, "touch");
    }
    await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-transition-progress", "1.000", { timeout: 20_000 });
    if (index === 0) await expect(page.locator("[data-interaction-escape]")).toBeFocused();
    else await expect(previous).toBeFocused();
    await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-installation-view", "assembled");
    await page.locator("[data-installation-button='details']").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-installation-view", "details");
    if (exitKey === "Enter") await page.locator("[data-interaction-escape]").focus();
    const before = await page.evaluate(() => scrollY);
    await page.keyboard.press(exitKey);
    await expect(director).toHaveAttribute("data-active-station", "none");
    await expect(previous).toBeFocused();
    await expect(page.locator("[data-installation-button], [data-interaction-replay]")).toHaveCount(0);
    if (exitKey === "Escape") expect(Math.abs(await page.evaluate(() => scrollY) - before)).toBeLessThan(2);
    else {
      expect(await page.evaluate(() => scrollY)).toBeGreaterThan(before);
      const phase = heroTimeline.phases.find((item) => item.id === "engagement")!;
      expect(Number(await page.locator("[data-experience-root]").getAttribute("data-hero-frame"))).toBeCloseTo(phase.end * heroTimeline.lastFrame, 1);
    }
  }
});
