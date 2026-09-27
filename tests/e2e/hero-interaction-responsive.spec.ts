import { expect, test } from "@playwright/test";
import { waitForStation } from "./hero-interaction-helpers";

test.setTimeout(120_000);

for (const locale of ["fa", "en", "ar"] as const) {
  test(`${locale} drawing step fits a mobile viewport`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/${locale}?intro=0&phase=connection`, { waitUntil: "domcontentloaded" });
    await waitForStation(page, "draw");
    await expect(page.locator("[data-drawing-spatial-controls]")).toBeAttached();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(2);
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-active-station", "none");
  });
}

test("reduced motion uses semantic fallback without opening a WebGL station", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/en?intro=0&phase=reveal", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-webgl='fallback']")).toBeVisible();
  await expect(page.locator("[data-semantic-fallback]")).toBeVisible();
  await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-active-station", "none");
  await context.close();
});

test("touch-capable mobile viewport opens the photo step automatically", async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("/en?intro=0&phase=activation", { waitUntil: "domcontentloaded" });
  await waitForStation(page, "photo");
  const root = page.locator("[data-experience-root]");
  await expect(root).toHaveAttribute("data-story-stage", "activation");
  const progress = await root.evaluate((element: HTMLElement) => ({
    native: Number(element.dataset.nativeProgress),
    narrative: Number(element.dataset.narrativeProgress),
  }));
  expect(Math.abs(progress.native - progress.narrative)).toBeLessThan(0.01);
  await expect(page.locator("[data-photo-spatial-controls]")).toBeAttached();
  await context.close();
});
