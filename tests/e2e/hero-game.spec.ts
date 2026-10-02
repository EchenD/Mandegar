import { expect, test } from "@playwright/test";
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
  await page.screenshot({ path: testInfo.outputPath("breakout-desktop-ready.png") });

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
  await page.screenshot({ path: testInfo.outputPath("breakout-desktop-paused.png") });
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
  await activateWithKeyboard(page, "[data-game-finish]");
  await expect(director).toHaveAttribute("data-active-station", "none", { timeout: 3_000 });
  await expect(director).toHaveAttribute("data-scroll-locked", "false");
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
    await page.screenshot({ path: testInfo.outputPath(`${locale}-breakout-mobile-ready.png`) });
    await start.tap();
    await expect(controls).toHaveAttribute("data-game-attempts", "1");
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
