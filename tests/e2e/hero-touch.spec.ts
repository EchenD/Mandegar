import { expect, test } from "@playwright/test";
import { narrativeScore } from "../../components/experience/narrative-score";
import { activateWithKeyboard, waitForStation } from "./hero-interaction-helpers";

test.setTimeout(180_000);

test("touch composer resets and completes its three-part composition", async ({ page }) => {
  await page.goto("/en?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "touch");
  const controls = page.locator("[data-touch-spatial-controls]");
  const canvas = page.locator("[data-composer-canvas]");
  await expect(canvas).toHaveAttribute("data-transition-progress", "1.000");

  await activateWithKeyboard(page, "[data-touch-element='space']");
  await activateWithKeyboard(page, "[data-touch-element='story']");
  await expect(controls).toHaveAttribute("data-touch-selected-count", "2");
  await page.evaluate(() => {
    window.dispatchEvent(new Event("blur"));
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
  });
  await expect(controls).toHaveAttribute("data-touch-selected-count", "2");
  await activateWithKeyboard(page, "[data-touch-spatial-controls] button:nth-last-of-type(3)");
  await expect(controls).toHaveAttribute("data-touch-selected-count", "0");

  for (const element of ["space", "story", "people"]) {
    await activateWithKeyboard(page, `[data-touch-element='${element}']`);
  }
  await expect(controls).toHaveAttribute("data-touch-complete", "true");
  await expect(director).toHaveAttribute("data-lifecycle", "complete");
  await activateWithKeyboard(page, "[data-touch-spatial-controls] button:nth-last-of-type(2)");
  await expect(director).toHaveAttribute("data-active-station", "none", { timeout: 3_000 });
});

test("reopening the monitor preserves partial and completed choices until Reset", async ({ page }) => {
  await page.goto("/en?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "touch");
  const controls = page.locator("[data-touch-spatial-controls]");
  await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-transition-progress", "1.000");
  await activateWithKeyboard(page, "[data-touch-element='space']");
  await page.keyboard.press("Escape");
  await expect(director).toHaveAttribute("data-active-station", "none");

  const progress = narrativeScore.find((beat) => beat.id === "engagement")!.preview;
  const reopen = async () => {
    await page.locator("[data-experience-root]").evaluate((element, value) => {
      element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress: value, sync: true } }));
    }, progress);
    await expect(director).toHaveAttribute("data-available-station", "touch");
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("mandegar:interaction-request", {
        detail: { station: "touch", input: "keyboard" },
      }));
    });
    await waitForStation(page, "touch");
    await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-transition-progress", "1.000");
  };

  await reopen();
  await expect(controls).toHaveAttribute("data-touch-selected-count", "1");
  await expect(page.locator("[data-touch-element='space']")).toHaveAttribute("aria-pressed", "true");
  await activateWithKeyboard(page, "[data-touch-element='story']");
  await expect(controls).toHaveAttribute("data-touch-selected-count", "2");
  await activateWithKeyboard(page, "[data-touch-element='people']");
  await expect(director).toHaveAttribute("data-lifecycle", "complete");
  await activateWithKeyboard(page, "[data-touch-spatial-controls] [data-interaction-continue]");
  await expect(director).toHaveAttribute("data-active-station", "none");

  await reopen();
  await expect(controls).toHaveAttribute("data-touch-selected-count", "3");
  await expect(director).toHaveAttribute("data-lifecycle", "complete");
  await activateWithKeyboard(page, "[data-touch-spatial-controls] button:nth-last-of-type(3)");
  await expect(controls).toHaveAttribute("data-touch-selected-count", "0");
  await expect(director).toHaveAttribute("data-lifecycle", "active");
});
