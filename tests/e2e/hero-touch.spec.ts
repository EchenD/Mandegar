import { expect, test, type Page } from "@playwright/test";
import { narrativeScore } from "../../components/experience/narrative-score";
import { activateWithKeyboard, puzzleTiles, returnToStationForward, seekStationReview, solvePuzzle, swapPuzzleSlots, waitForStation } from "./hero-interaction-helpers";

test.setTimeout(180_000);
test.use({ video: "off", trace: "off" });

type TilePoint = { slot: number; piece: number; x: number; y: number; width: number; height: number; position: number[] };
type MonitorPoints = { slots: Array<{ slot: number; x: number; y: number }> };
const controlsSelector = "[data-touch-spatial-controls]";

async function tilePoints(page: Page) {
  return JSON.parse(await page.locator(controlsSelector).getAttribute("data-puzzle-object-centers") ?? "[]") as TilePoint[];
}

async function readyPuzzle(page: Page) {
  const director = await waitForStation(page, "touch");
  await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-transition-progress", "1.000", { timeout: 20_000 });
  await expect.poll(async () => (await tilePoints(page)).length).toBe(9);
  return director;
}

async function openPuzzle(page: Page) {
  await seekStationReview(page, "touch");
  return readyPuzzle(page);
}

async function seek(page: Page, phase: string) {
  const progress = narrativeScore.find((beat) => beat.id === phase)!.preview;
  await page.locator("[data-experience-root]").evaluate((root, value) => {
    root.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress: value, sync: true } }));
  }, progress);
}

async function reopenPuzzle(page: Page) {
  await returnToStationForward(page, "touch");
  return readyPuzzle(page);
}

async function assertPuzzlePreview(page: Page) {
  const preview = await puzzleTiles(page, true);
  const committed = await puzzleTiles(page);
  await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-puzzle-preview-tiles", JSON.stringify(preview));
  await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-puzzle-presentation", "story");
  await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-puzzle-correct-pieces", String(committed.filter((piece, slot) => piece === slot).length));
  await expect.poll(async () => (await tilePoints(page)).sort((first, second) => first.slot - second.slot).map((point) => point.piece)).toEqual(preview);
}

async function readableResult(page: Page) {
  const director = page.locator("[data-interaction-director]");
  await expect(director).toHaveAttribute("data-presentation", "result");
  // The result presentation starts before its 900 ms protected pause ends.
  // Check the actual camera/scroll lock, not just the lifecycle diagnostic.
  await expect(page.locator("[data-experience-root]")).not.toHaveAttribute("data-interaction-active", "touch");
  await expect(director).toHaveAttribute("data-scroll-locked", "false");
  await expect(page.locator("p[data-interaction-result]")).toBeVisible();
  await expect(page.locator("[data-interaction-replay]")).toHaveCount(0);
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

test("nine tabletop image tiles preview a mouse swap and commit only on release", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  await openPuzzle(page);
  const controls = page.locator(controlsSelector);
  await expect(controls).toHaveAttribute("data-puzzle-table-fit", "true");
  await expect(controls).toHaveAttribute("data-puzzle-artwork", "ready");
  const before = await puzzleTiles(page);
  expect([...before].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  expect(before).not.toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  await assertPuzzlePreview(page);
  await physicalDrag(page);
  const candidate = [...before];
  [candidate[0], candidate[1]] = [candidate[1], candidate[0]];
  await expect.poll(() => puzzleTiles(page, true)).toEqual(candidate);
  expect(await puzzleTiles(page)).toEqual(before);
  await expect(controls).toHaveAttribute("data-puzzle-moves", "0");
  await assertPuzzlePreview(page);
  await page.mouse.up();
  await expect.poll(() => puzzleTiles(page)).toEqual(candidate);
  await expect(controls).toHaveAttribute("data-puzzle-object-dragging", "none");
  await expect(controls).toHaveAttribute("data-puzzle-moves", "1");
  const path = testInfo.outputPath("puzzle-tabletop-desktop.png");
  await page.screenshot({ path });
  await testInfo.attach("nine physical image tiles", { path, contentType: "image/png" });
});

test("the story monitor is inert, right click does not play, and lost tabletop capture cancels a swap", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  const director = await openPuzzle(page);
  const controls = page.locator(controlsSelector);
  await expect(controls).toHaveAttribute("data-puzzle-artwork", "ready");
  await expect.poll(() => controls.getAttribute("data-puzzle-monitor-points")).not.toBeNull();
  const points = JSON.parse(await controls.getAttribute("data-puzzle-monitor-points") ?? "{}") as MonitorPoints;
  const slot = (index: number) => points.slots.find((point) => point.slot === index)!;
  const initial = await puzzleTiles(page);
  await page.mouse.click(slot(0).x, slot(0).y);
  await page.mouse.click(slot(1).x, slot(1).y);
  expect(await puzzleTiles(page)).toEqual(initial);
  await expect(controls).toHaveAttribute("data-puzzle-selected", "none");
  await expect(controls).toHaveAttribute("data-puzzle-moves", "0");
  await assertPuzzlePreview(page);
  await expect(page.locator("[data-puzzle-reset], [data-puzzle-close], [data-interaction-replay]")).toHaveCount(0);
  await expect(page.locator("[data-interaction-escape]")).toHaveCount(1);
  const path = testInfo.outputPath("puzzle-story-monitor-desktop.png");
  await page.screenshot({ path });
  await testInfo.attach("noninteractive story monitor", { path, contentType: "image/png" });
  const table = await tilePoints(page);
  await page.mouse.click(table[2].x, table[2].y, { button: "right" });
  expect(await puzzleTiles(page)).toEqual(initial);
  await expect(controls).toHaveAttribute("data-puzzle-selected", "none");
  await expect(controls).toHaveAttribute("data-puzzle-moves", "0");

  await physicalDrag(page, 2, 3);
  const candidate = [...initial];
  [candidate[2], candidate[3]] = [candidate[3], candidate[2]];
  await expect.poll(() => puzzleTiles(page, true)).toEqual(candidate);
  const webgl = page.locator("[data-experience-canvas='true'] canvas");
  await webgl.evaluate((canvas) => canvas.dispatchEvent(new PointerEvent("lostpointercapture", { pointerId: 77, bubbles: true })));
  await expect(controls).toHaveAttribute("data-puzzle-object-dragging", "2");
  await expect.poll(() => webgl.evaluate((canvas) => canvas.hasPointerCapture(1))).toBe(true);
  await webgl.evaluate((canvas) => canvas.releasePointerCapture(1));
  // Native capture loss is delivered when the browser processes the next pointer event.
  await page.mouse.move(table[3].x + 1, table[3].y);
  await expect(controls).toHaveAttribute("data-puzzle-object-dragging", "none");
  await page.mouse.up();
  await expect.poll(() => puzzleTiles(page, true)).toEqual(initial);
  expect(await puzzleTiles(page)).toEqual(initial);
  await expect(controls).toHaveAttribute("data-puzzle-moves", "0");

  const skip = await page.locator("[data-interaction-escape]").boundingBox();
  expect(skip).not.toBeNull();
  await page.mouse.move(skip!.x + skip!.width / 2, skip!.y + skip!.height / 2);
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
  await openPuzzle(page);
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

test("keyboard swaps solve exactly and a new forward visit starts an unsolved puzzle without Replay", async ({ page }) => {
  await page.goto("/en?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  const director = await openPuzzle(page);
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
  await expect(director).toHaveAttribute("data-completed-touch", "true");
  await expect(controls).toHaveAttribute("data-puzzle-solved", "true");
  expect(await puzzleTiles(page)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  await readableResult(page);
  await expect(page.locator("p[data-interaction-result]")).toContainText("Mandegar brings every part together into one experience.");
  await expect(page.locator("[data-interaction-replay]")).toHaveCount(0);
  await reopenPuzzle(page);
  await expect(controls).toHaveAttribute("data-puzzle-solved", "false");
  await expect(controls).toHaveAttribute("data-puzzle-moves", "0");
  await expect(director).toHaveAttribute("data-lifecycle", "active");
  const shuffled = await puzzleTiles(page);
  expect([...shuffled].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  expect(shuffled).not.toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  await activateWithKeyboard(page, "[data-interaction-escape]");
  await expect(director).toHaveAttribute("data-active-station", "none");
});

test("reverse scrolling does not open the puzzle and each fresh forward entry resets partial or solved progress", async ({ page }) => {
  await page.goto("/en?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  const director = await openPuzzle(page);
  const controls = page.locator(controlsSelector);
  await swapPuzzleSlots(page, 0, 1);
  const partial = await puzzleTiles(page);
  await page.keyboard.press("Escape");
  await expect(director).toHaveAttribute("data-active-station", "none");
  await seek(page, "discovery");
  await seek(page, "engagement");
  await expect(director).toHaveAttribute("data-active-station", "none");
  await reopenPuzzle(page);
  expect(await puzzleTiles(page)).not.toEqual(partial);
  await expect(controls).toHaveAttribute("data-puzzle-moves", "0");
  await expect(controls).toHaveAttribute("data-puzzle-solved", "false");
  await solvePuzzle(page);
  await expect(director).toHaveAttribute("data-completed-touch", "true");
  await readableResult(page);
  await seek(page, "discovery");
  await seek(page, "engagement");
  await expect(director).toHaveAttribute("data-active-station", "none");
  await expect(director).toHaveAttribute("data-completed-touch", "true");
  await expect(page.locator("[data-interaction-replay]")).toHaveCount(0);
  await reopenPuzzle(page);
  await expect(director).toHaveAttribute("data-completed-touch", "false");
  await expect(controls).toHaveAttribute("data-puzzle-solved", "false");
  await expect(controls).toHaveAttribute("data-puzzle-moves", "0");
});

for (const locale of ["fa", "ar"] as const) {
  test(`${locale} mobile taps and physical arrow directions share nine reachable RTL targets`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const page = await context.newPage();
    await page.goto(`/${locale}?intro=0&phase=engagement`, { waitUntil: "domcontentloaded" });
    const director = await openPuzzle(page);
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
    await assertPuzzlePreview(page);
    await solvePuzzle(page, "touch");
    await expect(director).toHaveAttribute("data-completed-touch", "true");
    await readableResult(page);
    const path = testInfo.outputPath(`${locale}-puzzle-mobile-solved.png`);
    await page.screenshot({ path, animations: "disabled" });
    await testInfo.attach(`${locale} solved puzzle`, { path, contentType: "image/png" });
    await expect(page.locator("[data-interaction-replay]")).toHaveCount(0);
    await context.close();
  });
}

test("a solved drag preview stays unfinished through cancel and completes only on release", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage();
  await page.goto("/en?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  const director = await openPuzzle(page);
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
    await assertPuzzlePreview(page);
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
  await expect(director).toHaveAttribute("data-completed-touch", "true");
  await readableResult(page);
  await context.close();
});

test("multiple touches and menu opening cancel previews, while reduced-motion restoration starts a fresh forward visit", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage();
  await page.goto("/fa?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  const director = await openPuzzle(page);
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
  expect(await puzzleTiles(page)).not.toEqual(before);
  await expect(controls).toHaveAttribute("data-puzzle-moves", "0");
  await expect(controls).toHaveAttribute("data-puzzle-solved", "false");
  await context.close();
});
