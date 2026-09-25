import { expect, type Page } from "@playwright/test";

export async function getStationPoint(page: Page, station: string) {
  const hotspot = page.locator(`[data-interaction-hotspot='${station}']`);
  await expect(hotspot).toBeAttached();
  return hotspot.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      x: Number.parseFloat(style.left),
      y: Number.parseFloat(style.top),
    };
  });
}

export async function enterStationWithKeyboard(page: Page, station: string) {
  const hotspot = page.locator(`[data-interaction-hotspot='${station}']`);
  await expect(hotspot).toBeAttached();
  await hotspot.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(`[data-interaction-panel='${station}']`)).toBeVisible();
}

export async function getSceneScreenPoint(page: Page, yRatio = 0.38) {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("A fixed viewport is required for scene interaction tests");
  return {
    x: viewport.width / 2,
    y: viewport.height * yRatio,
  };
}
