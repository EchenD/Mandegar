import { expect, test } from "@playwright/test";
import { activateWithKeyboard, waitForStation } from "./hero-interaction-helpers";

test.setTimeout(120_000);

test("stage accepts a personal lighting look and editing restores its unfinished state", async ({ page }) => {
  await page.goto("/en?intro=0&phase=reveal", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "stage");
  const controls = page.locator("[data-stage-spatial-controls]");
  await expect(controls.locator("[data-stage-finish]")).toBeDisabled();
  await activateWithKeyboard(page, "[data-stage-beam='3']");
  await expect(director).toHaveAttribute("data-lifecycle", "active");
  await expect(controls.locator("[data-interaction-continue]")).toBeDisabled();
  await activateWithKeyboard(page, "[data-stage-finish]");
  await expect(director).toHaveAttribute("data-lifecycle", "complete");
  await expect(controls).toHaveAttribute("data-stage-complete", "true");
  await expect(controls.locator("[aria-pressed='true']")).toHaveCount(1);

  await activateWithKeyboard(page, "[data-stage-beam='1']");
  await expect(director).toHaveAttribute("data-lifecycle", "active");
  await expect(controls).toHaveAttribute("data-stage-complete", "false");
  await activateWithKeyboard(page, "[data-stage-finish]");
  await expect(director).toHaveAttribute("data-lifecycle", "complete");
  await activateWithKeyboard(page, "[data-stage-spatial-controls] [data-interaction-continue]");
  await expect(director).toHaveAttribute("data-active-station", "none", { timeout: 3_000 });
});

test("stage show preserves chosen beams and can be interrupted by editing or reset", async ({ page }) => {
  await page.goto("/en?intro=0&phase=reveal", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "stage");
  const controls = page.locator("[data-stage-spatial-controls]");
  await activateWithKeyboard(page, "[data-stage-beam='1']");
  await activateWithKeyboard(page, "[data-stage-beam='4']");
  await activateWithKeyboard(page, "[data-stage-play]");
  await expect(controls).toHaveAttribute("data-stage-showing", "true");
  await expect(controls).toHaveAttribute("data-stage-showing", "false", { timeout: 4_000 });
  await expect(controls.locator("[data-stage-beam='1']")).toHaveAttribute("aria-pressed", "true");
  await expect(controls.locator("[data-stage-beam='4']")).toHaveAttribute("aria-pressed", "true");
  await expect(controls.locator("[aria-pressed='true']")).toHaveCount(2);
  await expect(director).toHaveAttribute("data-lifecycle", "active");

  await activateWithKeyboard(page, "[data-stage-play]");
  await activateWithKeyboard(page, "[data-stage-beam='4']");
  await expect(controls).toHaveAttribute("data-stage-showing", "false");
  await expect(controls.locator("[data-stage-beam='4']")).toHaveAttribute("aria-pressed", "false");
  await activateWithKeyboard(page, "[data-stage-play]");
  await activateWithKeyboard(page, "[data-stage-reset]");
  await expect(controls).toHaveAttribute("data-stage-showing", "false");
  await expect(controls).toHaveAttribute("data-stage-active-count", "0");
  await expect(controls.locator("[data-stage-finish]")).toBeDisabled();
  await page.locator("[data-interaction-escape]").click();
  await expect(director).toHaveAttribute("data-active-station", "none", { timeout: 3_000 });
});

test.describe("mobile stage creation", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("RTL stage offers Play and Finish without requiring the show to finish", async ({ page }) => {
    await page.goto("/fa?intro=0&phase=reveal", { waitUntil: "domcontentloaded" });
    const director = await waitForStation(page, "stage");
    const dock = page.locator("[data-mobile-stage-dock]");
    const controls = page.locator("[data-stage-spatial-controls]");
    await expect(dock).toBeVisible();
    await dock.locator("[data-mobile-stage-beam='2']").tap();
    await dock.locator("[data-mobile-stage-play]").tap();
    await expect(controls).toHaveAttribute("data-stage-showing", "true");
    await dock.locator("[data-mobile-stage-finish]").tap();
    await expect(controls).toHaveAttribute("data-stage-showing", "false");
    await expect(director).toHaveAttribute("data-lifecycle", "complete");
    await expect(controls.locator("[aria-pressed='true']")).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await dock.locator("[data-mobile-stage-finish]").tap();
    await expect(director).toHaveAttribute("data-active-station", "none", { timeout: 3_000 });
  });
});
