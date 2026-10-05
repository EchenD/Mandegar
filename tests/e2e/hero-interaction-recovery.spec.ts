import { expect, test } from "@playwright/test";
import { driveRaceToCollision, returnToStationForward, seekStationReview, waitForStation } from "./hero-interaction-helpers";

test.setTimeout(180_000);
test.use({ video: "off", trace: "off" });

test("Skip restores the previous keyboard focus without moving the reading position", async ({ page }) => {
  await page.goto("/en?intro=0&phase=discovery", { waitUntil: "domcontentloaded" });
  const root = page.locator("[data-experience-root]");
  await expect(root).toHaveAttribute("data-story-stage", "discovery", { timeout: 80_000 });
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

test("a completed race keeps its result and a fresh forward race remains active without Replay", async ({ page }) => {
  await page.goto("/en?intro=0&phase=experiences", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "game");
  await expect(page.locator("[data-game-canvas]")).toHaveAttribute("data-transition-progress", "1.000");
  const score = await driveRaceToCollision(page);
  const root = page.locator("[data-experience-root]");
  await expect(director).toHaveAttribute("data-presentation", "result");
  await expect(root).not.toHaveAttribute("data-interaction-active", "game");
  await expect(director).toHaveAttribute("data-active-station", "game");
  await expect(page.locator("[data-game-spatial-controls]")).toHaveAttribute("data-game-status", "complete");
  await expect(page.locator("p[data-interaction-result='game']")).toBeVisible();
  await expect(page.locator("[data-game-finish], [data-game-replay], [data-interaction-replay]")).toHaveCount(0);
  await returnToStationForward(page, "game");
  await expect(page.locator("[data-game-canvas]")).toHaveAttribute("data-transition-progress", "1.000");
  await expect(page.locator("[data-game-spatial-controls]")).toHaveAttribute("data-game-outcome", "none");
  await expect.poll(async () => Number(await page.locator("[data-game-spatial-controls]").getAttribute("data-game-best"))).toBeGreaterThanOrEqual(score);
  // A new run must survive past the previous result's protection interval.
  await page.waitForTimeout(1_100);
  await expect(director).toHaveAttribute("data-active-station", "game");
  await expect(director).toHaveAttribute("data-presentation", "active");
  await expect(root).toHaveAttribute("data-interaction-active", "game");
  await expect(page.locator("[data-game-spatial-controls]")).toHaveAttribute("data-game-status", "running");
});

test("a race result protects its reading moment then forwards a mobile swipe before the monitor leaves", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto("/en?intro=0&phase=experiences", { waitUntil: "domcontentloaded" });
  await waitForStation(page, "game");
  await expect(page.locator("[data-game-canvas]")).toHaveAttribute("data-transition-progress", "1.000");
  const root = page.locator("[data-experience-root]");
  const protection = root.evaluate((element: HTMLElement) => new Promise<{
    protectedMs: number;
    movedDuringProtection: boolean;
    monitorPresent: boolean;
    activeStation: string | undefined;
  }>((resolve, reject) => {
    const started = performance.now();
    let resultAt: number | null = null;
    let heldScroll = 0;
    let movedDuringProtection = false;
    let wheelAt = 0;
    const resultStarted = new MutationObserver(() => {
      if (element.dataset.interactionResult === "game" && resultAt === null) {
        resultAt = performance.now();
        heldScroll = scrollY;
      }
    });
    resultStarted.observe(element, { attributes: true, attributeFilter: ["data-interaction-result"] });
    element.dataset.resultProtectionObserverReady = "true";
    const tick = (now: number) => {
      if (now - started > 35_000) {
        resultStarted.disconnect();
        reject(new Error("Race completion did not release its protected result."));
        return;
      }
      if (element.dataset.interactionResult === "game") {
        if (resultAt === null) { resultAt = now; heldScroll = scrollY; }
        const held = element.dataset.interactionActive === "game";
        if (held) {
          movedDuringProtection ||= Math.abs(scrollY - heldScroll) > 2;
          // Residual wheel packets cannot erase a freshly completed race.
          if (now - wheelAt > 100) {
            window.dispatchEvent(new WheelEvent("wheel", { deltaY: 120, bubbles: true, cancelable: true }));
            wheelAt = now;
          }
        } else {
          resultStarted.disconnect();
          resolve({
            protectedMs: now - resultAt,
            movedDuringProtection,
            monitorPresent: document.querySelector("[data-game-canvas]") !== null,
            activeStation: document.querySelector<HTMLElement>("[data-interaction-director]")?.dataset.activeStation,
          });
          return;
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  await expect(root).toHaveAttribute("data-result-protection-observer-ready", "true");
  await driveRaceToCollision(page);
  const sample = await protection;
  expect(sample.protectedMs).toBeGreaterThanOrEqual(800);
  expect(sample.movedDuringProtection).toBe(false);
  expect(sample.monitorPresent).toBe(true);
  expect(sample.activeStation).toBe("game");
  await expect(page.locator("p[data-interaction-result='game']")).toBeVisible();
  await expect(root).not.toHaveAttribute("data-interaction-active", "game");

  const handoff = await root.evaluate(async (element: HTMLElement) => {
    const director = document.querySelector<HTMLElement>("[data-interaction-director]")!;
    const canvas = document.querySelector<HTMLCanvasElement>("[data-experience-canvas='true'] canvas")!;
    const scrollBefore = scrollY;
    const point = (y: number) => new Touch({ identifier: 1, target: canvas, clientX: 10, clientY: y });
    const start = point(450);
    canvas.dispatchEvent(new TouchEvent("touchstart", {
      bubbles: true, cancelable: true, touches: [start], changedTouches: [start],
    }));
    const moves = [430, 390].map((y) => {
      const moved = point(y);
      const move = new TouchEvent("touchmove", {
        bubbles: true, cancelable: true, touches: [moved], changedTouches: [moved],
      });
      canvas.dispatchEvent(move);
      return move.defaultPrevented;
    });
    const moved = point(390);
    canvas.dispatchEvent(new TouchEvent("touchend", {
      bubbles: true, cancelable: true, touches: [], changedTouches: [moved],
    }));
    const snapshot = {
      monitorPresent: document.querySelector("[data-game-canvas]") !== null,
      activeStation: director.dataset.activeStation,
      departing: element.dataset.interactionDeparting,
      scrollAdvance: scrollY - scrollBefore,
      prevented: moves,
    };
    // A pending smooth-scroll target must not pull the released finger's
    // later native movement back after its final packet or touchend.
    const finalPacketScroll = scrollY;
    const scrollSamples = [finalPacketScroll];
    const started = performance.now();
    await new Promise<void>((resolve) => {
      const sampleScroll = () => {
        scrollSamples.push(scrollY);
        if (performance.now() - started >= 200) resolve();
        else requestAnimationFrame(sampleScroll);
      };
      requestAnimationFrame(sampleScroll);
    });
    return { ...snapshot, finalPacketScroll, scrollSamples };
  });
  expect(handoff.monitorPresent).toBe(true);
  expect(handoff.activeStation).toBe("game");
  expect(handoff.departing).toBe("game");
  expect(handoff.scrollAdvance).toBeGreaterThan(20);
  expect(handoff.prevented).toEqual([true, true]);
  expect(handoff.scrollSamples.length).toBeGreaterThan(1);
  expect(Math.min(...handoff.scrollSamples)).toBeGreaterThanOrEqual(handoff.finalPacketScroll - 1);
  for (let index = 1; index < handoff.scrollSamples.length; index += 1) {
    expect(handoff.scrollSamples[index]).toBeGreaterThanOrEqual(handoff.scrollSamples[index - 1] - 1);
  }
  await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-active-station", "none");
  await expect(page.locator("[data-game-canvas]")).toHaveCount(0);
  await context.close();
});

test("fresh puzzle visits restore stable navigation focus after their tile controls unmount", async ({ page }) => {
  await page.goto("/en?intro=0&phase=discovery", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-experience-root]")).toHaveAttribute("data-story-stage", "discovery", { timeout: 80_000 });
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
    await expect(page.locator("[data-interaction-escape]")).toBeFocused();
    await expect(page.locator("[data-touch-spatial-controls]")).toHaveAttribute("data-puzzle-moves", "0");
    await page.locator("[data-puzzle-slot='0']").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-touch-spatial-controls]")).toHaveAttribute("data-puzzle-selected", "0");
    if (exitKey === "Enter") await page.locator("[data-interaction-escape]").focus();
    const before = await page.evaluate(() => scrollY);
    await page.keyboard.press(exitKey);
    await expect(director).toHaveAttribute("data-active-station", "none");
    await expect(previous).toBeFocused();
    await expect(page.locator("[data-puzzle-slot], [data-interaction-replay]")).toHaveCount(0);
    expect(Math.abs(await page.evaluate(() => scrollY) - before)).toBeLessThan(2);
  }
});
