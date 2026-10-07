import { expect, test } from "@playwright/test";
import { narrativeScore } from "../../components/experience/narrative-score";
import { waitForStation } from "./hero-interaction-helpers";

test.setTimeout(180_000);
test.use({ video: "off", trace: "off" });

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const) {
  test(`Persian ${viewport.name} keeps the Touch caption and native chapter progress visible during interactions`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/fa?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
    const root = page.locator("[data-experience-root]");
    const rail = page.locator("[data-phase-rail]");
    await waitForStation(page, "touch");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    // Touch starts at the caption entrance, which may otherwise be held at
    // nearly zero authored scroll opacity while the visitor uses the buttons.
    const entranceCue = page.locator("[data-scene-copy='engagement']");
    await expect(entranceCue).toBeVisible();
    await expect(entranceCue).toHaveCSS("opacity", "1");
    await expect(entranceCue.locator("p")).toHaveCSS("opacity", "1");

    for (const [phaseId, station, canvasSelector] of [
      ["engagement", "touch", "[data-composer-canvas]"],
      ["experiences", "game", "[data-game-canvas]"],
      ["connection", "draw", "[data-drawing-canvas]"],
    ] as const) {
      const phase = narrativeScore.find((beat) => beat.id === phaseId)!;
      await root.evaluate((element, progress) => {
        element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress, sync: true } }));
      }, phase.start + 0.02);
      await waitForStation(page, station);
      await expect(page.locator(canvasSelector)).toHaveAttribute("data-transition-progress", "1.000");
      await expect(rail).toBeVisible();
      await expect(rail).toHaveAttribute("aria-hidden", "false");
      await expect(rail).toHaveAttribute("aria-valuenow", String(narrativeScore.findIndex((beat) => beat.id === phaseId) + 1));
      const railBounds = await rail.boundingBox();
      expect(railBounds).not.toBeNull();
      expect(railBounds!.y + railBounds!.height).toBeLessThanOrEqual(viewport.height);

      if (station === "touch") {
        const copyLayer = page.locator("[data-copy-layer]");
        const caption = page.locator("[data-scene-copy='engagement'] p");
        await expect(copyLayer).not.toHaveAttribute("aria-hidden", "true");
        expect(await copyLayer.evaluate((element: HTMLElement) => element.inert)).toBe(false);
        await expect.poll(() => copyLayer.evaluate((element) => Number(getComputedStyle(element).opacity))).toBe(1);
        await expect(caption).toBeVisible();
        await expect.poll(() => caption.evaluate((element) => Number(getComputedStyle(element).opacity))).toBe(1);
        const captionBounds = await caption.boundingBox();
        expect(captionBounds).not.toBeNull();
        expect(captionBounds!.y + captionBounds!.height).toBeLessThan(railBounds!.y);
      } else {
        const controlsBounds = await page.locator("[data-journey-control]").boundingBox();
        expect(controlsBounds).not.toBeNull();
        expect(controlsBounds!.y + controlsBounds!.height).toBeLessThan(railBounds!.y);
      }

      const progressBefore = await root.evaluate((element: HTMLElement) => Number(element.dataset.nativeProgress));
      await page.mouse.move(20, 20);
      await page.mouse.wheel(0, 80);
      await expect.poll(() => root.evaluate((element: HTMLElement) => Number(element.dataset.nativeProgress))).toBeGreaterThan(progressBefore);
      await expect(rail).toBeVisible();
      const trackedProgress = await root.evaluate((element: HTMLElement) => ({
        native: Number(element.dataset.nativeProgress),
        visual: Number(element.style.getPropertyValue("--scroll-progress")),
      }));
      expect(trackedProgress.visual).toBeCloseTo(trackedProgress.native, 3);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    }
  });
}
