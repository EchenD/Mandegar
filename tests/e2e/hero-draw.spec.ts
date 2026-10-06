import { expect, test, type Page } from "@playwright/test";
import { activateWithKeyboard, continueFromResult, waitForStation } from "./hero-interaction-helpers";

test.setTimeout(120_000);

async function openDrawing(page: Page, clockControlled = false) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/en?intro=0&phase=connection", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "draw");
  const controls = page.locator("[data-drawing-spatial-controls]");
  if (clockControlled) {
    await expect(page.locator("[data-drawing-canvas]")).toHaveAttribute("data-transition-progress", /^\d\.\d{3}$/, { timeout: 20_000 });
    await page.clock.runFor(750);
  }
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
  await activateWithKeyboard(page, "[data-drawing-finish]");
  await expect(director).toHaveAttribute("data-presentation", "result");
  await expect(controls).toHaveAttribute("data-drawing-finished", "true");
  await expect(controls).toHaveAttribute("data-stroke-count", "1");
  await expect(page.locator("p[data-interaction-result='draw']")).toBeVisible();
  await expect(page.locator("[data-interaction-replay], [data-interaction-escape]")).toHaveCount(0);
  await continueFromResult(page, "draw");
  await expect(page.locator("[data-drawing-canvas]")).toHaveCount(0);
});

test("drawing wall undo and clear remove local strokes", async ({ page }) => {
  const { controls } = await openDrawing(page);
  await drawOnScreen(page, 570, 270, 740, 300);
  await expect(controls).toHaveAttribute("data-stroke-count", "1");
  await activateWithKeyboard(page, "[data-drawing-spatial-controls] button:nth-of-type(1)");
  await expect(controls).toHaveAttribute("data-stroke-count", "0");
  await drawOnScreen(page, 560, 260, 745, 310);
  await expect(controls).toHaveAttribute("data-stroke-count", "1");
  await activateWithKeyboard(page, "[data-drawing-spatial-controls] button:nth-of-type(2)");
  await expect(controls).toHaveAttribute("data-stroke-count", "0");
});

test("drawing wall can create and finish a mark entirely with the keyboard", async ({ page }) => {
  await page.clock.install();
  const { director, controls } = await openDrawing(page, true);
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
  // Keep the result's reading interval open while runner roundtrips inspect it.
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await activateWithKeyboard(page, "[data-drawing-finish]");
  await page.clock.runFor(64);
  await expect(director).toHaveAttribute("data-presentation", "result");
  await expect(controls).toHaveAttribute("data-drawing-finished", "true");
  await expect(controls).toHaveAttribute("data-stroke-count", "1");
  await expect(page.locator("p[data-interaction-result='draw']")).toBeVisible();
  await expect(page.locator("[data-interaction-replay], [data-interaction-escape]")).toHaveCount(0);
});

test("Finish traces a highlight without clearing the completed drawing", async ({ page }) => {
  const { controls } = await openDrawing(page);
  const canvas = page.locator("[data-drawing-canvas]");
  await canvas.focus();
  await page.keyboard.press("Space");
  for (let index = 0; index < 4; index += 1) await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");
  await expect(controls).toHaveAttribute("data-stroke-count", "1");

  const capture = canvas.evaluate(async (element: HTMLCanvasElement) => {
    const context = element.getContext("2d")!;
    const values: number[] = [];
    const deadline = performance.now() + 5_000;
    let startedAt: number | null = null;
    await new Promise<void>((resolve) => {
      const sample = () => {
        if (element.parentElement?.dataset.drawingFinished === "true") {
          if (startedAt === null) startedAt = performance.now();
          values.push(context.getImageData(element.width / 2 + 36, element.height / 2, 1, 1).data[0]);
        }
        if ((startedAt !== null && performance.now() - startedAt >= 850) || performance.now() >= deadline) resolve();
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    return values;
  });
  await activateWithKeyboard(page, "[data-drawing-finish]");
  const samples = await capture;

  expect(samples.length).toBeGreaterThan(1);
  expect(Math.min(...samples)).toBeGreaterThan(180);
  await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-presentation", "result");
  await expect(controls).toHaveAttribute("data-drawing-finished", "true");
  await expect(page.locator("p[data-interaction-result='draw']")).toBeVisible();
  await expect(page.locator("[data-interaction-replay], [data-interaction-escape]")).toHaveCount(0);
});

test("the next onward scroll fades controls into the retained completed drawing", async ({ page }) => {
  const { director } = await openDrawing(page);
  const canvas = page.locator("[data-drawing-canvas]");
  await canvas.focus();
  await page.keyboard.press("Space");
  for (let index = 0; index < 4; index += 1) await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");

  await activateWithKeyboard(page, "[data-drawing-finish]");
  await expect(director).toHaveAttribute("data-presentation", "result");
  await expect(page.locator("[data-experience-root]")).not.toHaveAttribute("data-interaction-active", "draw");
  const capture = canvas.evaluate(async (element: HTMLCanvasElement) => {
    const context = element.getContext("2d")!;
    const values: number[] = [];
    const deadline = performance.now() + 8_000;
    element.dataset.drawingFadeObserverReady = "true";
    await new Promise<void>((resolve, reject) => {
      const sample = () => {
        values.push(context.getImageData(element.width / 2 + 36, element.height / 2, 1, 1).data[0]);
        if (!element.isConnected) resolve();
        else if (performance.now() >= deadline) reject(new Error("Onward scroll did not release the finished drawing."));
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
  await expect(canvas).toHaveAttribute("data-drawing-fade-observer-ready", "true");
  await page.mouse.wheel(0, 120);
  const handoff = await capture;

  expect(Math.min(...handoff.values)).toBeGreaterThan(180);
  expect(handoff.finalProgress).toBe("0.000");
  expect(handoff.background).toEqual([9, 13, 18, 255]);
  expect(handoff.artwork).toEqual([231, 247, 255, 255]);
  await expect(director).toHaveAttribute("data-active-station", "none");
});
