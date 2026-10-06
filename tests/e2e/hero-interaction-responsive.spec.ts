import { expect, test } from "@playwright/test";
import { waitForStation } from "./hero-interaction-helpers";

test.setTimeout(120_000);
test.use({ video: "off", trace: "off" });

for (const locale of ["fa", "ar"]) {
  for (const height of [600, 844]) {
    test(`${locale} installation controls and central Skip fit a ${height}px mobile viewport`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 390, height }, hasTouch: true, isMobile: true });
      const page = await context.newPage();
      await page.goto(`/${locale}?intro=0&phase=engagement`, { waitUntil: "domcontentloaded" });
      await waitForStation(page, "touch");
      await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-transition-progress", "1.000");
      const boxes = await page.locator("[data-installation-button]").evaluateAll((elements) => elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      }));
      expect(boxes).toHaveLength(4);
      for (const box of boxes) {
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(390);
        expect(box.y + box.height).toBeLessThanOrEqual(height);
      }
      const skip = await page.locator("[data-interaction-escape]").boundingBox();
      const lastRow = boxes.at(-1)!;
      expect(lastRow.y + lastRow.height).toBeLessThan(skip!.y);
      await page.locator("[data-installation-button='parts']").tap();
      await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-installation-view", "parts");
      await page.locator("[data-interaction-escape]").tap();
      await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-active-station", "none");
      await context.close();
    });
  }
}
