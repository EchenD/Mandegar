import { expect, type Page } from "@playwright/test";

export async function waitForStation(page: Page, station: string) {
  const director = page.locator("[data-interaction-director]");
  await expect(director).toHaveAttribute("data-available-station", station, { timeout: 45_000 });
  await expect(director).toHaveAttribute("data-active-station", station, { timeout: 45_000 });
  await expect(director).toHaveAttribute("data-scroll-locked", "true");
  return director;
}

export async function activateWithKeyboard(page: Page, selector: string) {
  const button = page.locator(selector);
  await expect(button).toBeEnabled();
  await button.focus();
  await page.keyboard.press("Enter");
}
