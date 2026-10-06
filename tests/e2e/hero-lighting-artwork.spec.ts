import { expect, test } from "@playwright/test";
import { heroTimeline } from "../../components/experience/hero-timeline-config";
import { sceneTokens } from "../../components/experience/scene-config";

test.setTimeout(180_000);
test.use({ video: "off", trace: "off" });

test("scrolling lamps preserves the complete monitor artwork without dark rectangles", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/fa?intro=0&phase=reveal", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-loading-progress]")).toHaveAttribute("data-loading-progress", "100", { timeout: 90_000 });
  const root = page.locator("[data-experience-root]");
  const canvas = page.locator("[data-stage-scroll]");
  for (const [frame, lamps] of [
    [heroTimeline.cueFrames.lightingBeam1 + 8, 1],
    [heroTimeline.cueFrames.lightingBeam2 + 8, 2],
    [heroTimeline.cueFrames.lightingBeam5 + 8, 5],
    [heroTimeline.cueFrames.lightingBeam1 + 8, 1],
  ]) {
    const progress = (frame - heroTimeline.firstFrame) / (heroTimeline.lastFrame - heroTimeline.firstFrame);
    await root.evaluate((element, progress) => element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress, sync: true } })), progress);
    await expect(canvas).toHaveAttribute("data-lit-lamps", String(lamps));
    await expect.poll(() => canvas.evaluate(async (element: HTMLCanvasElement, src) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      const reference = document.createElement("canvas");
      reference.width = element.width;
      reference.height = element.height;
      const context = reference.getContext("2d")!;
      context.drawImage(image, 0, 0, reference.width, reference.height);
      const actual = element.getContext("2d")!;
      let largestDifference = 0;
      for (let column = 0; column < 5; column += 1) {
        const x = Math.floor(element.width * (column + .5) / 5);
        for (const row of [.45, .6, .8]) {
          const y = Math.floor(element.height * row);
          const expected = context.getImageData(x, y, 1, 1).data;
          const painted = actual.getImageData(x, y, 1, 1).data;
          for (let channel = 0; channel < 4; channel += 1) largestDifference = Math.max(largestDifference, Math.abs(expected[channel] - painted[channel]));
        }
      }
      return largestDifference;
    }, sceneTokens.bakedScene.screens.videoWall)).toBeLessThanOrEqual(1);
  }
  await page.screenshot({ path: testInfo.outputPath("lighting-unmasked.png") });
});
