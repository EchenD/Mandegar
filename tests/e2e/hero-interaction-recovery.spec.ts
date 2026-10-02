import { expect, test } from "@playwright/test";
import { narrativeScore } from "../../components/experience/narrative-score";
import { activateWithKeyboard, waitForStation } from "./hero-interaction-helpers";

test.setTimeout(120_000);

test("automatic entry contains keyboard focus and restores it without moving the page", async ({ page }) => {
  await page.goto("/en?intro=0&phase=discovery", { waitUntil: "domcontentloaded" });
  const root = page.locator("[data-experience-root]");
  await expect(root).toHaveAttribute("data-story-stage", "discovery", { timeout: 45_000 });
  await expect(root).not.toHaveAttribute("data-intro-active", "true");
  const previousFocus = page.getByLabel("Primary navigation").getByRole("link", { name: "Projects", exact: true });
  await previousFocus.focus();
  const beat = narrativeScore.find((phase) => phase.id === "engagement");
  if (!beat) throw new Error("Engagement checkpoint is missing");
  await root.evaluate((element, progress) => {
    element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress, sync: true } }));
  }, beat.preview);
  const director = await waitForStation(page, "touch");
  const exit = page.locator("[data-interaction-escape]");
  await expect(exit).toBeFocused();
  const savedScroll = await page.evaluate(() => window.scrollY);

  await previousFocus.focus();
  await page.keyboard.press("Tab");
  await expect(page.locator("[data-touch-element='space']")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(exit).toBeFocused();
  await previousFocus.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(exit).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(savedScroll);

  await page.keyboard.press("Escape");
  await expect(director).toHaveAttribute("data-active-station", "none");
  await expect(previousFocus).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(savedScroll);
});

test("composer can be skipped after resetting a completed composition", async ({ page }) => {
  await page.goto("/en?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "touch");
  const controls = page.locator("[data-touch-spatial-controls]");
  await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-transition-progress", "1.000");
  for (const element of ["space", "story", "people"]) {
    await activateWithKeyboard(page, `[data-touch-element='${element}']`);
  }
  await expect(director).toHaveAttribute("data-lifecycle", "complete");
  await activateWithKeyboard(page, "[data-touch-spatial-controls] button:nth-last-of-type(3)");
  await expect(controls).toHaveAttribute("data-touch-complete", "false");
  await expect(director).toHaveAttribute("data-lifecycle", "active");
  const exit = page.locator("[data-interaction-escape]");
  await expect(exit).toHaveText("Skip interaction");
  await exit.click();
  await expect(director).toHaveAttribute("data-active-station", "none");
  await expect(director).toHaveAttribute("data-scroll-locked", "false");
});

test("mobile stage updates its exit after beam changes, recompletion and reset", async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("/fa?intro=0&phase=reveal", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "stage");
  const dock = page.locator("[data-mobile-stage-dock]");
  const controls = page.locator("[data-stage-spatial-controls]");
  for (const index of [1, 3]) {
    await dock.locator(`[data-mobile-stage-beam='${index}']`).tap();
  }
  await expect(controls).toHaveAttribute("data-stage-active-count", "2");
  await expect(director).toHaveAttribute("data-lifecycle", "active");
  await dock.locator("[data-mobile-stage-finish]").tap();
  await expect(director).toHaveAttribute("data-lifecycle", "complete");
  const exit = page.locator("[data-interaction-escape]");
  await expect(exit).toHaveText("ادامه مسیر");
  await dock.locator("[data-mobile-stage-beam='1']").tap();
  await expect(director).toHaveAttribute("data-lifecycle", "active");
  await expect(controls).toHaveAttribute("data-stage-active-count", "1");
  await expect(exit).toHaveText("رد کردن تعامل");
  await dock.locator("[data-mobile-stage-finish]").tap();
  await expect(director).toHaveAttribute("data-lifecycle", "complete");
  await expect(exit).toHaveText("ادامه مسیر");
  await dock.getByRole("button", { name: "بازنشانی", exact: true }).tap();
  await expect(director).toHaveAttribute("data-lifecycle", "active");
  await expect(exit).toHaveText("رد کردن تعامل");
  await exit.tap();
  await expect(director).toHaveAttribute("data-active-station", "none");
  await expect(director).toHaveAttribute("data-scroll-locked", "false");
  await context.close();
});

test("mobile photo can be skipped immediately after replaying a completed capture", async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("/ar?intro=0&phase=activation", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "photo");
  const controls = page.locator("[data-photo-spatial-controls]");
  await expect(controls).toHaveAttribute("data-photo-state", "ready");
  await page.locator("[data-mobile-photo-capture]").tap();
  await expect(controls).toHaveAttribute("data-photo-state", "captured", { timeout: 10_000 });
  await expect(director).toHaveAttribute("data-lifecycle", "complete");
  const exit = page.locator("[data-interaction-escape]");
  await expect(exit).toHaveText("متابعة الرحلة");
  await expect(exit).toBeHidden();
  await expect(page.locator("[data-mobile-photo-continue]")).toBeInViewport();
  await page.locator("[data-mobile-photo-replay]").tap();
  await expect(controls).toHaveAttribute("data-photo-state", "ready");
  await expect(exit).toHaveText("تخطي التفاعل");
  await expect(exit).toBeVisible();
  await exit.tap();
  await expect(director).toHaveAttribute("data-active-station", "none");
  await expect(director).toHaveAttribute("data-scroll-locked", "false");
  await context.close();
});
