import { expect, test } from "@playwright/test";
import { narrativeScore } from "../../components/experience/narrative-score";
import { activateWithKeyboard, waitForStation } from "./hero-interaction-helpers";

test.setTimeout(180_000);

type ComposerPropPoint = { id: string; x: number; y: number; width: number; height: number; position: number[]; pose: { x: number; y: number } };

async function composerPropPoints(page: import("@playwright/test").Page) {
  return JSON.parse(await page.locator("[data-touch-spatial-controls]").getAttribute("data-composer-object-centers") ?? "[]") as ComposerPropPoint[];
}

test("physical composer props update the monitor during dragging and preserve settled choices on blur", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  await waitForStation(page, "touch");
  const controls = page.locator("[data-touch-spatial-controls]");
  const canvas = page.locator("[data-composer-canvas]");
  await expect(canvas).toHaveAttribute("data-transition-progress", "1.000");
  await expect(controls).toHaveAttribute("data-composer-objects-visible", "true");
  await expect.poll(async () => (await composerPropPoints(page)).length).toBe(3);
  const initial = (await composerPropPoints(page))[0];
  const before = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL());
  await page.mouse.move(initial.x, initial.y);
  await page.mouse.down();
  await page.mouse.move(initial.x + 32, initial.y - 35, { steps: 3 });
  await expect(controls).toHaveAttribute("data-composer-object-dragging", "space");
  await expect(controls).toHaveAttribute("data-touch-selected-count", "0");
  await expect.poll(async () => (await composerPropPoints(page))[0].position).not.toEqual(initial.position);
  await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())).not.toBe(before);
  await page.mouse.up();
  await expect(controls).toHaveAttribute("data-touch-selected-count", "1");
  await expect(page.locator("[data-touch-element='space']")).toBeFocused();
  const settled = (await composerPropPoints(page))[0].pose;
  await page.keyboard.press("ArrowLeft");
  await expect.poll(async () => (await composerPropPoints(page))[0].pose.x).toBeLessThan(settled.x);
  const current = (await composerPropPoints(page))[0];
  await page.mouse.move(current.x, current.y);
  await page.mouse.down();
  await page.mouse.move(current.x - 40, current.y - 20, { steps: 3 });
  await expect(controls).toHaveAttribute("data-composer-object-dragging", "space");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(controls).toHaveAttribute("data-composer-object-dragging", "none");
  await expect.poll(async () => (await composerPropPoints(page))[0].pose).toEqual(current.pose);
  await page.mouse.up();
  await expect(controls).toHaveAttribute("data-touch-selected-count", "1");
  const path = testInfo.outputPath("composer-physical-props.png");
  await page.screenshot({ path });
  await testInfo.attach("composer physical props", { path, contentType: "image/png" });
});

test("Persian mobile taps manipulate the same physical props and keyboard-adjusted arrangement survives reopening", async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage();
  await page.goto("/fa?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "touch");
  const controls = page.locator("[data-touch-spatial-controls]");
  await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-transition-progress", "1.000");
  await expect(controls).toHaveAttribute("data-composer-objects-visible", "true");
  await expect.poll(async () => (await composerPropPoints(page)).length).toBe(3);
  for (let index = 0; index < 3; index += 1) {
    const point = (await composerPropPoints(page))[index];
    expect(point.width).toBeGreaterThanOrEqual(44);
    expect(point.height).toBeGreaterThanOrEqual(44);
    expect(point.x).toBeGreaterThan(22);
    expect(point.x).toBeLessThan(368);
    await page.touchscreen.tap(point.x, point.y);
    await expect(controls).toHaveAttribute("data-touch-selected-count", String(index + 1));
  }
  await expect(director).toHaveAttribute("data-lifecycle", "complete");
  await page.locator("[data-touch-element='story']").focus();
  await page.keyboard.press("ArrowUp");
  const arranged = (await composerPropPoints(page))[1].pose;
  const path = testInfo.outputPath("fa-composer-physical-props.png");
  await page.screenshot({ path });
  await testInfo.attach("Persian composer physical props", { path, contentType: "image/png" });
  await page.locator("[data-mobile-interaction-skip]").tap();
  await expect(director).toHaveAttribute("data-active-station", "none");
  const progress = narrativeScore.find((beat) => beat.id === "engagement")!.preview;
  await page.locator("[data-experience-root]").evaluate((element, value) => element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress: value, sync: true } })), progress);
  await expect(director).toHaveAttribute("data-available-station", "touch");
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mandegar:interaction-request", { detail: { station: "touch", input: "keyboard" } })));
  await waitForStation(page, "touch");
  await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-transition-progress", "1.000");
  await expect.poll(async () => (await composerPropPoints(page))[1].pose).toEqual(arranged);
  await expect(controls).toHaveAttribute("data-touch-selected-count", "3");
  await context.close();
});

test("touch composer resets and completes its three-part composition", async ({ page }) => {
  await page.goto("/en?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "touch");
  const controls = page.locator("[data-touch-spatial-controls]");
  const canvas = page.locator("[data-composer-canvas]");
  await expect(canvas).toHaveAttribute("data-transition-progress", "1.000");

  await activateWithKeyboard(page, "[data-touch-element='space']");
  await activateWithKeyboard(page, "[data-touch-element='story']");
  await expect(controls).toHaveAttribute("data-touch-selected-count", "2");
  await page.evaluate(() => {
    window.dispatchEvent(new Event("blur"));
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
  });
  await expect(controls).toHaveAttribute("data-touch-selected-count", "2");
  await activateWithKeyboard(page, "[data-touch-spatial-controls] button:nth-last-of-type(3)");
  await expect(controls).toHaveAttribute("data-touch-selected-count", "0");

  for (const element of ["space", "story", "people"]) {
    await activateWithKeyboard(page, `[data-touch-element='${element}']`);
  }
  await expect(controls).toHaveAttribute("data-touch-complete", "true");
  await expect(director).toHaveAttribute("data-lifecycle", "complete");
  await activateWithKeyboard(page, "[data-touch-spatial-controls] button:nth-last-of-type(2)");
  await expect(director).toHaveAttribute("data-active-station", "none", { timeout: 3_000 });
});

test("reopening the monitor preserves partial and completed choices until Reset", async ({ page }) => {
  await page.goto("/en?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "touch");
  const controls = page.locator("[data-touch-spatial-controls]");
  await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-transition-progress", "1.000");
  await activateWithKeyboard(page, "[data-touch-element='space']");
  await page.keyboard.press("Escape");
  await expect(director).toHaveAttribute("data-active-station", "none");

  const progress = narrativeScore.find((beat) => beat.id === "engagement")!.preview;
  const reopen = async () => {
    await page.locator("[data-experience-root]").evaluate((element, value) => {
      element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress: value, sync: true } }));
    }, progress);
    await expect(director).toHaveAttribute("data-available-station", "touch");
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("mandegar:interaction-request", {
        detail: { station: "touch", input: "keyboard" },
      }));
    });
    await waitForStation(page, "touch");
    await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-transition-progress", "1.000");
  };

  await reopen();
  await expect(controls).toHaveAttribute("data-touch-selected-count", "1");
  await expect(page.locator("[data-touch-element='space']")).toHaveAttribute("aria-pressed", "true");
  await activateWithKeyboard(page, "[data-touch-element='story']");
  await expect(controls).toHaveAttribute("data-touch-selected-count", "2");
  await activateWithKeyboard(page, "[data-touch-element='people']");
  await expect(director).toHaveAttribute("data-lifecycle", "complete");
  await activateWithKeyboard(page, "[data-touch-spatial-controls] [data-interaction-continue]");
  await expect(director).toHaveAttribute("data-active-station", "none");

  await reopen();
  await expect(controls).toHaveAttribute("data-touch-selected-count", "3");
  await expect(director).toHaveAttribute("data-lifecycle", "complete");
  await activateWithKeyboard(page, "[data-touch-spatial-controls] button:nth-last-of-type(3)");
  await expect(controls).toHaveAttribute("data-touch-selected-count", "0");
  await expect(director).toHaveAttribute("data-lifecycle", "active");
});
