import { expect, test } from "@playwright/test";
import { enterStationWithKeyboard } from "./hero-interaction-helpers";

for (const locale of ["fa", "en", "ar"] as const) {
  test(`${locale} interaction controls stay in the viewport`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/${locale}?intro=0&phase=connection`, { waitUntil: "networkidle" });
    await enterStationWithKeyboard(page, "draw");
    await expect(page.locator("[data-interaction-panel='draw']")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(2);
  });
}

test("reduced motion exposes an immediate fallback station", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/en?intro=0&phase=reveal", { waitUntil: "networkidle" });
  await expect(page.locator("[data-webgl='fallback']")).toBeVisible();
  await expect(page.locator("[data-interaction-hotspot='stage']")).toBeVisible();
  await context.close();
});

test("a touch input opens a station on a mobile viewport", async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    reducedMotion: "reduce",
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("/en?intro=0&phase=activation", { waitUntil: "networkidle" });
  const hotspot = page.locator("[data-interaction-hotspot='photo']");
  await expect(hotspot).toBeVisible();
  await hotspot.tap();
  await expect(page.locator("[data-interaction-panel='photo']")).toBeVisible();
  await context.close();
});
