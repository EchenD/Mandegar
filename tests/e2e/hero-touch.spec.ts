import { expect, test } from "@playwright/test";
import { narrativeScore } from "../../components/experience/narrative-score";
import { activateWithKeyboard, returnToStationForward, seekStationReview, waitForStation } from "./hero-interaction-helpers";
import { clearMonitorTextureSamples, getMonitorTextureSamples, observeMonitorTextures } from "./monitor-texture-observer";

test.setTimeout(150_000);
test.use({ video: "off", trace: "off" });

test("the touch monitor fades in, retains its forward view and resets on native backward scrolling", async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await observeMonitorTextures(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  const requests: string[] = [];
  page.on("request", (request) => { requests.push(request.url()); });
  await page.goto("/en?intro=0&phase=activation", { waitUntil: "domcontentloaded" });
  const root = page.locator("[data-experience-root]");
  await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-runtime", /^(full|adaptive)$/, { timeout: 80_000 });
  await expect(root).toHaveAttribute("data-story-stage", "activation", { timeout: 80_000 });
  expect(await getMonitorTextureSamples(page, "interactive")).toEqual([]);
  expect(await getMonitorTextureSamples(page, "game")).toEqual([]);
  expect(await getMonitorTextureSamples(page, "main")).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("before-touch.png") });
  await seekStationReview(page, "touch");
  const director = await waitForStation(page, "touch");
  const canvas = page.locator("[data-composer-canvas]");
  await expect(canvas).toHaveAttribute("data-transition-progress", "1.000");
  await expect(page.locator("[data-installation-button]")).toHaveCount(4);
  await expect(page.locator("[data-journey-control], [data-interaction-finish], [data-interaction-escape]")).toHaveCount(0);
  const entrance = await getMonitorTextureSamples(page, "interactive");
  expect(entrance.some((sample) => sample.activation > 0 && sample.activation < 0.95)).toBe(true);
  expect(entrance.at(-1)?.activation).toBeGreaterThan(0.99);
  await page.screenshot({ path: testInfo.outputPath("assembled.png") });
  for (const view of ["parts", "details", "image", "assembled"] as const) {
    const button = page.locator(`[data-installation-button='${view}']`);
    await expect(button).toHaveAttribute("data-table-fit", "true");
    await button.evaluate((element: HTMLElement) => {
      element.dataset.pressObserved = "false";
      const observer = new MutationObserver(() => {
        if (Number(element.dataset.pressProgress) > 0) {
          element.dataset.pressObserved = "true";
          observer.disconnect();
        }
      });
      observer.observe(element, { attributes: true, attributeFilter: ["data-press-progress"] });
    });
    await activateWithKeyboard(page, `[data-installation-button='${view}']`);
    await expect(canvas).toHaveAttribute("data-installation-view", view);
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(button).toHaveAttribute("data-press-observed", "true");
    await expect(canvas).toHaveAttribute("data-view-transition-progress", "1.000");
    await expect(button).toHaveAttribute("data-press-progress", "0.000");
    await page.screenshot({ path: testInfo.outputPath(`${view}.png`) });
  }
  // Change direction during a blend; the next blend starts from what was painted.
  await activateWithKeyboard(page, "[data-installation-button='details']");
  await activateWithKeyboard(page, "[data-installation-button='parts']");
  await expect(canvas).toHaveAttribute("data-view-transition-progress", "1.000");
  await clearMonitorTextureSamples(page);
  const distance = await root.evaluate((element: HTMLElement) => Number(element.dataset.cameraScrollDistance));
  const phase = narrativeScore.find((beat) => beat.id === "engagement")!;
  const current = await root.evaluate((element: HTMLElement) => Number(element.dataset.nativeProgress));
  await page.mouse.move(20, 450);
  await page.mouse.wheel(0, (phase.end + 0.01 - current) * distance);
  await expect(director).toHaveAttribute("data-active-station", "none");
  await expect(canvas).toHaveCount(0);
  const retained = await getMonitorTextureSamples(page, "interactive");
  expect(retained.length).toBeGreaterThan(2);
  expect(retained.every((sample) => sample.media === "interactive" && sample.activation > 0.99)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("touch-buttons-retained-forward.png") });
  await clearMonitorTextureSamples(page);
  const afterExit = await root.evaluate((element: HTMLElement) => Number(element.dataset.nativeProgress));
  await page.mouse.wheel(0, (phase.start - 0.004 - afterExit) * distance);
  await expect(director).toHaveAttribute("data-active-station", "none");
  await expect(canvas).toHaveCount(0);
  await expect.poll(async () => {
    const sample = (await getMonitorTextureSamples(page, "interactive")).at(-1);
    return sample?.media === "neutral" && sample.activation === 0;
  }).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("touch-reset-on-reverse.png") });
  await clearMonitorTextureSamples(page);
  await returnToStationForward(page, "touch");
  await expect(canvas).toHaveAttribute("data-installation-view", "assembled");
  await expect(canvas).toHaveAttribute("data-transition-progress", "1.000");
  const returnEntrance = await getMonitorTextureSamples(page, "interactive");
  expect(returnEntrance.some((sample) => sample.media === "interactive" && sample.activation > 0 && sample.activation < 0.95)).toBe(true);
  expect(returnEntrance.at(-1)?.activation).toBeGreaterThan(0.99);
  expect(requests.some((url) => /connected-experience|race-idle|screen-main-4x3|media\/services\/events/.test(url))).toBe(false);
  await page.keyboard.press("Escape");
  await expect(director).toHaveAttribute("data-active-station", "none");
});

test("keyboard arrival focuses a physical control, press returns and Escape restores navigation focus", async ({ page }) => {
  await page.goto("/en?intro=0&phase=activation", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-experience-root]")).toHaveAttribute("data-story-stage", "activation", { timeout: 80_000 });
  await page.keyboard.press("Tab");
  const previous = page.getByRole("navigation", { name: "Primary navigation" }).locator("a").first();
  await previous.focus();
  await seekStationReview(page, "touch");
  const director = await waitForStation(page, "touch");
  const first = page.locator("[data-installation-button='assembled']");
  await expect(first).toBeFocused();
  await page.keyboard.press("Tab");
  const parts = page.locator("[data-installation-button='parts']");
  await expect(parts).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-installation-view", "parts");
  await expect(parts).toHaveAttribute("data-press-progress", "0.000");
  const before = await page.evaluate(() => scrollY);
  await parts.evaluate((button: HTMLButtonElement) => button.blur());
  await page.keyboard.press("Escape");
  await expect(director).toHaveAttribute("data-active-station", "none");
  await expect(previous).toBeFocused();
  expect(Math.abs(await page.evaluate(() => scrollY) - before)).toBeLessThan(2);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("[data-semantic-fallback]")).toBeVisible();
  await expect(page.locator("[data-installation-button]")).toHaveCount(0);
  await expect(director).toHaveAttribute("data-scroll-locked", "false");
});

test("missing final artwork retains a matching hero-stage view and usable physical controls", async ({ page }) => {
  await page.route("**/media/hero/touch/image.webp", (route) => route.abort());
  await page.goto("/en?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "touch");
  const canvas = page.locator("[data-composer-canvas]");
  await activateWithKeyboard(page, "[data-installation-button='image']");
  await expect(canvas).toHaveAttribute("data-artwork-status", "missing");
  await expect(canvas).toHaveAttribute("data-installation-view", "image");
  await expect(canvas).toHaveAttribute("data-view-transition-progress", "1.000");
  const colors = await canvas.evaluate((element: HTMLCanvasElement) => {
    const pixels = element.getContext("2d")!.getImageData(0, 0, element.width, element.height).data;
    const distinct = new Set<number>();
    for (let index = 0; index < pixels.length; index += 64) distinct.add(pixels[index] * 65536 + pixels[index + 1] * 256 + pixels[index + 2]);
    return distinct.size;
  });
  expect(colors).toBeGreaterThan(100);
  await activateWithKeyboard(page, "[data-installation-button='details']");
  await expect(canvas).toHaveAttribute("data-artwork-status", "ready");
  await page.keyboard.press("Escape");
  await expect(director).toHaveAttribute("data-active-station", "none");
});

for (const locale of ["fa", "ar"] as const) {
  test(`${locale} mobile taps the aligned circles without duplicate controls or overflow`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({ viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true });
    try {
      const page = await context.newPage();
      await page.goto(`/${locale}?intro=0&phase=engagement`, { waitUntil: "domcontentloaded" });
      await waitForStation(page, "touch");
      await expect(page.locator("[data-installation-button='parts']")).toBeEnabled();
      await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-transition-progress", "1.000");
      const bounds = await page.locator("[data-installation-button]").evaluateAll((elements) => elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom,
          projectedX: Number((element as HTMLElement).dataset.projectedX), projectedY: Number((element as HTMLElement).dataset.projectedY) };
      }));
      for (const rect of bounds) {
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.right).toBeLessThanOrEqual(360);
        expect(rect.y).toBeGreaterThan(60);
        expect(rect.bottom).toBeLessThan(600);
        expect(Math.abs(rect.x + rect.width / 2 - rect.projectedX)).toBeLessThan(2);
        expect(Math.abs(rect.y + rect.height / 2 - rect.projectedY)).toBeLessThan(2);
      }
      for (let i = 1; i < bounds.length; i += 1) expect(bounds[i].x).toBeGreaterThan(bounds[i - 1].right);
      await page.locator("[data-installation-button='parts']").tap();
      await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-installation-view", "parts");
      await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-view-transition-progress", "1.000");
      await page.screenshot({ path: testInfo.outputPath(`touch-${locale}-mobile.png`) });
      await expect(page.locator("[data-journey-control], [data-interaction-escape]")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    } finally { await context.close(); }
  });
}
