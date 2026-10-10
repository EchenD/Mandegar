import { expect, test } from "@playwright/test";
import { waitForStation } from "./hero-interaction-helpers";
import { installationViews } from "../../components/experience/interactions/installation-demo";

test.setTimeout(120_000);
test.use({ video: "off", trace: "off" });

for (const locale of ["fa", "ar"]) {
  for (const height of [600, 844]) {
    test(`${locale} installation controls stay separate and work by touch in a ${height}px mobile viewport`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 390, height }, hasTouch: true, isMobile: true });
      const page = await context.newPage();
      await page.goto(`/${locale}?intro=0&phase=engagement`, { waitUntil: "domcontentloaded" });
      await waitForStation(page, "touch");
      await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-transition-progress", "1.000");
      const boxes = await page.locator("[data-installation-button]").evaluateAll((elements) => elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
          projectedX: Number((element as HTMLElement).dataset.projectedX), projectedY: Number((element as HTMLElement).dataset.projectedY) };
      }));
      expect(boxes).toHaveLength(4);
      for (const box of boxes) {
        // Targets follow the physical circles horizontally and gain extra
        // vertical touch room so neighbouring buttons remain separate.
        expect(box.width).toBeGreaterThan(0);
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(Math.abs(box.x + box.width / 2 - box.projectedX)).toBeLessThan(2);
        expect(Math.abs(box.y + box.height / 2 - box.projectedY)).toBeLessThan(2);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(390);
        expect(box.y + box.height).toBeLessThanOrEqual(height);
      }
      for (let index = 1; index < boxes.length; index += 1) {
        expect(boxes[index].x).toBeGreaterThan(boxes[index - 1].x + boxes[index - 1].width);
      }
      await expect(page.locator("[data-journey-control], [data-interaction-escape]")).toHaveCount(0);
      for (const view of installationViews) {
        const button = page.locator(`[data-installation-button='${view}']`);
        await expect(button).toHaveAttribute("data-physical-enabled", "true");
        // The authored camera breathes, so projected targets keep moving.
        // Tap their current center instead of waiting for a stationary box.
        const bounds = await button.boundingBox();
        expect(bounds).not.toBeNull();
        await page.touchscreen.tap(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
        await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-installation-view", view);
      }
      await page.locator("[data-installation-button='parts']").focus();
      await page.keyboard.press("Enter");
      await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-installation-view", "parts");
      await page.keyboard.press("Escape");
      await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-active-station", "none");
      await context.close();
    });
  }
}
