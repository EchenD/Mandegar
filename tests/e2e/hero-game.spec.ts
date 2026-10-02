import { expect, test } from "@playwright/test";
import { breakoutBoard } from "../../components/experience/interactions/breakout-game";
import { getInteractionCopy } from "../../components/experience/interactions/interaction-copy";
import { narrativeScore } from "../../components/experience/narrative-score";
import { activateWithKeyboard, waitForStation } from "./hero-interaction-helpers";

test.setTimeout(180_000);
test.use({ video: "off", trace: "off" });

test("Breakout scores a block, pauses and finishes with keyboard controls", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/en?intro=0&phase=experiences", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "game");
  const controls = page.locator("[data-game-spatial-controls]");
  const canvas = page.locator("[data-game-canvas]");
  await expect(canvas).toHaveAttribute("data-transition-progress", "1.000");
  await expect(controls).toHaveAttribute("data-game-type", "breakout");
  await expect(page.locator("[data-game-finish]")).toBeDisabled();
  await expect(page.locator("[data-interaction-hint]")).toBeHidden();
  await expect(page.locator("#primary-navigation")).toBeHidden();
  await expect(page.getByRole("link", { name: "Mandegar home", exact: true })).toBeVisible();
  await expect(page.locator("header [data-analytics='cta_start_project']")).toBeVisible();
  const readyScreenshot = testInfo.outputPath("breakout-desktop-ready.png");
  await page.screenshot({ path: readyScreenshot });
  await testInfo.attach("Breakout ready header", { path: readyScreenshot, contentType: "image/png" });

  const centeredPaddle = Number(await canvas.getAttribute("data-paddle-x"));
  await page.mouse.move(720, 545);
  await page.mouse.down();
  await page.mouse.move(620, 545, { steps: 3 });
  await page.mouse.up();
  await expect.poll(async () => Number(await canvas.getAttribute("data-paddle-x"))).toBeLessThan(centeredPaddle - 25);
  await expect(canvas).toBeFocused();
  const draggedPaddle = Number(await canvas.getAttribute("data-paddle-x"));
  await page.mouse.move(620, 545);
  await page.mouse.down();
  await page.mouse.move(680, 545, { steps: 3 });
  await page.mouse.up();
  await expect.poll(async () => Number(await canvas.getAttribute("data-paddle-x"))).toBeGreaterThan(draggedPaddle + 25);
  await expect(canvas).toBeFocused();
  const initialPaddle = Number(await canvas.getAttribute("data-paddle-x"));
  const scrollY = await page.evaluate(() => window.scrollY);
  await page.keyboard.down("ArrowRight");
  await expect.poll(async () => Number(await canvas.getAttribute("data-paddle-x"))).toBeGreaterThan(initialPaddle + 25);
  await page.keyboard.up("ArrowRight");
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
  // Starting on the authored screen also hands keyboard control to the game.
  await page.mouse.click(720, 370);
  await expect(canvas).toBeFocused();
  await expect(controls).toHaveAttribute("data-game-attempts", "1");
  await activateWithKeyboard(page, "[data-game-replay]");
  await canvas.focus();
  // Exercise Start and Pause in one browser task, before an unattended ball can miss.
  await page.locator("[data-game-action]").evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  await expect(controls).toHaveAttribute("data-game-status", "paused");
  const pausedTime = await controls.getAttribute("data-game-time");
  await page.waitForTimeout(1_200);
  await expect(controls).toHaveAttribute("data-game-time", pausedTime!);
  const pausedScreenshot = testInfo.outputPath("breakout-desktop-paused.png");
  await page.screenshot({ path: pausedScreenshot });
  await testInfo.attach("Breakout paused header", { path: pausedScreenshot, contentType: "image/png" });
  await page.keyboard.press("Space");
  await expect.poll(async () => Number(await controls.getAttribute("data-game-score")), { timeout: 10_000 }).toBeGreaterThan(0);
  await activateWithKeyboard(page, "[data-game-finish]");

  await expect(controls).toHaveAttribute("data-game-status", "complete");
  await expect(director).toHaveAttribute("data-lifecycle", "complete");
  const score = Number(await controls.getAttribute("data-game-score"));
  const cleared = Number(await controls.getAttribute("data-game-completed-count"));
  expect(score).toBe(cleared * 100);
  const result = page.locator("[data-game-result]");
  await expect(result).toBeHidden();
  await expect(result.locator("dd").nth(0)).toHaveText(String(score));
  await expect(result.locator("dd").nth(1)).toHaveText(String(cleared));
  await expect(result.locator("dd").nth(2)).toHaveText(String(score));
  await expect(controls).toHaveAttribute("data-game-best", String(score));
  await page.screenshot({ path: testInfo.outputPath("breakout-desktop-result.png") });
  const exitFrames = await page.locator("[data-game-finish]").evaluate(async (button: HTMLButtonElement, paddleY) => {
    const canvas = document.querySelector<HTMLCanvasElement>("[data-game-canvas]")!;
    const context = canvas.getContext("2d")!;
    const samplePaddle = () => Array.from(context.getImageData(Math.round(Number(canvas.dataset.paddleX)), paddleY, 1, 1).data);
    const expected = samplePaddle();
    const samples: Array<{ transition: number; pixel: number[] }> = [];
    button.click();
    await new Promise<void>((resolve) => {
      const sample = () => {
        samples.push({ transition: Number(canvas.dataset.transitionProgress), pixel: samplePaddle() });
        if (canvas.isConnected) window.requestAnimationFrame(sample);
        else resolve();
      };
      window.requestAnimationFrame(sample);
    });
    return { expected, samples };
  }, breakoutBoard.paddleY + 6);
  expect(exitFrames.samples.length).toBeGreaterThan(0);
  expect(exitFrames.samples.at(-1)!.transition).toBe(0);
  for (const frame of exitFrames.samples) expect(frame.pixel).toEqual(exitFrames.expected);

  await expect(director).toHaveAttribute("data-active-station", "none", { timeout: 3_000 });
  await expect(director).toHaveAttribute("data-scroll-locked", "false");
  await expect(page.locator("#primary-navigation")).toBeVisible();
  expect(errors).toEqual([]);
});

test("Breakout replay retains the best score and restores Skip", async ({ page }) => {
  await page.goto("/en?intro=0&phase=experiences", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "game");
  const controls = page.locator("[data-game-spatial-controls]");
  await expect(page.locator("[data-game-canvas]")).toHaveAttribute("data-transition-progress", "1.000");
  await activateWithKeyboard(page, "[data-game-action]");
  await expect.poll(async () => Number(await controls.getAttribute("data-game-score")), { timeout: 10_000 }).toBeGreaterThan(0);
  await activateWithKeyboard(page, "[data-game-finish]");
  await expect(director).toHaveAttribute("data-lifecycle", "complete");
  const firstBest = await controls.getAttribute("data-game-best");
  await activateWithKeyboard(page, "[data-game-replay]");
  await expect(controls).toHaveAttribute("data-game-status", "ready");
  await expect(controls).toHaveAttribute("data-game-score", "0");
  await expect(controls).toHaveAttribute("data-game-attempts", "0");
  await expect(controls).toHaveAttribute("data-game-lives", "3");
  await expect(controls).toHaveAttribute("data-game-time", "25");
  await expect(controls).toHaveAttribute("data-game-best", firstBest!);
  await expect(page.locator("[data-game-result]")).toHaveCount(0);
  await expect(director).toHaveAttribute("data-lifecycle", "active");
  const exit = page.locator("[data-interaction-escape]");
  await expect(exit).toHaveText("Skip interaction");
  await exit.click();
  await expect(director).toHaveAttribute("data-active-station", "none");
  await expect(director).toHaveAttribute("data-scroll-locked", "false");
});

test("mouse Start and drag controls the paddle outside the screen and releases cleanly", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en?intro=0&phase=experiences", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "game");
  const controls = page.locator("[data-game-spatial-controls]");
  const canvas = page.locator("[data-game-canvas]");
  await expect(canvas).toHaveAttribute("data-transition-progress", "1.000");

  // Start and steering are one continuous mouse gesture on the authored screen.
  await page.mouse.move(720, 370);
  await page.mouse.down();
  await page.mouse.move(900, 370, { steps: 3 });
  await expect(controls).toHaveAttribute("data-game-attempts", "1");
  await expect(canvas).toHaveAttribute("data-dragging", "true");
  await expect.poll(async () => Number(await canvas.getAttribute("data-paddle-x")))
    .toBe(breakoutBoard.right - breakoutBoard.paddleWidth / 2);
  await page.mouse.move(540, 420, { steps: 3 });
  await expect.poll(async () => Number(await canvas.getAttribute("data-paddle-x")))
    .toBe(breakoutBoard.left + breakoutBoard.paddleWidth / 2);
  await page.mouse.move(900, 600, { steps: 3 });
  await expect.poll(async () => Number(await canvas.getAttribute("data-paddle-x")))
    .toBe(breakoutBoard.right - breakoutBoard.paddleWidth / 2);
  await page.mouse.up();
  await expect(canvas).toHaveAttribute("data-dragging", "false");
  await expect(canvas).toBeFocused();

  const releasedPaddle = await canvas.getAttribute("data-paddle-x");
  await page.mouse.move(620, 545, { steps: 3 });
  await expect(canvas).toHaveAttribute("data-paddle-x", releasedPaddle!);
  await page.keyboard.press("ArrowLeft");
  await expect.poll(async () => Number(await canvas.getAttribute("data-paddle-x")))
    .toBeLessThan(Number(releasedPaddle));
  await page.locator("[data-interaction-escape]").click();
  await expect(director).toHaveAttribute("data-active-station", "none");
});

test("window blur releases mouse dragging and the next drag works", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en?intro=0&phase=experiences", { waitUntil: "domcontentloaded" });
  await waitForStation(page, "game");
  const canvas = page.locator("[data-game-canvas]");
  await expect(canvas).toHaveAttribute("data-transition-progress", "1.000");
  await page.mouse.move(720, 545);
  await page.mouse.down();
  await page.mouse.move(620, 545, { steps: 3 });
  await expect(canvas).toHaveAttribute("data-dragging", "true");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(canvas).toHaveAttribute("data-dragging", "false");
  const releasedPaddle = await canvas.getAttribute("data-paddle-x");
  await page.mouse.move(800, 545, { steps: 3 });
  await page.mouse.up();
  await expect(canvas).toHaveAttribute("data-paddle-x", releasedPaddle!);

  await page.mouse.move(720, 545);
  await page.mouse.down();
  await page.mouse.move(780, 545, { steps: 3 });
  await page.mouse.up();
  await expect(canvas).toHaveAttribute("data-dragging", "false");
  await expect.poll(async () => Number(await canvas.getAttribute("data-paddle-x")))
    .toBeGreaterThan(Number(releasedPaddle) + 30);

  const session = await page.context().newCDPSession(page);
  const firstTouch = { id: 1, x: 720, y: 545 };
  const secondTouch = { id: 2, x: 800, y: 420 };
  let activeTouch = false;
  try {
    await session.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [firstTouch] });
    activeTouch = true;
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...firstTouch, x: 620 }] });
    await expect(canvas).toHaveAttribute("data-dragging", "true");
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...firstTouch, x: 620 }, secondTouch] });
    const outsideTouch = { ...firstTouch, x: 900, y: 600 };
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [outsideTouch, secondTouch] });
    await expect.poll(async () => Number(await canvas.getAttribute("data-paddle-x")))
      .toBe(breakoutBoard.right - breakoutBoard.paddleWidth / 2);
    // Releasing the ignored second touch must preserve the original captured drag.
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [outsideTouch] });
    await expect(canvas).toHaveAttribute("data-dragging", "true");
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...outsideTouch, x: 540 }] });
    await expect.poll(async () => Number(await canvas.getAttribute("data-paddle-x")))
      .toBe(breakoutBoard.left + breakoutBoard.paddleWidth / 2);
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    activeTouch = false;
    await expect(canvas).toHaveAttribute("data-dragging", "false");
  } finally {
    if (activeTouch) await session.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] }).catch(() => {});
    await session.send("Emulation.setTouchEmulationEnabled", { enabled: false }).catch(() => {});
    await session.detach().catch(() => {});
  }
});

test("completed game plays in the background and hands controls back without changing visitor scores", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en?intro=0&phase=experiences", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "game");
  const controls = page.locator("[data-game-spatial-controls]");
  const canvas = page.locator("[data-game-canvas]");
  const ambient = page.locator("[data-game-ambient]");
  await expect(canvas).toHaveAttribute("data-transition-progress", "1.000");
  await expect(ambient).toHaveAttribute("data-ambient-state", "unavailable");
  // A zero-score Finish still unlocks background play after Continue.
  await page.locator("[data-game-action]").evaluate(async (button: HTMLButtonElement) => {
    button.click();
    const finish = document.querySelector<HTMLButtonElement>("[data-game-finish]")!;
    await new Promise<void>((resolve) => {
      if (!finish.disabled) return resolve();
      const observer = new MutationObserver(() => {
        if (finish.disabled) return;
        observer.disconnect();
        resolve();
      });
      observer.observe(finish, { attributes: true, attributeFilter: ["disabled"] });
    });
    finish.click();
  });
  await expect(director).toHaveAttribute("data-lifecycle", "complete");
  await expect(controls).toHaveAttribute("data-game-score", "0");
  await expect(controls).toHaveAttribute("data-game-best", "0");
  await expect(ambient).toHaveAttribute("data-ambient-state", "interactive");
  await activateWithKeyboard(page, "[data-game-finish]");
  await expect(director).toHaveAttribute("data-active-station", "none");
  await expect(director).toHaveAttribute("data-scroll-locked", "false");
  await expect(ambient).toHaveAttribute("data-ambient-state", "playing");
  await expect(ambient).toHaveAttribute("data-ambient-visibility", "1.000");
  await page.evaluate(() => {
    const observer = window as unknown as Window & { __creationChanges: number };
    observer.__creationChanges = 0;
    window.addEventListener("mandegar:creation-change", () => { observer.__creationChanges += 1; });
  });
  const firstBall = await ambient.getAttribute("data-ambient-ball");
  await expect.poll(() => ambient.getAttribute("data-ambient-ball")).not.toBe(firstBall);
  await expect.poll(async () => Number(await ambient.getAttribute("data-ambient-score")), { timeout: 10_000 }).toBeGreaterThan(0);
  expect(await page.evaluate(() => (window as unknown as Window & { __creationChanges: number }).__creationChanges)).toBe(0);

  const root = page.locator("[data-experience-root]");
  const experiences = narrativeScore.find((beat) => beat.id === "experiences")!;
  const activation = narrativeScore.find((beat) => beat.id === "activation")!;
  await root.evaluate((element, progress) => {
    element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress, sync: true } }));
  }, experiences.start + 0.01);
  await expect.poll(async () => Number(await ambient.getAttribute("data-ambient-visibility"))).toBeGreaterThan(0);
  expect(Number(await ambient.getAttribute("data-ambient-visibility"))).toBeLessThan(1);
  await root.evaluate((element, progress) => {
    element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress, sync: true } }));
  }, activation.preview);
  await expect(ambient).toHaveAttribute("data-ambient-state", "paused");
  await expect(ambient).toHaveAttribute("data-ambient-visibility", "0.000");
  const pausedBall = await ambient.getAttribute("data-ambient-ball");
  await page.waitForTimeout(250);
  await expect(ambient).toHaveAttribute("data-ambient-ball", pausedBall!);
  await root.evaluate((element, progress) => {
    element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress, sync: true } }));
  }, experiences.preview);
  await expect(ambient).toHaveAttribute("data-ambient-state", "playing");
  await expect(director).toHaveAttribute("data-active-station", "none");
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mandegar:interaction-request", {
    detail: { station: "game", input: "keyboard" },
  })));
  await waitForStation(page, "game");
  await expect(ambient).toHaveAttribute("data-ambient-state", "interactive");
  await expect(canvas).toHaveAttribute("data-transition-progress", "1.000");
  await expect(controls).toHaveAttribute("data-game-status", "ready");
  await expect(controls).toHaveAttribute("data-game-score", "0");
  await expect(controls).toHaveAttribute("data-game-best", "0");
  await expect(controls).toHaveAttribute("data-game-attempts", "0");
  await page.locator("[data-interaction-escape]").click();
  await expect(director).toHaveAttribute("data-active-station", "none");
  await expect(ambient).toHaveAttribute("data-ambient-state", "playing");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(ambient).toHaveAttribute("data-ambient-state", "still");
  const stillBall = await ambient.getAttribute("data-ambient-ball");
  await page.waitForTimeout(250);
  await expect(ambient).toHaveAttribute("data-ambient-ball", stillBall!);
});

for (const { locale, height } of [{ locale: "fa", height: 844 }, { locale: "ar", height: 640 }]) {
  test(`${locale} Breakout controls fit mobile RTL and support held paddle movement`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({ viewport: { width: 390, height }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.goto(`/${locale}?intro=0&phase=experiences`, { waitUntil: "domcontentloaded" });
    const director = await waitForStation(page, "game");
    const controls = page.locator("[data-game-spatial-controls]");
    const canvas = page.locator("[data-game-canvas]");
    await expect(canvas).toHaveAttribute("data-transition-progress", "1.000");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("[data-interaction-hint]")).toBeHidden();
    if (locale === "fa") {
      const menu = page.locator("header button[aria-controls='primary-navigation']");
      const firstLink = page.locator("#primary-navigation a").first();
      await menu.click();
      await expect(menu).toHaveAttribute("aria-expanded", "true");
      await expect(firstLink).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(menu).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(firstLink).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(menu).toHaveAttribute("aria-expanded", "false");
      await expect(menu).toBeFocused();
      await expect(director).toHaveAttribute("data-active-station", "game");
      await expect(director).toHaveAttribute("data-scroll-locked", "true");
    }
    const copy = getInteractionCopy(locale as "fa" | "ar");
    const stats = page.locator("[data-mobile-game-stats]");
    await expect(stats.locator("dt")).toHaveText([copy.game.score, copy.game.lives, copy.game.time]);
    await expect(stats.locator("dd bdi")).toHaveText(["0", "3", "25"]);
    const header = page.locator("[data-mobile-game-dock] strong");
    const statsBox = (await stats.boundingBox())!;
    const titleBox = (await header.boundingBox())!;
    expect(statsBox.x + statsBox.width).toBeLessThanOrEqual(titleBox.x);
    expect(await stats.evaluate((element) => Array.from(element.querySelectorAll("dt")).every((label) => label.scrollWidth <= label.clientWidth))).toBe(true);
    const left = page.locator("[data-mobile-game-left]");
    const right = page.locator("[data-mobile-game-right]");
    const start = page.locator("[data-mobile-game-action]");
    const finish = page.locator("[data-mobile-game-finish]");
    for (const button of [left, right, start, finish]) {
      await expect(button).toBeInViewport();
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    expect((await left.boundingBox())!.x).toBeLessThan((await right.boundingBox())!.x);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const originalPaddle = Number(await canvas.getAttribute("data-paddle-x"));
    const rightBox = (await right.boundingBox())!;
    await page.mouse.move(rightBox.x + rightBox.width / 2, rightBox.y + rightBox.height / 2);
    await page.mouse.down();
    await expect.poll(async () => Number(await canvas.getAttribute("data-paddle-x"))).toBeGreaterThan(originalPaddle + 35);
    await page.mouse.up();
    const releasedPaddle = await canvas.getAttribute("data-paddle-x");
    await page.waitForTimeout(250);
    await expect(canvas).toHaveAttribute("data-paddle-x", releasedPaddle!);
    if (locale === "fa") {
      const session = await context.newCDPSession(page);
      const leftBox = (await left.boundingBox())!;
      const leftTouch = { id: 1, x: leftBox.x + leftBox.width / 2, y: leftBox.y + leftBox.height / 2 };
      const rightTouch = { id: 2, x: rightBox.x + rightBox.width / 2, y: rightBox.y + rightBox.height / 2 };
      let activeTouch = false;
      try {
        await session.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
        await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [leftTouch] });
        activeTouch = true;
        await expect.poll(async () => Number(await canvas.getAttribute("data-paddle-x")))
          .toBeLessThan(Number(releasedPaddle) - 50);
        await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [leftTouch, rightTouch] });
        // The active touch set releases the older finger while the latest stays held.
        await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [rightTouch] });
        const afterOlderRelease = Number(await canvas.getAttribute("data-paddle-x"));
        await expect.poll(async () => Number(await canvas.getAttribute("data-paddle-x")))
          .toBeGreaterThan(afterOlderRelease + 35);
        await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        activeTouch = false;
        const afterLatestRelease = await canvas.getAttribute("data-paddle-x");
        await page.waitForTimeout(250);
        await expect(canvas).toHaveAttribute("data-paddle-x", afterLatestRelease!);
      } finally {
        if (activeTouch) await session.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] }).catch(() => {});
        await session.detach().catch(() => {});
      }
    }
    await page.screenshot({ path: testInfo.outputPath(`${locale}-breakout-mobile-ready.png`) });
    await start.tap();
    await expect(controls).toHaveAttribute("data-game-attempts", "1");
    if (locale === "fa") {
      const menu = page.locator("header button[aria-controls='primary-navigation']");
      await menu.tap();
      await expect(controls).toHaveAttribute("data-game-status", "paused");
      const pausedTime = await controls.getAttribute("data-game-time");
      await page.waitForTimeout(1_100);
      await expect(controls).toHaveAttribute("data-game-time", pausedTime!);
      await page.keyboard.press("Escape");
      await expect(menu).toHaveAttribute("aria-expanded", "false");
      await expect(director).toHaveAttribute("data-active-station", "game");
      await expect(controls).toHaveAttribute("data-game-status", "paused");
      await start.tap();
      // A resumed ball can miss the paddle before the next browser assertion.
      await expect(controls).not.toHaveAttribute("data-game-status", "paused");
    }
    await finish.tap();
    await expect(director).toHaveAttribute("data-lifecycle", "complete");
    await expect(page.locator("[data-game-result-replay]")).toBeInViewport();
    const exit = page.locator("[data-mobile-interaction-skip]");
    await expect(exit).toBeInViewport();
    const resultBox = (await page.locator("[data-game-result]").boundingBox())!;
    const exitBox = (await exit.boundingBox())!;
    expect(resultBox.y + resultBox.height).toBeLessThanOrEqual(exitBox.y);
    await page.screenshot({ path: testInfo.outputPath(`${locale}-breakout-mobile-result.png`) });
    await page.locator("[data-game-result-replay]").tap();
    await expect(controls).toHaveAttribute("data-game-status", "ready");
    await expect(page.locator("[data-mobile-game-action]")).toBeInViewport();
    await exit.tap();
    await expect(director).toHaveAttribute("data-active-station", "none");
    await expect(director).toHaveAttribute("data-scroll-locked", "false");
    await context.close();
  });
}
