import { expect, test, type Page } from "@playwright/test";
import { narrativeScore } from "../../components/experience/narrative-score";
import { driveRaceToCollision, returnToStationForward, seekStationReview, solvePuzzle, swapPuzzleSlots, waitForStation } from "./hero-interaction-helpers";

test.setTimeout(240_000);
test.use({ video: "off", trace: "off" });

async function seek(page: Page, progress: number) {
  await page.locator("[data-experience-root]").evaluate((root, value) => {
    root.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress: value, sync: true } }));
  }, progress);
}

async function wheelProgress(page: Page, progress: number) {
  const distance = await page.locator("[data-experience-root]").evaluate((root: HTMLElement) => root.offsetHeight - innerHeight);
  await page.mouse.wheel(0, distance * progress);
}

test("Skip returns on forward puzzle visits after retreating within the chapter and leaving the chapter", async ({ page }) => {
  await page.goto("/en?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  await seekStationReview(page, "touch");
  const director = await waitForStation(page, "touch");
  const root = page.locator("[data-experience-root]");
  const skip = page.locator("[data-interaction-escape]");
  const beat = narrativeScore.find((item) => item.id === "engagement")!;
  await skip.click();
  await expect(director).toHaveAttribute("data-active-station", "none");

  // A short retreat inside the same chapter must rearm the next arrival.
  const arrival = beat.start + (beat.end - beat.start) * 0.7;
  await seek(page, arrival - 0.004);
  await expect(root).toHaveAttribute("data-scroll-direction", "backward");
  await expect(director).toHaveAttribute("data-active-station", "none");
  await wheelProgress(page, 0.008);
  await waitForStation(page, "touch");
  await expect(skip).toHaveAttribute("data-scroll-skip-progress", "0.000");
  await expect(page.locator("[data-interaction-replay]")).toHaveCount(0);
  await skip.click();
  await expect(director).toHaveAttribute("data-active-station", "none");

  // A later visit through a different chapter follows the same behavior.
  await seek(page, narrativeScore.find((item) => item.id === "discovery")!.preview);
  await expect(root).toHaveAttribute("data-story-stage", "discovery");
  await seek(page, arrival - 0.004);
  await wheelProgress(page, 0.008);
  await waitForStation(page, "touch");
  await expect(skip).toHaveAttribute("data-scroll-skip-progress", "0.000");
  await expect(page.locator("[data-interaction-replay]")).toHaveCount(0);
});

test("reverse then forward input during the puzzle departure fade starts a fresh attempt", async ({ page }) => {
  await page.goto("/en?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  await seekStationReview(page, "touch");
  const director = await waitForStation(page, "touch");
  await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-transition-progress", "1.000");
  await swapPuzzleSlots(page, 0, 1);
  await expect(page.locator("[data-touch-spatial-controls]")).toHaveAttribute("data-puzzle-moves", "1");
  // Entrance is settled. Send both directions in the browser so runner
  // latency cannot move the forward gesture beyond the 400ms departure.
  const sample = await page.locator("[data-experience-root]").evaluate((root: HTMLElement) => new Promise<{
    forwardDelayMs: number;
    forwardDuringDeparture: boolean;
    releasedBeforeReturn: boolean;
  }>((resolve, reject) => {
    let released = false;
    let forwardDelayMs = Infinity;
    let forwardDuringDeparture = false;
    const timer = window.setTimeout(() => {
      observer.disconnect();
      reject(new Error("The fast reverse/forward gesture did not start a fresh puzzle."));
    }, 10_000);
    const observer = new MutationObserver(() => {
      if (root.dataset.interactionActive !== "touch") released = true;
      else if (released && forwardDelayMs !== Infinity && root.dataset.interactionDeparting !== "touch") {
        clearTimeout(timer);
        observer.disconnect();
        resolve({ forwardDelayMs, forwardDuringDeparture, releasedBeforeReturn: released });
      }
    });
    observer.observe(root, { attributes: true, attributeFilter: ["data-interaction-active", "data-interaction-departing"] });
    window.dispatchEvent(new WheelEvent("wheel", { deltaY: -60, bubbles: true, cancelable: true }));
    const started = performance.now();
    queueMicrotask(() => {
      forwardDelayMs = performance.now() - started;
      forwardDuringDeparture = root.dataset.interactionDeparting === "touch";
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: 120, bubbles: true, cancelable: true }));
    });
  }));
  expect(sample.forwardDelayMs).toBeLessThanOrEqual(100);
  expect(sample.forwardDuringDeparture).toBe(true);
  expect(sample.releasedBeforeReturn).toBe(true);
  await expect(director).toHaveAttribute("data-presentation", "active");
  await expect(page.locator("[data-touch-spatial-controls]")).toHaveAttribute("data-puzzle-moves", "0");
  await expect(page.locator("[data-touch-spatial-controls]")).toHaveAttribute("data-puzzle-solved", "false");
  await expect(page.locator("[data-interaction-escape]")).toHaveAttribute("data-scroll-skip-progress", "0.000");
  await expect(page.locator("[data-interaction-replay]")).toHaveCount(0);
});

for (const [phase, station, animationSelector] of [
  ["activation", "photo", "[data-photo-scroll]"],
  ["reveal", "stage", "[data-stage-scroll]"],
] as const) {
  test(`${station} advances its camera while Skip fills, protects its result and starts fresh on a forward visit`, async ({ page }) => {
    const previousPhase = station === "photo" ? "discovery" : "engagement";
    await page.goto(`/en?intro=0&phase=${previousPhase}`, { waitUntil: "domcontentloaded" });
    const director = page.locator("[data-interaction-director]");
    const root = page.locator("[data-experience-root]");
    const skip = page.locator("[data-interaction-escape]");
    const animation = page.locator(animationSelector);
    await expect(root).toHaveAttribute("data-story-stage", previousPhase, { timeout: 80_000 });
    await expect(director).toHaveAttribute("data-runtime", /^(full|adaptive)$/, { timeout: 80_000 });
    if (station === "stage") {
      await seekStationReview(page, "touch");
      await waitForStation(page, "touch");
      await page.keyboard.press("Escape");
      await expect(director).toHaveAttribute("data-active-station", "none");
    }
    // Observe and deliver the fast input in the browser. Round trips from the
    // test runner can otherwise consume the entire short protection interval.
    const capture = root.evaluate((element: HTMLElement, { expectedStation, targetProgress }) => new Promise<{
      heldProgress: number;
      heldScroll: number;
      filledProgress: number;
      filledStation: string | null;
      filledNativeProgress: number;
      filledScroll: number;
      elapsedMs: number;
      resultMs: number;
    }>((resolve, reject) => {
      let startedAt: number | null = null;
      let heldProgress = 0;
      let heldScroll = 0;
      let resultAt: number | null = null;
      let filled: {
        filledProgress: number;
        filledStation: string | null;
        filledNativeProgress: number;
        filledScroll: number;
      } | null = null;
      const timer = window.setTimeout(() => {
        observer.disconnect();
        reject(new Error("The protected passive presentation did not release."));
      }, 15_000);
      const observer = new MutationObserver(() => {
        if (element.dataset.interactionResult === expectedStation && resultAt === null) resultAt = performance.now();
        if (element.dataset.interactionActive === expectedStation && startedAt === null) {
          startedAt = performance.now();
          requestAnimationFrame(() => window.setTimeout(() => {
            heldProgress = Number(element.dataset.nativeProgress);
            heldScroll = scrollY;
            for (let index = 0; index < 3; index += 1) {
              window.dispatchEvent(new WheelEvent("wheel", { deltaY: 120, bubbles: true, cancelable: true }));
            }
            const captureFilled = () => {
              const progress = Number(document.querySelector<HTMLElement>("[data-interaction-escape]")?.dataset.scrollSkipProgress);
              if (progress !== 1 && element.dataset.interactionActive === expectedStation) {
                requestAnimationFrame(captureFilled);
                return;
              }
              filled = {
                filledProgress: progress,
                filledStation: element.dataset.interactionActive ?? null,
                filledNativeProgress: Number(element.dataset.nativeProgress),
                filledScroll: scrollY,
              };
            };
            requestAnimationFrame(captureFilled);
          }, 180));
        } else if (startedAt !== null && element.dataset.interactionActive !== expectedStation) {
          clearTimeout(timer);
          observer.disconnect();
          if (!filled) { reject(new Error("The passive hold released before its filled state could be observed.")); return; }
          if (resultAt === null) { reject(new Error("The passive presentation released without a readable result.")); return; }
          resolve({ heldProgress, heldScroll, ...filled, elapsedMs: performance.now() - startedAt, resultMs: performance.now() - resultAt });
        }
      });
      observer.observe(element, { attributes: true, attributeFilter: ["data-interaction-active", "data-interaction-result"] });
      element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress: targetProgress, sync: true } }));
    }), { expectedStation: station, targetProgress: narrativeScore.find((item) => item.id === phase)!.preview });
    const sample = await capture;
    expect(sample.filledProgress).toBe(1);
    expect(sample.filledStation).toBe(station);
    expect(sample.filledNativeProgress).toBeGreaterThanOrEqual(sample.heldProgress);
    expect(sample.filledNativeProgress - sample.heldProgress).toBeLessThanOrEqual(0.013);
    expect(sample.filledScroll).toBeCloseTo(sample.heldScroll, 0);
    expect(sample.elapsedMs).toBeGreaterThanOrEqual((station === "photo" ? 2600 : 2400) - 100);
    expect(sample.resultMs).toBeGreaterThanOrEqual(800);
    await expect(director).toHaveAttribute("data-presentation", "result", { timeout: 10_000 });
    await expect(director).toHaveAttribute("data-scroll-locked", "false");
    await expect(root).not.toHaveAttribute("data-interaction-active", station);
    await expect(page.locator(`p[data-interaction-result='${station}']`)).toBeVisible();
    await expect(page.locator("[data-interaction-escape]")).toHaveCount(0);
    // Filling Skip during the automatic sequence does not queue departure.
    // Deliberate input after the protected result continues the journey.
    await expect(director).toHaveAttribute("data-active-station", station);
    await page.mouse.wheel(0, 120);
    await expect(director).toHaveAttribute("data-active-station", "none");
    await expect.poll(async () => Number(await root.getAttribute("data-native-progress"))).toBeGreaterThan(sample.heldProgress);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(sample.heldScroll + 50);
    if (station === "photo") {
      await expect(animation).toHaveAttribute("data-photo-state", "captured");
      expect(Number(await animation.getAttribute("data-photo-animation-progress"))).toBeGreaterThanOrEqual(0.38);
      await page.mouse.wheel(0, 20);
      await expect(animation).toHaveAttribute("data-photo-state", "captured");
      expect(Number(await animation.getAttribute("data-photo-animation-progress"))).toBeGreaterThanOrEqual(0.38);
    } else {
      await expect(animation).toHaveAttribute("data-beam-intensities", "[1,1,1,1,1]");
      await page.mouse.wheel(0, 20);
      await expect(animation).toHaveAttribute("data-beam-intensities", "[1,1,1,1,1]");
    }
    await expect(page.locator("[data-interaction-replay]")).toHaveCount(0);

    await seek(page, narrativeScore.find((item) => item.id === phase)!.preview - 0.004);
    await expect(director).toHaveAttribute("data-active-station", "none");
    await wheelProgress(page, 0.008);
    await waitForStation(page, station);
    await expect(skip).toHaveAttribute("data-scroll-skip-progress", "0.000");
    const revisitScroll = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, -80);
    await expect(director).toHaveAttribute("data-active-station", "none");
    await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(revisitScroll);
    await expect(director).toHaveAttribute("data-scroll-locked", "false");
  });
}

for (const [phase, station] of [["engagement", "touch"], ["experiences", "game"]] as const) {
  test(`a completed ${station} starts a fresh attempt on automatic forward return`, async ({ page }) => {
    await page.goto(`/en?intro=0&phase=${phase}`, { waitUntil: "domcontentloaded" });
    await seekStationReview(page, station);
    const director = await waitForStation(page, station);
    let finalScore = 0;
    if (station === "touch") {
      await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-transition-progress", "1.000");
      await solvePuzzle(page);
    } else {
      const controls = page.locator("[data-game-spatial-controls]");
      await expect(controls).toHaveAttribute("data-game-status", "running");
      await expect.poll(async () => Number(await controls.getAttribute("data-game-score"))).toBeGreaterThan(10);
      finalScore = await driveRaceToCollision(page);
    }
    await expect(director).toHaveAttribute("data-presentation", "result");
    await expect(director).toHaveAttribute("data-scroll-locked", "false");
    await expect(page.locator("[data-interaction-replay], [data-interaction-escape]")).toHaveCount(0);
    await returnToStationForward(page, station);
    await expect(page.locator("[data-interaction-escape]")).toBeVisible();
    await expect(page.locator("[data-interaction-replay]")).toHaveCount(0);
    // Existing completion callbacks must not instantly dismiss this new visit.
    await page.waitForTimeout(800);
    await expect(director).toHaveAttribute("data-active-station", station);
    if (station === "touch") {
      await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-puzzle-solved", "false");
      await expect(page.locator("[data-touch-spatial-controls]")).toHaveAttribute("data-puzzle-moves", "0");
    } else {
      await expect(page.locator("[data-game-spatial-controls]")).toHaveAttribute("data-game-status", "running");
      expect(Number(await page.locator("[data-game-spatial-controls]").getAttribute("data-game-best"))).toBeGreaterThanOrEqual(finalScore);
    }
  });
}

test("a held mobile photo swipe continues with the same finger after the protected animation finishes", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto("/fa?intro=0&phase=discovery", { waitUntil: "domcontentloaded" });
  const root = page.locator("[data-experience-root]");
  const director = page.locator("[data-interaction-director]");
  await expect(root).toHaveAttribute("data-story-stage", "discovery", { timeout: 80_000 });
  await expect(director).toHaveAttribute("data-runtime", /^(full|adaptive)$/, { timeout: 80_000 });
  const session = await context.newCDPSession(page);
  const capture = root.evaluate((element: HTMLElement, targetProgress) => new Promise<{
    heldScroll: number;
    filledScroll: number;
    filledStation: string | null;
    filledElapsedMs: number;
  }>((resolve, reject) => {
    let startedAt: number | null = null;
    let heldScroll = 0;
    let filled: { filledScroll: number; filledStation: string | null; filledElapsedMs: number } | null = null;
    const timer = window.setTimeout(() => {
      observer.disconnect();
      reject(new Error("The mobile protected photo swipe did not release."));
    }, 15_000);
    const observer = new MutationObserver(() => {
      if (element.dataset.interactionActive === "photo" && startedAt === null) {
        startedAt = performance.now();
        heldScroll = scrollY;
      }
      const skip = element.querySelector<HTMLElement>("[data-interaction-escape]");
      if (startedAt !== null && !filled && skip?.dataset.scrollSkipProgress === "1.000") {
        filled = {
          filledScroll: scrollY,
          filledStation: element.dataset.interactionActive ?? null,
          filledElapsedMs: performance.now() - startedAt,
        };
      }
      if (startedAt !== null && element.dataset.interactionActive !== "photo") {
        clearTimeout(timer);
        observer.disconnect();
        if (!filled) { reject(new Error("The mobile photo hold released before its filled state could be observed.")); return; }
        resolve({ heldScroll, ...filled });
      }
    });
    observer.observe(element, { attributes: true, subtree: true, attributeFilter: ["data-interaction-active", "data-scroll-skip-progress"] });
    element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress: targetProgress, sync: true } }));
  }), narrativeScore.find((item) => item.id === "activation")!.preview);
  await expect(root).toHaveAttribute("data-interaction-active", "photo");
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 20, y: 650 }] });
  await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 20, y: 470 }] });
  const sample = await capture;
  expect(sample.filledStation).toBe("photo");
  expect(sample.filledScroll).toBeCloseTo(sample.heldScroll, 0);
  expect(sample.filledElapsedMs).toBeLessThan(2500);

  // Keep the finger down while the timer releases the protected camera hold.
  // That touch began with touch-action:none, so native scrolling alone cannot
  // continue it after release; the remainder must be forwarded explicitly.
  await expect(director).toHaveAttribute("data-presentation", "result", { timeout: 10_000 });
  await expect(director).toHaveAttribute("data-scroll-locked", "false");
  const releasedScroll = await page.evaluate(() => scrollY);
  for (const y of [410, 350, 290]) {
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 20, y }] });
    await page.waitForTimeout(40);
  }
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(releasedScroll + 100);
  await expect(director).toHaveAttribute("data-scroll-locked", "false");
  await expect(page.locator("[data-interaction-replay]")).toHaveCount(0);
  await context.close();
});

test("a completed drawing presents its result and a forward return starts a blank drawing", async ({ page }) => {
  await page.goto("/en?intro=0&phase=connection", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "draw");
  const root = page.locator("[data-experience-root]");
  const canvas = page.locator("[data-drawing-canvas]");
  const controls = page.locator("[data-drawing-spatial-controls]");
  const finish = controls.locator("[data-interaction-continue]");
  await expect(canvas).toHaveAttribute("data-transition-progress", "1.000");
  await canvas.focus();
  await page.keyboard.press("Space");
  for (let index = 0; index < 4; index += 1) await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");
  await expect(controls).toHaveAttribute("data-stroke-count", "1");
  await finish.focus();
  await page.keyboard.press("Enter");
  await expect(director).toHaveAttribute("data-presentation", "result");
  await expect(director).toHaveAttribute("data-scroll-locked", "false");
  await expect(root).not.toHaveAttribute("data-interaction-active", "draw");
  await expect(page.locator("p[data-interaction-result='draw']")).toBeVisible();
  await returnToStationForward(page, "draw");
  await expect(canvas).toHaveAttribute("data-transition-progress", "1.000");
  await expect(controls).toHaveAttribute("data-drawing-finished", "false");
  await expect(controls).toHaveAttribute("data-stroke-count", "0");
  await expect(page.locator("[data-interaction-escape]")).toBeVisible();
  await expect(page.locator("[data-interaction-replay]")).toHaveCount(0);
  await canvas.focus();
  await page.keyboard.press("Space");
  for (let index = 0; index < 4; index += 1) await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Space");
  await expect(controls).toHaveAttribute("data-stroke-count", "1");
  await finish.focus();
  await page.keyboard.press("Enter");
  await expect(director).toHaveAttribute("data-presentation", "result");
  await expect(director).toHaveAttribute("data-scroll-locked", "false");
  await expect(root).not.toHaveAttribute("data-interaction-active", "draw");
  await expect(page.locator("[data-copy-layer]")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator("p[data-interaction-result='draw']")).toBeVisible();
  await expect(page.locator("[data-interaction-replay], [data-interaction-escape]")).toHaveCount(0);
});
