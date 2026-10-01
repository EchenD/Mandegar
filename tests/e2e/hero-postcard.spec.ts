import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { narrativeScore } from "../../components/experience/narrative-score";
import { activateWithKeyboard, waitForStation } from "./hero-interaction-helpers";

test.setTimeout(180_000);

async function savePostcard(page: Page) {
  const button = page.locator("[data-save-postcard]");
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  const pendingDownload = page.waitForEvent("download");
  await button.click();
  const download = await pendingDownload;
  expect(download.suggestedFilename()).toBe("mandegar-your-space.png");
  const path = await download.path();
  if (!path) throw new Error("Postcard download is unavailable");
  const png = await readFile(path);
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(800);
  return png;
}

async function luminousDrawingPixels(page: Page, png: Buffer) {
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Cannot inspect postcard pixels");
    context.drawImage(image, 0, 0);
    // Inspect the artwork area, excluding the title, footer and frame.
    const { data } = context.getImageData(80, 220, 1040, 450);
    let luminous = 0;
    for (let index = 0; index < data.length; index += 4) {
      if (data[index] > 150 && data[index + 1] > 190 && data[index + 2] > 200) luminous += 1;
    }
    return luminous;
  }, png.toString("base64"));
}

test("postcard combines chosen lights and artwork and survives reopening without edits", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/en?intro=0&phase=reveal", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "stage");
  await expect(page.locator("[data-stage-canvas]")).toHaveAttribute("data-transition-progress", "1.000");
  for (const beam of [1, 3]) {
    await activateWithKeyboard(page, `[data-stage-beam='${beam}']`);
  }
  await activateWithKeyboard(page, "[data-stage-finish]");
  await expect(director).toHaveAttribute("data-lifecycle", "complete");
  await expect(page.locator("[data-save-postcard]")).toBeHidden();
  await activateWithKeyboard(page, "[data-stage-spatial-controls] [data-interaction-continue]");
  await expect(director).toHaveAttribute("data-active-station", "none");
  const lightingPostcard = await savePostcard(page);

  const connection = narrativeScore.find((beat) => beat.id === "connection");
  if (!connection) throw new Error("Drawing checkpoint is missing");
  const root = page.locator("[data-experience-root]");
  await root.evaluate((element, progress) => {
    element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress, sync: true } }));
  }, connection.preview);
  await waitForStation(page, "draw");
  const controls = page.locator("[data-drawing-spatial-controls]");
  await expect(page.locator("[data-drawing-canvas]")).toHaveAttribute("data-transition-progress", "1.000");
  await page.mouse.move(550, 250);
  await page.mouse.down();
  await page.mouse.move(750, 290, { steps: 8 });
  await page.mouse.up();
  await expect(controls).toHaveAttribute("data-stroke-count", "1");
  await activateWithKeyboard(page, "[data-drawing-spatial-controls] button:nth-of-type(3)");
  await expect(director).toHaveAttribute("data-lifecycle", "complete");
  await activateWithKeyboard(page, "[data-drawing-spatial-controls] button:nth-of-type(3)");
  await expect(director).toHaveAttribute("data-active-station", "none");
  const artworkPostcard = await savePostcard(page);
  const before = await luminousDrawingPixels(page, lightingPostcard);
  const after = await luminousDrawingPixels(page, artworkPostcard);
  expect(after).toBeGreaterThan(before + 100);
  await testInfo.attach("visitor-postcard", { body: artworkPostcard, contentType: "image/png" });

  await root.evaluate((element, progress) => {
    element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress, sync: true } }));
  }, connection.preview);
  await expect(director).toHaveAttribute("data-available-station", "draw");
  await expect(director).toHaveAttribute("data-active-station", "none");
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("mandegar:interaction-request", {
      detail: { station: "draw", input: "keyboard" },
    }));
  });
  await waitForStation(page, "draw");
  await expect(page.locator("[data-save-postcard]")).toBeHidden();
  await expect(controls).toHaveAttribute("data-stroke-count", "0");
  await page.keyboard.press("Escape");
  await expect(director).toHaveAttribute("data-active-station", "none");
  const preservedPostcard = await savePostcard(page);
  expect(preservedPostcard.equals(artworkPostcard)).toBe(true);
});
