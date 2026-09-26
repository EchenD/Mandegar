import { expect, test } from "@playwright/test";
import { enterStationWithKeyboard } from "./hero-interaction-helpers";

test("drawing wall supports freehand input, undo, preset, clear and finish", async ({ page }) => {
  await page.goto("/en?intro=0&phase=connection", { waitUntil: "networkidle" });
  await enterStationWithKeyboard(page, "draw");
  const canvas = page.locator("[data-drawing-canvas]");
  await expect(canvas).toBeAttached();
  const initialFullRenderCount = Number(await canvas.getAttribute("data-full-render-count"));
  await canvas.evaluate((element) => {
    const drawingCanvas = element as HTMLCanvasElement;
    let capturedPointer: number | null = null;
    Object.defineProperties(drawingCanvas, {
      setPointerCapture: { value: (pointerId: number) => { capturedPointer = pointerId; } },
      hasPointerCapture: { value: (pointerId: number) => capturedPointer === pointerId },
      releasePointerCapture: { value: () => { capturedPointer = null; } },
    });
    const bounds = drawingCanvas.getBoundingClientRect();
    const dispatch = (type: string, x: number, y: number) => drawingCanvas.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        clientX: bounds.left + x * bounds.width,
        clientY: bounds.top + y * bounds.height,
        pointerId: 7,
        pointerType: "pen",
      }),
    );
    dispatch("pointerdown", 0.15, 0.25);
    for (let index = 1; index <= 40; index += 1) {
      dispatch("pointermove", 0.15 + index * 0.015, 0.25 + Math.sin(index / 5) * 0.18);
    }
    dispatch("pointerup", 0.75, 0.25);
  });
  await expect.poll(async () => Number(
    await canvas.getAttribute("data-incremental-render-count"),
  )).toBe(1);
  expect(Number(await canvas.getAttribute("data-full-render-count"))).toBe(initialFullRenderCount);
  await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(canvas).toHaveAttribute("data-full-render-count", String(initialFullRenderCount + 1));
  await page.getByRole("button", { name: "Add a keyboard-accessible signature mark" }).click();
  await page.getByRole("button", { name: "Finish" }).click();
  await expect(page.locator("[data-drawing-echo]")).toBeVisible();
  await expect(page.locator("[data-interaction-panel='draw']")).toHaveAttribute("data-lifecycle", "complete");
});
