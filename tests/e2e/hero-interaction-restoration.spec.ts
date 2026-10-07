import { expect, test, type Page } from "@playwright/test";
import { heroTimeline } from "../../components/experience/hero-timeline-config";
import { waitForStation } from "./hero-interaction-helpers";
import { clearMonitorTextureSamples, getMonitorTextureSamples, observeMonitorTextures, type MonitorTextureSample } from "./monitor-texture-observer";

test.setTimeout(180_000);
test.use({ video: "off", trace: "off" });

async function open(page: Page, locale = "en") {
  await page.goto(`/${locale}?intro=0&phase=discovery`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-loading-progress]")).toHaveAttribute("data-loading-progress", "100", { timeout: 90_000 });
  await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-runtime", /^(full|adaptive)$/);
}

async function seek(page: Page, frame: number) {
  await page.locator("[data-experience-root]").evaluate((root, progress) => {
    root.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress, sync: true } }));
  }, frame / heroTimeline.lastFrame);
}

const phaseArrivalMonitors = [
  { station: "touch", phase: "engagement", screen: "interactive", canvas: "[data-composer-canvas]" },
  { station: "game", phase: "experiences", screen: "game", canvas: "[data-game-canvas]" },
  { station: "draw", phase: "connection", screen: "main", canvas: "[data-drawing-canvas]" },
] as const;

test("all three mobile monitors begin with their captions at phase starts while a finger remains down", async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await observeMonitorTextures(page);
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await open(page, "fa");
    const director = page.locator("[data-interaction-director]");
    const client = await context.newCDPSession(page);
    for (const monitor of phaseArrivalMonitors) {
      const phase = heroTimeline.phases.find((item) => item.id === monitor.phase)!;
      await seek(page, phase.startFrame - 1);
      await expect(director).toHaveAttribute("data-active-station", "none");
      await expect(page.locator(monitor.canvas)).toHaveCount(0);
      await clearMonitorTextureSamples(page);
      await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 20, y: 500 }] });
      await seek(page, phase.startFrame + 2);
      await waitForStation(page, monitor.station);
      await expect.poll(async () => (await getMonitorTextureSamples(page, monitor.screen)).some((sample) => sample.media === "interactive" && sample.activation > 0)).toBe(true);
      await expect(page.locator(`[data-scene-copy='${monitor.phase}']`)).toBeVisible();
      expect(Number(await page.locator("[data-experience-root]").getAttribute("data-native-progress"))).toBeCloseTo((phase.startFrame + 2) / heroTimeline.lastFrame, 4);
      await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await page.keyboard.press("Escape");
      await expect(director).toHaveAttribute("data-active-station", "none");
    }
    expect(requests.filter((url) => /connected-experience|race-idle|screen-(?:main|game|interactive)-/.test(url))).toEqual([]);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(director).toHaveAttribute("data-scroll-locked", "false");
    await page.screenshot({ path: testInfo.outputPath("mobile-phase-start-arrival.png") });
  } finally { await context.close(); }
});

test("all three monitors begin with their captions at phase starts during ongoing wheel input", async ({ page }) => {
  await observeMonitorTextures(page);
  await open(page);
  const root = page.locator("[data-experience-root]");
  const director = page.locator("[data-interaction-director]");
  for (const monitor of phaseArrivalMonitors) {
    const phase = heroTimeline.phases.find((item) => item.id === monitor.phase)!;
    await seek(page, phase.startFrame - 1);
    await expect(director).toHaveAttribute("data-active-station", "none");
    await expect(page.locator(monitor.canvas)).toHaveCount(0);
    await clearMonitorTextureSamples(page);
    const arrival = await root.evaluate((element: HTMLElement, { station, screen, progress }) => new Promise<{ wheels: number; progress: number }>((resolve, reject) => {
      const started = performance.now();
      let wheels = 0;
      const wheel = () => {
        wheels += 1;
        window.dispatchEvent(new WheelEvent("wheel", { deltaY: 0.01, bubbles: true }));
      };
      wheel();
      element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress, sync: true } }));
      const check = () => {
        wheel();
        const samples = (window as unknown as Window & { __monitorTextureSamples: MonitorTextureSample[] }).__monitorTextureSamples;
        if (element.dataset.interactionActive === station && samples.some((sample) => sample.screen === screen && sample.media === "interactive" && sample.activation > 0)) {
          resolve({ wheels, progress: Number(element.dataset.nativeProgress) });
        } else if (performance.now() - started > 10_000) reject(new Error(`${station} waited for ongoing wheel input to end before painting.`));
        else requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    }), { station: monitor.station, screen: monitor.screen, progress: (phase.startFrame + 2) / heroTimeline.lastFrame });
    expect(arrival.wheels).toBeGreaterThan(1);
    expect(arrival.progress).toBeGreaterThanOrEqual(phase.start);
    expect(arrival.progress).toBeLessThan((phase.startFrame + 4) / heroTimeline.lastFrame);
    await expect(page.locator(`[data-scene-copy='${monitor.phase}']`)).toBeVisible();
    await expect(director).toHaveAttribute("data-scroll-locked", "false");
    await page.keyboard.press("Escape");
    await expect(director).toHaveAttribute("data-active-station", "none");
  }
});

test("rapid travel from game to drawing starts the new monitor before the previous departure finishes", async ({ page }) => {
  await page.clock.install();
  await open(page);
  const game = heroTimeline.phases.find((phase) => phase.id === "experiences")!;
  const drawing = heroTimeline.phases.find((phase) => phase.id === "connection")!;
  await seek(page, game.startFrame + 2);
  const director = await waitForStation(page, "game");
  const gameCanvas = page.locator("[data-game-canvas]");
  await expect(gameCanvas).toHaveAttribute("data-transition-progress", /^\d\.\d{3}$/, { timeout: 20_000 });
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.clock.runFor(1_000);
  await expect(gameCanvas).toHaveAttribute("data-transition-progress", "1.000");

  await seek(page, game.endFrame + 1);
  await page.clock.runFor(64);
  await expect(director).toHaveAttribute("data-active-station", "game");
  await expect(director).toHaveAttribute("data-presentation", "departing");

  await seek(page, drawing.startFrame + 2);
  await page.clock.runFor(128);
  await expect(director).toHaveAttribute("data-active-station", "draw");
  await expect(director).toHaveAttribute("data-presentation", "active");
  await expect(page.locator("[data-drawing-canvas]")).toHaveCount(1);
  await page.clock.runFor(500);
  await expect(director).toHaveAttribute("data-active-station", "draw");
  await expect(director).toHaveAttribute("data-presentation", "active");
  await expect(director).toHaveAttribute("data-scroll-locked", "false");
});

test("keyboard entry focuses controls and Escape restores focus from the page body without scrolling", async ({ page }) => {
  await open(page);
  await page.keyboard.press("Tab");
  const previous = page.getByRole("navigation", { name: "Primary navigation" }).locator("a").first();
  await previous.focus();
  await seek(page, 825);
  const director = page.locator("[data-interaction-director]");
  const skip = page.locator("[data-interaction-escape]");
  await expect(skip).toBeFocused();
  const top = await page.evaluate(() => scrollY);
  await skip.evaluate((button: HTMLButtonElement) => button.blur());
  await page.keyboard.press("Escape");
  await expect(director).toHaveAttribute("data-active-station", "none");
  await expect(previous).toBeFocused();
  expect(Math.abs(await page.evaluate(() => scrollY) - top)).toBeLessThan(2);
});

test("completion paints a readable result before one smooth departure, including a double click", async ({ page }) => {
  await open(page);
  await seek(page, 825);
  await waitForStation(page, "touch");
  const sample = await page.locator("[data-interaction-finish]").evaluate((button: HTMLButtonElement) => new Promise<{
    readingMs: number;
    requests: number;
    frames: number[];
  }>((resolve, reject) => {
    const root = button.closest<HTMLElement>("[data-experience-root]")!;
    const started = performance.now();
    let advancingAt: number | null = null;
    let requests = 0;
    const frames: number[] = [];
    const request = () => { requests += 1; };
    root.addEventListener("mandegar:finish-phase", request);
    const record = () => {
      const frame = Number(root.dataset.heroFrame);
      frames.push(frame);
      if (root.dataset.finishScrolling === "true") advancingAt ??= performance.now();
      if (frame >= 949.99 && advancingAt !== null) {
        root.removeEventListener("mandegar:finish-phase", request);
        resolve({ readingMs: advancingAt - started, requests, frames });
      } else if (performance.now() - started > 10_000) {
        root.removeEventListener("mandegar:finish-phase", request);
        reject(new Error("The completed interaction did not continue."));
      } else requestAnimationFrame(record);
    };
    button.click();
    button.click();
    requestAnimationFrame(record);
  }));
  expect(sample.readingMs).toBeGreaterThanOrEqual(900);
  expect(sample.requests).toBe(1);
  expect(sample.frames.some((frame) => frame > 835 && frame < 940)).toBe(true);
  expect(sample.frames.slice(1).every((frame, index) => frame >= sample.frames[index] - 0.1)).toBe(true);
  await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-active-station", "none");
});

test("deliberate scroll cancels the queued result advance and keeps native scrolling available", async ({ page }) => {
  await page.clock.install();
  await open(page);
  await seek(page, 825);
  await waitForStation(page, "touch");
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  const root = page.locator("[data-experience-root]");
  await page.locator("[data-interaction-finish]").click();
  await page.clock.runFor(64);
  await expect(page.locator("p[data-interaction-result='touch']")).toBeVisible();
  const top = await page.evaluate(() => scrollY);
  await page.mouse.move(20, 400);
  await page.mouse.wheel(0, 120);
  await page.clock.runFor(2_000);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(top + 30);
  await expect(root).not.toHaveAttribute("data-finish-scrolling");
  expect(Number(await root.getAttribute("data-hero-frame"))).toBeLessThan(900);
  await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-presentation", "result");
  await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-scroll-locked", "false");
});

test("scrolling already in motion does not cancel a completed result's automatic departure", async ({ page }) => {
  await open(page);
  await seek(page, 825);
  await waitForStation(page, "touch");
  const sample = await page.locator("[data-interaction-finish]").evaluate((button: HTMLButtonElement) => new Promise<{
    requests: number;
    finalFrame: number;
    movedBeforeAdvance: boolean;
  }>((resolve) => {
    const root = button.closest<HTMLElement>("[data-experience-root]")!;
    const started = performance.now();
    let requests = 0;
    let movedBeforeAdvance = false;
    const request = () => { requests += 1; };
    root.addEventListener("mandegar:finish-phase", request);
    const record = () => {
      const frame = Number(root.dataset.heroFrame);
      if (frame > 826 && requests === 0) movedBeforeAdvance = true;
      if (frame >= 949.99 || performance.now() - started > 5_000) {
        root.removeEventListener("mandegar:finish-phase", request);
        resolve({ requests, finalFrame: frame, movedBeforeAdvance });
      } else requestAnimationFrame(record);
    };
    // Begin the wheel gesture before completion. Its remaining Lenis motion
    // is not a new request by the visitor to take over the result advance.
    document.body.dispatchEvent(new WheelEvent("wheel", { deltaY: 120, bubbles: true, cancelable: true }));
    button.click();
    requestAnimationFrame(record);
  }));
  expect(sample.movedBeforeAdvance).toBe(true);
  expect(sample.requests).toBe(1);
  expect(sample.finalFrame).toBeCloseTo(950, 1);
  await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-active-station", "none");
});

test("leaving a completed interaction cancels its advance before a fresh forward attempt", async ({ page }) => {
  await open(page);
  await seek(page, 825);
  const director = await waitForStation(page, "touch");
  await page.locator("[data-installation-button='parts']").evaluate((button: HTMLButtonElement) => button.click());
  await page.locator("[data-interaction-finish]").click();
  await expect(director).toHaveAttribute("data-presentation", "result");
  await page.keyboard.press("Escape");
  await expect(director).toHaveAttribute("data-active-station", "none");
  await seek(page, 790);
  await seek(page, 825);
  await waitForStation(page, "touch");
  await page.waitForTimeout(1_200);
  await expect(director).toHaveAttribute("data-presentation", "active");
  await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-installation-view", "assembled");
  await expect(page.locator("[data-experience-root]")).not.toHaveAttribute("data-finish-scrolling");
  expect(Number(await page.locator("[data-experience-root]").getAttribute("data-hero-frame"))).toBeCloseTo(825, 1);
});

test("Escape cancels an advance already in motion and preserves the current authored frame", async ({ page }) => {
  await open(page);
  await seek(page, 825);
  await waitForStation(page, "touch");
  const sample = await page.locator("[data-interaction-finish]").evaluate((button: HTMLButtonElement) => new Promise<{
    stoppedFrame: number;
    framesAfterEscape: number[];
  }>((resolve, reject) => {
    const root = button.closest<HTMLElement>("[data-experience-root]")!;
    const started = performance.now();
    let stoppedFrame: number | null = null;
    let stoppedAt: number | null = null;
    const framesAfterEscape: number[] = [];
    const record = () => {
      const now = performance.now();
      const frame = Number(root.dataset.heroFrame);
      if (stoppedFrame === null && root.dataset.finishScrolling === "true" && frame > 835 && frame < 940) {
        stoppedFrame = frame;
        stoppedAt = now;
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      }
      if (stoppedFrame !== null) framesAfterEscape.push(frame);
      if (stoppedFrame !== null && stoppedAt !== null && now - stoppedAt >= 1_200) {
        resolve({ stoppedFrame, framesAfterEscape });
      } else if (now - started > 10_000) reject(new Error("No intermediate authored frame was available to cancel."));
      else requestAnimationFrame(record);
    };
    button.click();
    requestAnimationFrame(record);
  }));
  expect(sample.stoppedFrame).toBeGreaterThan(825);
  expect(sample.stoppedFrame).toBeLessThan(950);
  expect(sample.framesAfterEscape.length).toBeGreaterThan(1);
  expect(sample.framesAfterEscape.every((frame) => Math.abs(frame - sample.stoppedFrame) < 0.1)).toBe(true);
  await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-active-station", "none");
  await expect(page.locator("[data-experience-root]")).not.toHaveAttribute("data-finish-scrolling");
});

test("scroll input immediately after completion cancels advancement before the result effect runs", async ({ page }) => {
  await open(page);
  await seek(page, 825);
  await waitForStation(page, "touch");
  const sample = await page.locator("[data-interaction-finish]").evaluate((button: HTMLButtonElement) => new Promise<{
    requests: number;
    finalFrame: number;
  }>((resolve) => {
    const root = button.closest<HTMLElement>("[data-experience-root]")!;
    let requests = 0;
    const finish = () => { requests += 1; };
    root.addEventListener("mandegar:finish-phase", finish);
    button.click();
    document.body.dispatchEvent(new WheelEvent("wheel", { deltaY: 120, bubbles: true, cancelable: true }));
    setTimeout(() => {
      root.removeEventListener("mandegar:finish-phase", finish);
      resolve({ requests, finalFrame: Number(root.dataset.heroFrame) });
    }, 2_500);
  }));
  expect(sample.requests).toBe(0);
  expect(sample.finalFrame).toBeGreaterThan(825);
  expect(sample.finalFrame).toBeLessThan(900);
  await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-presentation", "result");
});

test("playing the game preserves the section's normal vignette and color presentation", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  await seek(page, 1550);
  const director = await waitForStation(page, "game");
  await expect(page.locator("[data-game-spatial-controls]")).toHaveAttribute("data-game-status", "running");
  await page.locator("[data-game-action]").evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.locator("[data-game-spatial-controls]")).toHaveAttribute("data-game-status", "paused");
  const vignette = page.locator("[data-scene-vignette]");
  const activeBackground = await vignette.evaluate((element) => getComputedStyle(element).backgroundImage);
  await page.screenshot({ path: testInfo.outputPath("game-normal-scene-appearance.png") });
  await page.keyboard.press("Escape");
  await expect(director).toHaveAttribute("data-active-station", "none");
  expect(await vignette.evaluate((element) => getComputedStyle(element).backgroundImage)).toBe(activeBackground);
  await expect(page.locator("[data-experience-canvas]")).toHaveAttribute("data-postprocessing", "none");
});
