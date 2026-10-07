import { expect, test } from "@playwright/test";
import { raceBoard } from "../../components/experience/interactions/race-game";
import { waitForStation } from "./hero-interaction-helpers";

test.setTimeout(120_000);
test.use({ video: "off", trace: "off" });

test("drag steers the car outside the screen, stays on the road and releases cleanly", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en?intro=0&phase=experiences", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "game");
  const canvas = page.locator("[data-game-canvas]");
  await expect(canvas).toHaveAttribute("data-transition-progress", "1.000");

  // Start and steering are one continuous mouse gesture on the authored screen.
  await page.mouse.move(720, 370);
  await page.mouse.down();
  await page.mouse.move(900, 370, { steps: 3 });
  await expect(canvas).toHaveAttribute("data-dragging", "true");
  await expect.poll(async () => Number(await canvas.getAttribute("data-car-x")))
    .toBe(raceBoard.right - 25);
  await page.mouse.move(540, 420, { steps: 3 });
  await expect.poll(async () => Number(await canvas.getAttribute("data-car-x")))
    .toBe(raceBoard.left + 25);
  await page.mouse.move(900, 600, { steps: 3 });
  await expect.poll(async () => Number(await canvas.getAttribute("data-car-x")))
    .toBe(raceBoard.right - 25);
  await page.mouse.up();
  await expect(canvas).toHaveAttribute("data-dragging", "false");
  await expect(canvas).toBeFocused();

  const releasedPaddle = await canvas.getAttribute("data-car-x");
  await page.mouse.move(620, 545, { steps: 3 });
  await expect(canvas).toHaveAttribute("data-car-x", releasedPaddle!);
  await page.keyboard.down("ArrowLeft");
  await expect.poll(async () => Number(await canvas.getAttribute("data-car-x")))
    .toBeLessThan(Number(releasedPaddle));
  await page.keyboard.up("ArrowLeft");
  await page.keyboard.press("Escape");
  await expect(director).toHaveAttribute("data-active-station", "none");
});

test("window blur releases mouse dragging and the next drag works", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en?intro=0&phase=experiences", { waitUntil: "domcontentloaded" });
  await waitForStation(page, "game");
  const canvas = page.locator("[data-game-canvas]");
  await expect(canvas).toHaveAttribute("data-transition-progress", "1.000");
  // Freeze traffic through the visitor's control while testing pointer
  // ownership; slow browser input must not turn this into a collision test.
  await page.locator("[data-game-action]").evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.locator("[data-game-spatial-controls]")).toHaveAttribute("data-game-status", "paused");
  await page.mouse.move(720, 545);
  await page.mouse.down();
  await page.mouse.move(620, 545, { steps: 3 });
  await expect(canvas).toHaveAttribute("data-dragging", "true");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(canvas).toHaveAttribute("data-dragging", "false");
  const releasedPaddle = await canvas.getAttribute("data-car-x");
  await page.mouse.move(800, 545, { steps: 3 });
  await page.mouse.up();
  await expect(canvas).toHaveAttribute("data-car-x", releasedPaddle!);

  await page.mouse.move(720, 545);
  await page.mouse.down();
  await page.mouse.move(780, 545, { steps: 3 });
  await page.mouse.up();
  await expect(canvas).toHaveAttribute("data-dragging", "false");
  await expect.poll(async () => Number(await canvas.getAttribute("data-car-x")))
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
    await expect.poll(async () => Number(await canvas.getAttribute("data-car-x")))
      .toBe(raceBoard.right - 25);
    // Releasing the ignored second touch must preserve the original captured drag.
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [outsideTouch] });
    await expect(canvas).toHaveAttribute("data-dragging", "true");
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...outsideTouch, x: 540 }] });
    await expect.poll(async () => Number(await canvas.getAttribute("data-car-x")))
      .toBe(raceBoard.left + 25);
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    activeTouch = false;
    await expect(canvas).toHaveAttribute("data-dragging", "false");
  } finally {
    if (activeTouch) await session.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] }).catch(() => {});
    await session.send("Emulation.setTouchEmulationEnabled", { enabled: false }).catch(() => {});
    await session.detach().catch(() => {});
  }
});
