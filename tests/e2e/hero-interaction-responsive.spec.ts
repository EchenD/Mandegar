import { expect, test } from "@playwright/test";
import { waitForStation } from "./hero-interaction-helpers";

test.setTimeout(120_000);

for (const locale of ["fa", "en", "ar"] as const) {
  test(`${locale} drawing step fits a mobile viewport`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/${locale}?intro=0&phase=connection`, { waitUntil: "domcontentloaded" });
    await waitForStation(page, "draw");
    await expect(page.locator("[data-drawing-spatial-controls]")).toBeAttached();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(2);
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-active-station", "none");
  });
}

test("reduced motion uses semantic fallback without opening a WebGL station", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/en?intro=0&phase=reveal", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-webgl='fallback']")).toBeVisible();
  await expect(page.locator("[data-semantic-fallback]")).toBeVisible();
  await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-active-station", "none");
  await context.close();
});

test("touch-capable mobile viewport opens the photo step automatically", async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("/en?intro=0&phase=activation", { waitUntil: "domcontentloaded" });
  await waitForStation(page, "photo");
  const root = page.locator("[data-experience-root]");
  await expect(root).toHaveAttribute("data-story-stage", "activation");
  const progress = await root.evaluate((element: HTMLElement) => ({
    native: Number(element.dataset.nativeProgress),
    narrative: Number(element.dataset.narrativeProgress),
  }));
  expect(Math.abs(progress.native - progress.narrative)).toBeLessThan(0.01);
  await expect(page.locator("[data-photo-spatial-controls]")).toBeAttached();
  const capture = page.locator("[data-mobile-photo-capture]");
  await expect(capture).toBeInViewport();
  await expect(capture).toBeEnabled();
  await expect(page.locator("[data-photo-service-dock]")).toContainText("Instantly on the visitor’s phone.");
  await expect(capture).toHaveText("Watch the demo");
  await expect(page.locator("[data-mobile-photo-look], [data-mobile-photo-preview]")).toHaveCount(0);
  await context.close();
});

test("mobile photo replay stays reachable beside the journey action", async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("/en?intro=0&phase=activation", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "photo");
  const controls = page.locator("[data-photo-spatial-controls]");
  await expect(controls).toHaveAttribute("data-photo-state", "ready");
  await expect(page.locator("[data-photo-service-dock]")).toBeInViewport();
  await expect(page.locator("[data-mobile-photo-preview]")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("mobile-photo-ready.png"), animations: "disabled" });
  await page.locator("[data-mobile-photo-capture]").tap();
  await expect(controls).toHaveAttribute("data-photo-state", "captured", { timeout: 10_000 });
  const result = page.locator("[data-mobile-photo-result]");
  await expect(result).toHaveCSS("opacity", "1");
  await expect(result).toBeInViewport();
  await expect(result).toContainText("From the event to their phone.");
  await expect(result).toContainText("Delivery demo · example photo");
  await expect(result.locator("img")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("mobile-photo-captured.png"), animations: "disabled" });
  const replay = page.locator("[data-mobile-photo-replay]");
  await expect(replay).toBeInViewport();
  await replay.tap();
  await expect(controls).toHaveAttribute("data-photo-state", "ready");
  await expect(page.locator("[data-mobile-photo-result]")).toHaveCount(0);
  await expect(page.locator("[data-mobile-photo-capture]")).toBeInViewport();
  await controls.evaluate((element: HTMLElement) => {
    const canvas = element.querySelector("canvas");
    if (!canvas) throw new Error("Photo canvas is missing");
    element.dataset.photoCountdownObserved = "false";
    const observer = new MutationObserver((records) => {
      if (element.dataset.photoState !== "countdown" && canvas.dataset.paintedPhotoState !== "countdown"
        && !records.some((record) => record.oldValue === "countdown")) return;
      element.dataset.photoCountdownObserved = "true";
      observer.disconnect();
    });
    observer.observe(element, { attributes: true, attributeOldValue: true, attributeFilter: ["data-photo-state"] });
    observer.observe(canvas, { attributes: true, attributeOldValue: true, attributeFilter: ["data-painted-photo-state"] });
  });
  await page.locator("[data-mobile-photo-capture]").tap();
  await expect(controls).toHaveAttribute("data-photo-state", "captured", { timeout: 10_000 });
  await expect(controls).toHaveAttribute("data-photo-countdown-observed", "true");
  await page.locator("[data-mobile-interaction-skip]").tap();
  await expect(director).toHaveAttribute("data-active-station", "none", { timeout: 3_000 });
  await context.close();
});

for (const { locale, height } of [{ locale: "fa", height: 568 }, { locale: "ar", height: 640 }]) {
  test(`${locale} short mobile photo delivery demo leaves room for its actions at ${height}px`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({
      hasTouch: true,
      viewport: { width: 360, height },
    });
    const page = await context.newPage();
    await page.goto(`/${locale}?intro=0&phase=activation`, { waitUntil: "domcontentloaded" });
    await waitForStation(page, "photo");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(2);
    const capture = page.locator("[data-mobile-photo-capture]");
    const service = page.locator("[data-photo-service-dock]");
    const exit = page.locator("[data-mobile-interaction-skip]");
    await expect(page.locator("[data-mobile-photo-preview]")).toHaveCount(0);
    await expect(capture).toBeInViewport();
    await expect(service).toBeInViewport();
    await expect(exit).toBeInViewport();
    const serviceBox = await service.boundingBox();
    const exitBox = await exit.boundingBox();
    expect(serviceBox && exitBox && serviceBox.y + serviceBox.height < exitBox.y).toBeTruthy();
    await page.screenshot({ path: testInfo.outputPath(`${locale}-mobile-photo-ready-${height}.png`), animations: "disabled" });
    await capture.tap();
    await expect(page.locator("[data-photo-spatial-controls]")).toHaveAttribute("data-photo-state", "captured", { timeout: 10_000 });
    const result = page.locator("[data-mobile-photo-result]");
    const replay = page.locator("[data-mobile-photo-replay]");
    await expect(result).toHaveCSS("opacity", "1");
    await expect(result).toBeInViewport();
    await expect(replay).toBeInViewport();
    const resultBox = await result.boundingBox();
    const continueBox = await exit.boundingBox();
    expect(resultBox && continueBox && resultBox.y + resultBox.height < continueBox.y).toBeTruthy();
    await context.close();
  });
}

test("mobile touch composition remains playable before continuing", async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("/en?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "touch");
  await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-transition-progress", "1.000");
  for (const x of [111, 227, 340]) {
    await page.touchscreen.tap(x, 300);
  }
  await expect(page.locator("[data-touch-spatial-controls]")).toHaveAttribute("data-touch-complete", "true");
  await page.screenshot({ path: testInfo.outputPath("mobile-composer-complete.png"), animations: "disabled" });
  await page.locator("[data-mobile-interaction-skip]").tap();
  await expect(director).toHaveAttribute("data-active-station", "none", { timeout: 3_000 });
  await context.close();
});

test("mobile stage can be skipped before activating any beams", async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("/en?intro=0&phase=reveal", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "stage");
  await expect(page.locator("[data-stage-spatial-controls]")).toHaveAttribute("data-stage-active-count", "0");
  const skip = page.locator("[data-mobile-interaction-skip]");
  await expect(skip).toBeInViewport();
  await skip.tap();
  await expect(director).toHaveAttribute("data-active-station", "none", { timeout: 3_000 });
  await expect(director).toHaveAttribute("data-scroll-locked", "false");
  const before = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => window.scrollBy({ top: 120, behavior: "auto" }));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
  await context.close();
});

test("mobile stage beams remain playable in Persian", async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("/fa?intro=0&phase=reveal", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "stage");
  const dock = page.locator("[data-mobile-stage-dock]");
  await expect(dock).toBeInViewport();
  for (let index = 1; index <= 5; index += 1) {
    await dock.locator(`[data-mobile-stage-beam='${index}']`).tap();
  }
  await expect(page.locator("[data-stage-spatial-controls]")).toHaveAttribute("data-stage-complete", "false");
  await expect(dock.locator("[data-mobile-stage-finish]")).toBeInViewport();
  await dock.locator("[data-mobile-stage-finish]").tap();
  await expect(page.locator("[data-stage-spatial-controls]")).toHaveAttribute("data-stage-complete", "true");
  const continueButton = page.locator("[data-mobile-interaction-skip]");
  await expect(continueButton).toHaveText("ادامه مسیر");
  await page.screenshot({ path: testInfo.outputPath("fa-mobile-stage-finished.png"), animations: "disabled" });
  await continueButton.tap();
  await expect(director).toHaveAttribute("data-active-station", "none", { timeout: 3_000 });
  await context.close();
});

test("mobile drawing can be edited and finished without reaching cropped screen controls", async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("/en?intro=0&phase=connection", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "draw");
  await expect(page.locator("[data-drawing-canvas]")).toHaveAttribute("data-transition-progress", "1.000");
  const controls = page.locator("[data-drawing-spatial-controls]");
  const dock = page.locator("[data-mobile-drawing-dock]");
  await expect(dock).toBeInViewport();

  const drawStroke = async () => {
    await page.mouse.move(155, 290);
    await page.mouse.down();
    await page.mouse.move(235, 305, { steps: 5 });
    await page.mouse.up();
  };

  await drawStroke();
  await expect(controls).toHaveAttribute("data-stroke-count", "1");
  await dock.getByRole("button", { name: "Undo" }).tap();
  await expect(controls).toHaveAttribute("data-stroke-count", "0");
  await drawStroke();
  await dock.getByRole("button", { name: "Clear" }).tap();
  await expect(controls).toHaveAttribute("data-stroke-count", "0");
  await drawStroke();
  await dock.locator("[data-mobile-drawing-finish]").tap();
  await expect(controls).toHaveAttribute("data-drawing-finished", "true");
  await expect(page.locator("[data-mobile-interaction-skip]")).toHaveText("Continue journey");
  await page.locator("[data-mobile-interaction-skip]").tap();
  await expect(director).toHaveAttribute("data-active-station", "none", { timeout: 3_000 });
  await context.close();
});
