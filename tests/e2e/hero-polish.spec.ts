import { expect, test, type Page } from "@playwright/test";
import { narrativeScore, type ScenePhaseId } from "../../components/experience/narrative-score";
import { activateWithKeyboard, returnToStationForward, seekStationReview, waitForStation } from "./hero-interaction-helpers";

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

test("continuous scrolling shows the booth capture and its result before moving to the installation", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en?intro=0&phase=discovery", { waitUntil: "domcontentloaded" });
  const root = page.locator("[data-experience-root]");
  const director = page.locator("[data-interaction-director]");
  await expect(root).toHaveAttribute("data-story-stage", "discovery", { timeout: 80_000 });
  await expect(director).toHaveAttribute("data-runtime", /^(full|adaptive)$/, { timeout: 80_000 });
  const capture = root.evaluate((element: HTMLElement, arrival) => new Promise<{
    heldProgress: number;
    heldScroll: number;
    earlyDeparture: boolean;
    earlyPuzzle: boolean;
    resultMs: number;
    captured: boolean;
    cameraAdvance: number;
    earlyChapter: boolean;
  }>((resolve, reject) => {
    const started = performance.now();
    let enteredAt: number | null = null;
    let resultAt: number | null = null;
    let heldProgress = 0;
    let heldScroll = 0;
    let earlyDeparture = false;
    let earlyPuzzle = false;
    let earlyChapter = false;
    let cameraAdvance = 0;
    let lastWheel = 0;
    const tick = (now: number) => {
      if (now - (enteredAt ?? started) > (enteredAt === null ? 80_000 : 15_000)) { reject(new Error("The booth did not present a protected capture result.")); return; }
      if (element.dataset.interactionActive === "photo" && enteredAt === null) {
        enteredAt = now;
        heldProgress = Number(element.dataset.nativeProgress);
        heldScroll = scrollY;
      }
      if (enteredAt !== null) {
        earlyPuzzle ||= element.dataset.storyStage === "activation" && document.querySelector("[data-composer-canvas]") !== null;
        earlyDeparture ||= resultAt === null && Math.abs(scrollY - heldScroll) > 2;
        earlyChapter ||= resultAt === null && element.dataset.storyStage !== "activation";
        cameraAdvance = Math.max(cameraAdvance, Number(element.dataset.nativeProgress) - heldProgress);
        const photo = document.querySelector<HTMLElement>("[data-photo-scroll]");
        const result = document.querySelector<HTMLElement>("p[data-interaction-result]");
        const captured = photo?.dataset.photoState === "captured";
        if (captured && result && getComputedStyle(result).visibility !== "hidden" && result.getBoundingClientRect().height > 0) {
          resultAt ??= now;
          if (now - resultAt >= 600) {
            resolve({ heldProgress, heldScroll, earlyDeparture, earlyPuzzle, resultMs: now - resultAt, captured, cameraAdvance, earlyChapter });
            return;
          }
        }
        // A sustained trackpad-like stream should not immediately erase the
        // outcome. Stop when the readable result appears; the next deliberate
        // visitor wheel below then continues the journey.
        if (resultAt === null && now - enteredAt >= 180 && now - lastWheel >= 80) {
          window.dispatchEvent(new WheelEvent("wheel", { deltaY: 120, bubbles: true, cancelable: true }));
          lastWheel = now;
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress: arrival, sync: true } }));
  }), narrativeScore.find((beat) => beat.id === "activation")!.preview);
  const sample = await capture;
  expect(sample.captured).toBe(true);
  expect(sample.earlyPuzzle).toBe(false);
  expect(sample.earlyDeparture).toBe(false);
  expect(sample.earlyChapter).toBe(false);
  expect(sample.cameraAdvance).toBeGreaterThan(0.002);
  expect(sample.cameraAdvance).toBeLessThanOrEqual(0.013);
  expect(sample.resultMs).toBeGreaterThanOrEqual(600);
  await expect(page.locator("[data-composer-canvas]")).toHaveCount(0);
  await expect(page.locator("p[data-interaction-result]")).toBeVisible();
  await expect(page.locator("[data-interaction-escape]")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("booth-readable-result.png") });
  await page.mouse.wheel(0, 120);
  await expect.poll(async () => Number(await root.getAttribute("data-native-progress"))).toBeGreaterThan(sample.heldProgress);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(sample.heldScroll);
  await seek(page, "engagement", 0.020);
  await waitForStation(page, "touch");
  await expect(root).toHaveAttribute("data-story-stage", "engagement");
});

test("the installation explains Mandegar's parts and starts fresh on forward return", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1680, height: 900 });
  await page.goto("/en?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  await seekStationReview(page, "touch");
  const director = await waitForStation(page, "touch");
  await activateWithKeyboard(page, "[data-installation-button='details']");
  await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-installation-view", "details");
  await page.screenshot({ path: testInfo.outputPath("installation-parts.png") });
  await activateWithKeyboard(page, "[data-interaction-escape]");
  await expect(director).toHaveAttribute("data-active-station", "none");
  await returnToStationForward(page, "touch");
  await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-installation-view", "assembled");
});

for (const station of ["photo", "stage"] as const) {
  test(`${station} keeps the progress rail clear through active, held result, unlocked result and departure`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/en?intro=0&phase=discovery", { waitUntil: "domcontentloaded" });
    const root = page.locator("[data-experience-root]");
    const director = page.locator("[data-interaction-director]");
    await expect(director).toHaveAttribute("data-runtime", /^(full|adaptive)$/, { timeout: 80_000 });
    const rail = page.locator("[data-phase-rail]");
    const cue = page.locator("[data-scroll-cue]");
    const capture = root.evaluate((element, { expected, arrival }) => new Promise<{ active: boolean; heldResult: boolean; protectedMs: number }>((resolve, reject) => {
      let active = false;
      let heldResult = false;
      let resultAt: number | null = null;
      let enteredAt: number | null = null;
      let lampsAdvanced = false;
      const started = performance.now();
      const tick = () => {
        const rail = element.querySelector<HTMLElement>("[data-phase-rail]")!;
        const cue = element.querySelector<HTMLElement>("[data-scroll-cue]")!;
        const clear = getComputedStyle(rail).visibility === "hidden" && getComputedStyle(cue).visibility === "visible";
        const held = element.getAttribute("data-interaction-active") === expected;
        if (held) enteredAt ??= performance.now();
        if (held && expected === "stage" && !lampsAdvanced && performance.now() - enteredAt! > 180) {
          lampsAdvanced = true;
          for (let index = 0; index < 5; index += 1) window.dispatchEvent(new WheelEvent("wheel", { deltaY: 120, bubbles: true, cancelable: true }));
        }
        const result = element.querySelector<HTMLElement>(`p[data-interaction-result='${expected}']`);
        if (held && !result) active ||= clear;
        if (held && result) { heldResult ||= clear; resultAt ??= performance.now(); }
        if (!held && result && resultAt !== null) {
          resolve({ active, heldResult, protectedMs: performance.now() - resultAt });
          return;
        }
        if (performance.now() - (enteredAt ?? started) > (enteredAt === null ? 80_000 : 15_000)) { reject(new Error("The automatic result did not release its hold.")); return; }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress: arrival, sync: true } }));
    }), { expected: station, arrival: narrativeScore.find((beat) => beat.id === (station === "photo" ? "activation" : "reveal"))!.preview });
    const sample = await capture;
    expect(sample.active).toBe(true);
    expect(sample.heldResult).toBe(true);
    expect(sample.protectedMs).toBeGreaterThanOrEqual(800);
    await expect(page.locator(`p[data-interaction-result='${station}']`)).toBeVisible();
    await expect(page.locator("[data-interaction-escape], [data-interaction-replay]")).toHaveCount(0);
    await expect(root).toHaveAttribute("data-interaction-result", station);
    await expect(rail).toBeHidden();
    await expect(cue).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`${station}-unlocked-result.png`) });

    // Record the short fade without timing a Playwright roundtrip into it.
    const departure = root.evaluate((element) => new Promise<{ hidden: boolean; resultVisible: boolean }>((resolve) => {
      const observer = new MutationObserver(() => {
        if (!element.hasAttribute("data-interaction-departing")) return;
        const rail = element.querySelector<HTMLElement>("[data-phase-rail]")!;
        const result = element.querySelector<HTMLElement>("p[data-interaction-result]")!;
        resolve({ hidden: getComputedStyle(rail).visibility === "hidden", resultVisible: result.getBoundingClientRect().height > 0 });
        observer.disconnect();
      });
      observer.observe(element, { attributes: true });
      element.setAttribute("data-departure-observer-ready", "true");
    }));
    await expect(root).toHaveAttribute("data-departure-observer-ready", "true", { timeout: 15_000 });
    await page.mouse.wheel(0, 120);
    expect(await departure).toEqual({ hidden: true, resultVisible: true });
    await expect(director).toHaveAttribute("data-active-station", "none");
    await expect(rail).toBeVisible();
    await expect(root).not.toHaveAttribute("data-interaction-result");
    await expect(root).not.toHaveAttribute("data-interaction-departing");
  });
}

test("small RTL screens keep the installation and shared control separate", async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 600 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto("/fa?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  await seekStationReview(page, "touch");
  const director = await waitForStation(page, "touch");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-transition-progress", "1.000");
  const slots = await page.locator("[data-installation-button]").evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }));
  const dock = await page.locator("[data-journey-control]").boundingBox();
  expect(dock).not.toBeNull();
  for (const slot of slots) {
    expect(intersects(slot, dock!)).toBe(false);
    expect(slot.width).toBeGreaterThanOrEqual(44);
    expect(slot.height).toBeGreaterThanOrEqual(44);
    expect(slot.x).toBeGreaterThanOrEqual(0);
    expect(slot.x + slot.width).toBeLessThanOrEqual(390);
    expect(slot.y + slot.height).toBeLessThanOrEqual(600);
  }
  expect(dock!.y + dock!.height).toBeLessThanOrEqual(600);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(slots).toHaveLength(4);
  await page.locator("[data-installation-button='parts']").tap();
  await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-installation-view", "parts");
  await page.screenshot({ path: testInfo.outputPath("installation-rtl-small.png") });
  await page.locator("[data-interaction-escape]").focus();
  await page.keyboard.press("Enter");
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
