import { expect, test, type Page } from "@playwright/test";
import { narrativeScore, type ScenePhaseId } from "../../components/experience/narrative-score";
import { heroTimeline } from "../../components/experience/hero-timeline-config";
import { activateWithKeyboard, returnToStationForward, seekStationReview, waitForStation } from "./hero-interaction-helpers";
import { clearMonitorTextureSamples, getMonitorTextureSamples, observeMonitorTextures } from "./monitor-texture-observer";

test.setTimeout(240_000);
test.use({ video: "off", trace: "off" });

type Rect = { x: number; y: number; width: number; height: number };

async function seek(page: Page, phase: ScenePhaseId, offset = 0) {
  const progress = narrativeScore.find((beat) => beat.id === phase)!.preview + offset;
  await page.locator("[data-experience-root]").evaluate((root, value) => {
    root.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress: value, sync: true } }));
  }, progress);
}

function intersects(first: Rect, second: Rect) {
  return first.x < second.x + second.width && first.x + first.width > second.x
    && first.y < second.y + second.height && first.y + first.height > second.y;
}

test("the Touch story plays and replays a chapter and starts fresh on forward return", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1680, height: 900 });
  await page.goto("/en?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  await seekStationReview(page, "touch");
  const director = await waitForStation(page, "touch");
  const canvas = page.locator("[data-composer-canvas]");
  await activateWithKeyboard(page, "[data-installation-button='details']");
  await expect(canvas).toHaveAttribute("data-installation-view", "details");
  await expect(canvas).toHaveAttribute("data-story-chapter", "3");
  await expect(canvas).toHaveAttribute("data-view-transition-progress", "1.000");
  const revision = Number(await canvas.getAttribute("data-story-revision"));
  await activateWithKeyboard(page, "[data-installation-button='details']");
  await expect(canvas).toHaveAttribute("data-story-revision", String(revision + 1));
  await expect(canvas).toHaveAttribute("data-story-chapter", "3");
  await expect(canvas).toHaveAttribute("data-view-transition-progress", "1.000");
  await page.screenshot({ path: testInfo.outputPath("participation-chapter.png") });
  await expect(page.locator("[data-journey-control], [data-interaction-escape]")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(director).toHaveAttribute("data-active-station", "none");
  await returnToStationForward(page, "touch");
  await expect(canvas).toHaveAttribute("data-installation-view", "assembled");
  await expect(canvas).toHaveAttribute("data-story-chapter", "1");
});

test("the center stage and chapter progress remain visible through forward and reverse native lighting", async ({ page }, testInfo) => {
  await observeMonitorTextures(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en?intro=0&phase=discovery", { waitUntil: "domcontentloaded" });
  const root = page.locator("[data-experience-root]");
  const director = page.locator("[data-interaction-director]");
  await expect(director).toHaveAttribute("data-runtime", /^(full|adaptive)$/, { timeout: 80_000 });
  await expect(root).toHaveAttribute("data-story-stage", "discovery", { timeout: 80_000 });
  const rail = page.locator("[data-phase-rail]");
  const phase = heroTimeline.phases.find((beat) => beat.id === "reveal")!;
  const stage = page.locator("[data-stage-scroll]");
  for (const [progress, lamps] of [[phase.start + 0.004, "0"], [phase.end - 0.004, "5"], [phase.start + 0.004, "0"]] as const) {
    await clearMonitorTextureSamples(page);
    await root.evaluate((element, value) => {
      element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress: value, sync: true } }));
    }, progress);
    await expect(root).toHaveAttribute("data-story-stage", "reveal");
    await expect(stage).toHaveAttribute("data-lit-lamps", lamps);
    await expect(rail).toBeVisible();
    await expect(rail).toHaveAttribute("aria-hidden", "false");
    await expect(page.locator("[data-scroll-cue]")).toBeVisible();
    await expect(director).toHaveAttribute("data-active-station", "none");
    await expect(director).toHaveAttribute("data-scroll-locked", "false");
    await expect(root).not.toHaveAttribute("data-interaction-active");
    await expect(root).not.toHaveAttribute("data-interaction-result");
    await expect(root).not.toHaveAttribute("data-interaction-departing");
    await expect.poll(async () => (await getMonitorTextureSamples(page, "videoWall"))
      .some((sample) => sample.media === "stage" && sample.base === "image" && sample.activation > 0.99)).toBe(true);
  }
  await expect(root).toHaveAttribute("data-scroll-direction", "backward");
  await page.screenshot({ path: testInfo.outputPath("stage-visible-progress.png") });
});

test("small RTL screens keep the chapter buttons, caption and progress separate", async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 600 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto("/fa?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  await seekStationReview(page, "touch");
  const director = await waitForStation(page, "touch");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-transition-progress", "1.000");
  await seek(page, "engagement", 0.02);
  const slots = await page.locator("[data-installation-button]").evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
      projectedX: Number((element as HTMLElement).dataset.projectedX), projectedY: Number((element as HTMLElement).dataset.projectedY) };
  }));
  const caption = page.locator("[data-scene-copy='engagement'] p");
  const rail = page.locator("[data-phase-rail]");
  await expect(caption).toBeVisible();
  await expect(rail).toBeVisible();
  const captionBounds = await caption.boundingBox();
  const railBounds = await rail.boundingBox();
  expect(captionBounds).not.toBeNull();
  expect(railBounds).not.toBeNull();
  for (const slot of slots) {
    expect(intersects(slot, captionBounds!)).toBe(false);
    expect(intersects(slot, railBounds!)).toBe(false);
    // Horizontal targets follow the authored circles and remain separate;
    // extra vertical room supplies the larger touch area on narrow screens.
    expect(slot.width).toBeGreaterThan(0);
    expect(slot.height).toBeGreaterThanOrEqual(44);
    expect(Math.abs(slot.x + slot.width / 2 - slot.projectedX)).toBeLessThan(2);
    expect(Math.abs(slot.y + slot.height / 2 - slot.projectedY)).toBeLessThan(2);
    expect(slot.x).toBeGreaterThanOrEqual(0);
    expect(slot.x + slot.width).toBeLessThanOrEqual(390);
    expect(slot.y + slot.height).toBeLessThanOrEqual(600);
  }
  for (let index = 1; index < slots.length; index += 1) {
    expect(slots[index].x).toBeGreaterThan(slots[index - 1].x + slots[index - 1].width);
  }
  expect(captionBounds!.y + captionBounds!.height).toBeLessThanOrEqual(600);
  expect(railBounds!.y + railBounds!.height).toBeLessThanOrEqual(600);
  expect(intersects(captionBounds!, railBounds!)).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(slots).toHaveLength(4);
  await page.locator("[data-installation-button='parts']").tap();
  await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-installation-view", "parts");
  await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-story-chapter", "2");
  await page.screenshot({ path: testInfo.outputPath("installation-rtl-small.png") });
  await page.keyboard.press("Escape");
  await expect(director).toHaveAttribute("data-scroll-locked", "false");
  await context.close();
});

test("reduced motion preserves a readable RTL journey with no interaction lock or overflow", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 600 }, reducedMotion: "reduce", hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto("/fa?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  const director = page.locator("[data-interaction-director]");
  await expect(director).toHaveAttribute("data-runtime", "fallback", { timeout: 80_000 });
  await expect(director).toHaveAttribute("data-active-station", "none");
  await expect(director).toHaveAttribute("data-scroll-locked", "false");
  await expect(page.locator("[data-interaction-escape], [data-interaction-replay]")).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  const fallback = page.locator("[data-semantic-fallback]");
  await expect(fallback).toBeVisible();
  await expect(fallback.getByRole("heading").nth(3)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await context.close();
});

test("a press during the race entrance keeps steering outside the monitor and releases cleanly", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.clock.install();
  await page.goto("/en?intro=0&phase=discovery", { waitUntil: "domcontentloaded" });
  const root = page.locator("[data-experience-root]");
  await expect(root).toHaveAttribute("data-story-stage", "discovery", { timeout: 80_000 });
  await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-runtime", /^(full|adaptive)$/, { timeout: 80_000 });
  // Frame the destination before crossing its automatic entry point, allowing
  // an actual native mouse press to arrive while the artwork is still fading.
  await seek(page, "experiences", -0.012);
  await expect(root).toHaveAttribute("data-story-stage", "experiences");
  // Freeze simulation time before entry so runner/GPU latency cannot consume
  // the 500 ms entrance or cause a traffic collision during pointer assertions.
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  const center = { x: 720, y: 360 };
  await page.mouse.move(center.x, center.y);
  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("[data-experience-canvas='true']")!;
    canvas.addEventListener("pointerdown", () => {
      const game = document.querySelector<HTMLCanvasElement>("[data-game-canvas]");
      if (game) game.dataset.firstPressTransition = game.dataset.transitionProgress ?? "missing";
    }, { once: true, capture: true });
  });
  await seek(page, "experiences");
  await page.clock.runFor(64);
  const canvas = page.locator("[data-game-canvas]");
  await expect(canvas).toBeAttached();
  await page.clock.runFor(64);
  await expect(canvas).toHaveAttribute("data-transition-progress", /^0\./);
  await page.mouse.down();
  await expect(canvas).toHaveAttribute("data-dragging", "true");
  expect(Number(await canvas.getAttribute("data-first-press-transition"))).toBeLessThan(1);
  await page.clock.runFor(600);
  await expect(canvas).toHaveAttribute("data-transition-progress", "1.000");
  await expect(canvas).toHaveAttribute("data-dragging", "true");
  const firstX = Number(await canvas.getAttribute("data-car-x"));
  await page.mouse.move(1360, center.y, { steps: 4 });
  await expect.poll(async () => Number(await canvas.getAttribute("data-car-x"))).toBeGreaterThan(firstX);
  await page.mouse.move(80, center.y + 80, { steps: 4 });
  await expect.poll(async () => Number(await canvas.getAttribute("data-car-x"))).toBeLessThan(firstX);
  await page.mouse.up();
  await expect(canvas).toHaveAttribute("data-dragging", "false");
  const released = await canvas.getAttribute("data-car-x");
  await page.mouse.move(1260, 750, { steps: 3 });
  await expect(canvas).toHaveAttribute("data-car-x", released!);
  await expect(page.locator("[data-game-replay], [data-mobile-game-reset], [data-interaction-dismiss]")).toHaveCount(0);
  await expect(page.locator("[data-interaction-escape]")).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath("race-polished-controls.png") });
});
