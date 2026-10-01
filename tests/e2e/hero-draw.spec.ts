import { expect, test, type Page } from "@playwright/test";
import { activateWithKeyboard, waitForStation } from "./hero-interaction-helpers";

test.setTimeout(120_000);

async function openDrawing(page: Page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/en?intro=0&phase=connection", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "draw");
  const controls = page.locator("[data-drawing-spatial-controls]");
  await expect(page.locator("[data-drawing-canvas]")).toHaveAttribute("data-transition-progress", "1.000");
  return { director, controls };
}

async function drawOnScreen(page: Page, startX: number, startY: number, endX: number, endY: number) {
  // These points fall inside the live monitor at the authored 1280 × 720 connection camera.
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY);
  await page.mouse.up();
}

test("drawing wall accepts a scene stroke and finishes", async ({ page }) => {
  const { director, controls } = await openDrawing(page);
  await drawOnScreen(page, 550, 250, 750, 290);
  await expect(controls).toHaveAttribute("data-stroke-count", "1");
  await controls.locator("button:nth-of-type(3)").evaluate((button: HTMLButtonElement) => button.click());
  await expect(controls).toHaveAttribute("data-drawing-finished", "true");
  await expect(director).toHaveAttribute("data-lifecycle", "complete");
  await controls.locator("button:nth-of-type(3)").evaluate((button: HTMLButtonElement) => button.click());
  await expect(director).toHaveAttribute("data-active-station", "none", { timeout: 3_000 });
});

test("drawing wall undo and clear remove local strokes", async ({ page }) => {
  const { controls } = await openDrawing(page);
  await drawOnScreen(page, 570, 270, 740, 300);
  await expect(controls).toHaveAttribute("data-stroke-count", "1");
  await controls.locator("button:nth-of-type(1)").evaluate((button: HTMLButtonElement) => button.click());
  await expect(controls).toHaveAttribute("data-stroke-count", "0");
  await drawOnScreen(page, 560, 260, 745, 310);
  await expect(controls).toHaveAttribute("data-stroke-count", "1");
  await controls.locator("button:nth-of-type(2)").evaluate((button: HTMLButtonElement) => button.click());
  await expect(controls).toHaveAttribute("data-stroke-count", "0");
});

test("drawing wall can create and finish a mark entirely with the keyboard", async ({ page }) => {
  const { director, controls } = await openDrawing(page);
  const canvas = page.locator("[data-drawing-canvas]");
  await expect(canvas).toHaveAttribute("tabindex", "0");
  await expect(canvas).toHaveAccessibleName(/Space.*arrow keys/i);
  const before = await page.evaluate(() => window.scrollY);
  await canvas.focus();
  await expect(canvas).toBeFocused();
  await page.keyboard.press("Space");
  await expect(controls).toHaveAttribute("data-stroke-count", "1");
  for (const key of ["ArrowRight", "ArrowRight", "ArrowDown", "ArrowDown", "ArrowLeft"]) {
    await page.keyboard.press(key);
  }
  await page.keyboard.press("Space");
  await expect(controls).toHaveAttribute("data-stroke-count", "1");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(before);
  await activateWithKeyboard(page, "[data-drawing-spatial-controls] button:nth-of-type(3)");
  await expect(controls).toHaveAttribute("data-drawing-finished", "true");
  await expect(director).toHaveAttribute("data-lifecycle", "complete");
  await activateWithKeyboard(page, "[data-drawing-spatial-controls] button:nth-of-type(3)");
  await expect(director).toHaveAttribute("data-active-station", "none");
});

test("Finish traces a highlight without clearing the completed drawing", async ({ page }) => {
  const { controls } = await openDrawing(page);
  const canvas = page.locator("[data-drawing-canvas]");
  await canvas.focus();
  await page.keyboard.press("Space");
  for (let index = 0; index < 4; index += 1) await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");
  await expect(controls).toHaveAttribute("data-stroke-count", "1");

  const samples = await canvas.evaluate(async (element: HTMLCanvasElement) => {
    const context = element.getContext("2d")!;
    const button = element.parentElement!.querySelectorAll("button")[2];
    const values: number[] = [];
    button.click();
    const startedAt = performance.now();
    await new Promise<void>((resolve) => {
      const sample = () => {
        values.push(context.getImageData(element.width / 2 + 36, element.height / 2, 1, 1).data[0]);
        if (performance.now() - startedAt >= 850) resolve();
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    return values;
  });

  expect(samples.length).toBeGreaterThan(1);
  expect(Math.min(...samples)).toBeGreaterThan(180);
  await expect(controls).toHaveAttribute("data-drawing-finished", "true");
});

test("an immediate Continue fades controls into the retained drawing", async ({ page }) => {
  const { director } = await openDrawing(page);
  const canvas = page.locator("[data-drawing-canvas]");
  await canvas.focus();
  await page.keyboard.press("Space");
  for (let index = 0; index < 4; index += 1) await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");

  const handoff = await canvas.evaluate(async (element: HTMLCanvasElement) => {
    const context = element.getContext("2d")!;
    const button = element.parentElement!.querySelectorAll("button")[2];
    const values: number[] = [];
    button.click();
    button.click();
    await new Promise<void>((resolve) => {
      const sample = () => {
        values.push(context.getImageData(element.width / 2 + 36, element.height / 2, 1, 1).data[0]);
        if (!element.isConnected) resolve();
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    return {
      values,
      finalProgress: element.dataset.transitionProgress,
      background: [...context.getImageData(0, 0, 1, 1).data],
      artwork: [...context.getImageData(element.width / 2 + 36, element.height / 2, 1, 1).data],
    };
  });

  expect(Math.min(...handoff.values)).toBeGreaterThan(180);
  expect(handoff.finalProgress).toBe("0.000");
  expect(handoff.background).toEqual([9, 13, 18, 255]);
  expect(handoff.artwork).toEqual([231, 247, 255, 255]);
  await expect(director).toHaveAttribute("data-active-station", "none");
});
