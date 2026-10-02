import { expect, test, type Page } from "@playwright/test";
import { narrativeScore } from "../../components/experience/narrative-score";
import { activateWithKeyboard, puzzleTiles, solvePuzzle, swapPuzzleSlots, waitForStation } from "./hero-interaction-helpers";

test.setTimeout(180_000);
test.use({ video: "off", trace: "off" });

type TilePoint = { slot: number; piece: number; x: number; y: number; width: number; height: number; position: number[] };
type MonitorPoints = { slots: Array<{ slot: number; x: number; y: number }>; controls: Record<"reset" | "close" | "continue", { x: number; y: number }> };
const controlsSelector = "[data-touch-spatial-controls]";

async function tilePoints(page: Page) {
  return JSON.parse(await page.locator(controlsSelector).getAttribute("data-puzzle-object-centers") ?? "[]") as TilePoint[];
}

async function readyPuzzle(page: Page) {
  const director = await waitForStation(page, "touch");
  await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-transition-progress", "1.000");
  await expect.poll(async () => (await tilePoints(page)).length).toBe(9);
  return director;
}

async function seek(page: Page, phase: string) {
  const progress = narrativeScore.find((beat) => beat.id === phase)!.preview;
  await page.locator("[data-experience-root]").evaluate((root, value) => {
    root.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress: value, sync: true } }));
  }, progress);
}

async function reopenPuzzle(page: Page) {
  await seek(page, "engagement");
  await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-available-station", "touch");
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mandegar:interaction-request", {
    detail: { station: "touch", input: "keyboard" },
  })));
  return readyPuzzle(page);
}

async function assertSceneAndMonitor(page: Page) {
  const preview = await puzzleTiles(page, true);
  await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-puzzle-preview-tiles", JSON.stringify(preview));
  await expect.poll(async () => (await tilePoints(page)).sort((first, second) => first.slot - second.slot).map((point) => point.piece)).toEqual(preview);
}

async function physicalDrag(page: Page, first = 0, second = 1) {
  const points = await tilePoints(page);
  const source = points.find((point) => point.slot === first)!;
  const target = points.find((point) => point.slot === second)!;
  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 8 });
  await expect(page.locator(controlsSelector)).toHaveAttribute("data-puzzle-object-dragging", String(first));
}

test("nine tabletop image tiles preview and commit the same mouse swap as the monitor", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  await readyPuzzle(page);
  const controls = page.locator(controlsSelector);
  const canvas = page.locator("[data-composer-canvas]");
  await expect(controls).toHaveAttribute("data-puzzle-table-fit", "true");
  await expect(controls).toHaveAttribute("data-puzzle-artwork", "ready");
  const before = await puzzleTiles(page);
  expect([...before].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  expect(before).not.toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  await assertSceneAndMonitor(page);
  const paintedBefore = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL());
  await physicalDrag(page);
  const candidate = [...before];
  [candidate[0], candidate[1]] = [candidate[1], candidate[0]];
  await expect.poll(() => puzzleTiles(page, true)).toEqual(candidate);
  expect(await puzzleTiles(page)).toEqual(before);
  await expect(controls).toHaveAttribute("data-puzzle-moves", "0");
  await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())).not.toBe(paintedBefore);
  await assertSceneAndMonitor(page);
  await page.mouse.up();
  await expect.poll(() => puzzleTiles(page)).toEqual(candidate);
  await expect(controls).toHaveAttribute("data-puzzle-object-dragging", "none");
  await expect(controls).toHaveAttribute("data-puzzle-moves", "1");
  const path = testInfo.outputPath("puzzle-tabletop-desktop.png");
  await page.screenshot({ path });
  await testInfo.attach("nine physical image tiles", { path, contentType: "image/png" });
});

test("native monitor taps commit once, right click is inert, lost capture cancels and held Close waits for release", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  const director = await readyPuzzle(page);
  const controls = page.locator(controlsSelector);
  await expect(controls).toHaveAttribute("data-puzzle-artwork", "ready");
  await expect.poll(() => controls.getAttribute("data-puzzle-monitor-points")).not.toBeNull();
  const points = JSON.parse(await controls.getAttribute("data-puzzle-monitor-points") ?? "{}") as MonitorPoints;
  const slot = (index: number) => points.slots.find((point) => point.slot === index)!;
  const initial = await puzzleTiles(page);
  await page.mouse.click(slot(0).x, slot(0).y);
  await expect(controls).toHaveAttribute("data-puzzle-selected", "0");
  await expect(controls).toHaveAttribute("data-puzzle-moves", "0");
  await page.mouse.click(slot(1).x, slot(1).y);
  const committed = [...initial];
  [committed[0], committed[1]] = [committed[1], committed[0]];
  await expect.poll(() => puzzleTiles(page)).toEqual(committed);
  await expect(controls).toHaveAttribute("data-puzzle-selected", "none");
  await expect(controls).toHaveAttribute("data-puzzle-moves", "1");
  await assertSceneAndMonitor(page);
  await page.waitForTimeout(250);
  const path = testInfo.outputPath("puzzle-monitor-desktop-native.png");
  await page.screenshot({ path });
  await testInfo.attach("native monitor swap", { path, contentType: "image/png" });
  await page.mouse.click(slot(2).x, slot(2).y, { button: "right" });
  expect(await puzzleTiles(page)).toEqual(committed);
  await expect(controls).toHaveAttribute("data-puzzle-selected", "none");
  await expect(controls).toHaveAttribute("data-puzzle-moves", "1");

  await page.mouse.move(slot(2).x, slot(2).y);
  await page.mouse.down();
  await page.mouse.move(slot(3).x, slot(3).y, { steps: 7 });
  const candidate = [...committed];
  [candidate[2], candidate[3]] = [candidate[3], candidate[2]];
  await expect.poll(() => puzzleTiles(page, true)).toEqual(candidate);
  const webgl = page.locator("[data-experience-canvas='true'] canvas");
  await webgl.evaluate((canvas) => canvas.dispatchEvent(new PointerEvent("lostpointercapture", { pointerId: 77, bubbles: true })));
  await expect(controls).toHaveAttribute("data-puzzle-object-dragging", "2");
  await expect.poll(() => webgl.evaluate((canvas) => canvas.hasPointerCapture(1))).toBe(true);
  await webgl.evaluate((canvas) => canvas.releasePointerCapture(1));
  // Native capture loss is delivered when the browser processes the next pointer event.
  await page.mouse.move(slot(3).x + 1, slot(3).y);
  await expect(controls).toHaveAttribute("data-puzzle-object-dragging", "none");
  await page.mouse.up();
  await expect.poll(() => puzzleTiles(page, true)).toEqual(committed);
  expect(await puzzleTiles(page)).toEqual(committed);
  await expect(controls).toHaveAttribute("data-puzzle-moves", "1");

  await page.mouse.move(points.controls.close.x, points.controls.close.y);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await expect(director).toHaveAttribute("data-active-station", "touch");
  await page.mouse.up();
  await expect(director).toHaveAttribute("data-active-station", "none");
  await expect(director).toHaveAttribute("data-scroll-locked", "false");
  await page.waitForTimeout(700);
  await expect(director).toHaveAttribute("data-active-station", "none");
});

test("off-board release, wrong pointer and blur preserve the committed tabletop arrangement", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  await readyPuzzle(page);
  const controls = page.locator(controlsSelector);
  const before = await puzzleTiles(page);
  await physicalDrag(page);
  await page.locator("[data-experience-canvas='true'] canvas").evaluate((canvas) => {
    canvas.dispatchEvent(new PointerEvent("pointerup", { pointerId: 77, clientX: 20, clientY: 400, bubbles: true }));
    canvas.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 77, bubbles: true }));
  });
  await expect(controls).toHaveAttribute("data-puzzle-object-dragging", "0");
  await page.mouse.move(20, 500, { steps: 4 });
  await page.mouse.up();
  await expect(controls).toHaveAttribute("data-puzzle-object-dragging", "none");
  expect(await puzzleTiles(page)).toEqual(before);
  await physicalDrag(page);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(controls).toHaveAttribute("data-puzzle-object-dragging", "none");
  await page.mouse.up();
  expect(await puzzleTiles(page)).toEqual(before);
  await expect(controls).toHaveAttribute("data-puzzle-moves", "0");
});

test("keyboard swaps solve exactly and Reset restores an unsolved active lifecycle", async ({ page }) => {
  await page.goto("/en?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  const director = await readyPuzzle(page);
  const controls = page.locator(controlsSelector);
  await page.locator("[data-puzzle-slot='0']").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("[data-puzzle-slot='1']")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("[data-puzzle-slot='4']")).toBeFocused();
  await page.keyboard.press("Space");
  await expect(controls).toHaveAttribute("data-puzzle-selected", "4");
  await page.keyboard.press("Space");
  await expect(controls).toHaveAttribute("data-puzzle-selected", "none");
  await solvePuzzle(page);
  await expect(controls).toHaveAttribute("data-puzzle-solved", "true");
  await expect(director).toHaveAttribute("data-lifecycle", "complete");
  expect(await puzzleTiles(page)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  await activateWithKeyboard(page, "[data-puzzle-reset]");
  await expect(controls).toHaveAttribute("data-puzzle-solved", "false");
  await expect(controls).toHaveAttribute("data-puzzle-moves", "0");
  await expect(director).toHaveAttribute("data-lifecycle", "active");
  const shuffled = await puzzleTiles(page);
  expect([...shuffled].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  expect(shuffled).not.toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  await activateWithKeyboard(page, "[data-interaction-escape]");
  await expect(director).toHaveAttribute("data-active-station", "none");
});

test("partial and solved progress survives reverse scrolling, reopening and Continue", async ({ page }) => {
  await page.goto("/en?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  const director = await readyPuzzle(page);
  const controls = page.locator(controlsSelector);
  await swapPuzzleSlots(page, 0, 1);
  const partial = await puzzleTiles(page);
  await page.keyboard.press("Escape");
  await expect(director).toHaveAttribute("data-active-station", "none");
  await seek(page, "discovery");
  await seek(page, "engagement");
  await expect(director).toHaveAttribute("data-active-station", "none");
  await reopenPuzzle(page);
  expect(await puzzleTiles(page)).toEqual(partial);
  await expect(controls).toHaveAttribute("data-puzzle-moves", "1");
  await solvePuzzle(page);
  const solvedMoves = await controls.getAttribute("data-puzzle-moves");
  await expect(director).toHaveAttribute("data-lifecycle", "complete");
  await activateWithKeyboard(page, "[data-touch-spatial-controls] [data-interaction-continue]");
  await expect(director).toHaveAttribute("data-active-station", "none");
  await seek(page, "discovery");
  await reopenPuzzle(page);
  expect(await puzzleTiles(page)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  await expect(controls).toHaveAttribute("data-puzzle-moves", solvedMoves!);
  await expect(director).toHaveAttribute("data-lifecycle", "complete");
  await assertSceneAndMonitor(page);
});

for (const locale of ["fa", "ar"] as const) {
  test(`${locale} mobile taps and physical arrow directions share nine reachable RTL targets`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const page = await context.newPage();
    await page.goto(`/${locale}?intro=0&phase=engagement`, { waitUntil: "domcontentloaded" });
    const director = await readyPuzzle(page);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const slots = page.locator("[data-puzzle-slot]");
    await expect(slots).toHaveCount(9);
    const boxes = await slots.evaluateAll((buttons) => buttons.map((button) => {
      const box = button.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    }));
    for (const box of boxes) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
      expect(box.y + box.height).toBeLessThanOrEqual(844);
    }
    expect(boxes[0].x).toBeLessThan(boxes[1].x);
    expect(boxes[1].x).toBeLessThan(boxes[2].x);
    expect(boxes[0].y).toBeLessThan(boxes[3].y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(2);
    await page.locator("[data-puzzle-slot='0']").focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("[data-puzzle-slot='1']")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.locator("[data-puzzle-slot='4']")).toBeFocused();
    await swapPuzzleSlots(page, 0, 1, "touch");
    await assertSceneAndMonitor(page);
    await solvePuzzle(page, "touch");
    await expect(director).toHaveAttribute("data-lifecycle", "complete");
    const path = testInfo.outputPath(`${locale}-puzzle-mobile-solved.png`);
    await page.screenshot({ path, animations: "disabled" });
    await testInfo.attach(`${locale} solved puzzle`, { path, contentType: "image/png" });
    await page.locator("[data-mobile-interaction-skip]").tap();
    await expect(director).toHaveAttribute("data-active-station", "none");
    await context.close();
  });
}

test("a solved drag preview stays unfinished through cancel and completes only on release", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage();
  await page.goto("/en?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  const director = await readyPuzzle(page);
  const controls = page.locator(controlsSelector);
  const final = await solvePuzzle(page, "touch", true);
  if (!final) throw new Error("An unsolved shuffle must have a final swap");
  const before = await puzzleTiles(page);
  const boxes = await Promise.all([final.first, final.second].map((slot) => page.locator(`[data-puzzle-slot='${slot}']`).boundingBox()));
  const source = { x: boxes[0]!.x + boxes[0]!.width / 2, y: boxes[0]!.y + boxes[0]!.height / 2 };
  const target = { x: boxes[1]!.x + boxes[1]!.width / 2, y: boxes[1]!.y + boxes[1]!.height / 2 };
  const begin = async () => {
    await page.mouse.move(source.x, source.y);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 6 });
    await expect.poll(() => puzzleTiles(page, true)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    await assertSceneAndMonitor(page);
    expect(await puzzleTiles(page)).toEqual(before);
    await expect(controls).toHaveAttribute("data-puzzle-solved", "false");
    await expect(director).toHaveAttribute("data-lifecycle", "active");
  };
  await begin();
  await page.locator(`[data-puzzle-slot='${final.first}']`).dispatchEvent("pointercancel", { pointerId: 1, pointerType: "mouse" });
  await page.mouse.up();
  await expect.poll(() => puzzleTiles(page, true)).toEqual(before);
  await begin();
  await page.mouse.up();
  await expect(controls).toHaveAttribute("data-puzzle-solved", "true");
  await expect(director).toHaveAttribute("data-lifecycle", "complete");
  await context.close();
});

test("multiple touches, menu opening and reduced-motion teardown preserve committed progress", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage();
  await page.goto("/fa?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  const director = await readyPuzzle(page);
  const controls = page.locator(controlsSelector);
  await swapPuzzleSlots(page, 0, 1, "touch");
  const before = await puzzleTiles(page);
  const first = page.locator("[data-puzzle-slot='0']");
  const second = page.locator("[data-puzzle-slot='1']");
  const firstBox = (await first.boundingBox())!;
  const secondBox = (await second.boundingBox())!;
  const point = { x: firstBox.x + firstBox.width / 2, y: firstBox.y + firstBox.height / 2 };
  const target = { x: secondBox.x + secondBox.width / 2, y: secondBox.y + secondBox.height / 2 };
  const touch = await context.newCDPSession(page);
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...point, id: 41 }] });
  await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...target, id: 41 }] });
  await expect(controls).toHaveAttribute("data-puzzle-object-dragging", "0");
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...target, id: 41 }, { ...point, id: 42 }] });
  await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...target, id: 41 }] });
  await expect(controls).toHaveAttribute("data-puzzle-object-dragging", "0");
  expect(await puzzleTiles(page)).toEqual(before);
  await touch.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  await expect(controls).toHaveAttribute("data-puzzle-object-dragging", "none");
  await touch.detach();
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 5 });
  expect(await puzzleTiles(page)).toEqual(before);
  await expect(controls).toHaveAttribute("data-puzzle-object-dragging", "0");
  await page.locator("header button[aria-controls='primary-navigation']").evaluate((button: HTMLButtonElement) => button.click());
  await expect(controls).toHaveAttribute("data-puzzle-object-dragging", "none");
  await page.mouse.up();
  expect(await puzzleTiles(page)).toEqual(before);
  await page.locator("header button[aria-controls='primary-navigation']").click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("[data-semantic-fallback]")).toBeVisible();
  await expect(director).toHaveAttribute("data-active-station", "none");
  await expect(director).toHaveAttribute("data-scroll-locked", "false");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(director).toHaveAttribute("data-runtime", /adaptive|full/, { timeout: 60_000 });
  await reopenPuzzle(page);
  expect(await puzzleTiles(page)).toEqual(before);
  await expect(controls).toHaveAttribute("data-puzzle-moves", "1");
  await context.close();
});
