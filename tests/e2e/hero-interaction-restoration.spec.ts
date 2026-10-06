import { expect, test, type Page } from "@playwright/test";
import { heroTimeline } from "../../components/experience/hero-timeline-config";
import { waitForStation } from "./hero-interaction-helpers";

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

test("mobile arrival waits for the finger to lift and scrolling to settle", async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await open(page, "fa");
    const director = page.locator("[data-interaction-director]");
    const client = await context.newCDPSession(page);
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 20, y: 500 }] });
    await seek(page, 825);
    await expect(director).toHaveAttribute("data-available-station", "touch");
    await page.waitForTimeout(350);
    await expect(director).toHaveAttribute("data-active-station", "none");
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(director).toHaveAttribute("data-active-station", "touch");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(director).toHaveAttribute("data-scroll-locked", "false");
    await page.screenshot({ path: testInfo.outputPath("mobile-settled-arrival.png") });
  } finally { await context.close(); }
});

test("a large wheel arrival cannot open controls during the same wheel gesture", async ({ page }) => {
  await open(page);
  const elapsed = await page.locator("[data-experience-root]").evaluate((root, progress) => new Promise<number>((resolve, reject) => {
    const started = performance.now();
    window.dispatchEvent(new WheelEvent("wheel", { deltaY: innerHeight * 2, bubbles: true }));
    root.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress, sync: true } }));
    const check = () => {
      if (root.getAttribute("data-interaction-active") === "touch") resolve(performance.now() - started);
      else if (performance.now() - started > 10_000) reject(new Error("Settled wheel arrival did not activate."));
      else requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  }), 825 / heroTimeline.lastFrame);
  expect(elapsed).toBeGreaterThanOrEqual(250);
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
  await page.clock.install();
  await open(page);
  await seek(page, 825);
  const director = await waitForStation(page, "touch");
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.locator("[data-interaction-finish]").click();
  await page.clock.runFor(1_050);
  const root = page.locator("[data-experience-root]");
  await expect(root).toHaveAttribute("data-finish-scrolling", "true");
  // The timer starts Finish; a subsequent GSAP tick moves the native page.
  for (let count = 0; count < 5 && Number(await root.getAttribute("data-hero-frame")) <= 825; count += 1) {
    await page.clock.runFor(100);
  }
  const frame = Number(await root.getAttribute("data-hero-frame"));
  expect(frame).toBeGreaterThan(825);
  expect(frame).toBeLessThan(950);
  await page.keyboard.press("Escape");
  await page.clock.runFor(1_200);
  await expect(director).toHaveAttribute("data-active-station", "none");
  await expect(root).not.toHaveAttribute("data-finish-scrolling");
  expect(Number(await root.getAttribute("data-hero-frame"))).toBeCloseTo(frame, 1);
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
