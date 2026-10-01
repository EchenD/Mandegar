import { expect, test, type Page } from "@playwright/test";
import { activateWithKeyboard, waitForStation } from "./hero-interaction-helpers";

test.setTimeout(120_000);

async function recordCountdown(page: Page) {
  await page.evaluate(() => {
    const controls = document.querySelector<HTMLElement>("[data-photo-spatial-controls]");
    const canvas = controls?.querySelector("canvas");
    if (!controls || !canvas) throw new Error("Photo controls are missing");
    document.documentElement.dataset.photoCountdownObserved = "false";
    const observer = new MutationObserver((records) => {
      const countdownSeen = controls.dataset.photoState === "countdown"
        || canvas.dataset.paintedPhotoState === "countdown"
        || records.some((record) => record.oldValue === "countdown");
      if (!countdownSeen) return;
      document.documentElement.dataset.photoCountdownObserved = "true";
      observer.disconnect();
    });
    observer.observe(controls, { attributes: true, attributeOldValue: true, attributeFilter: ["data-photo-state"] });
    observer.observe(canvas, { attributes: true, attributeOldValue: true, attributeFilter: ["data-painted-photo-state"] });
  });
}

test("photo booth waits for a chosen look and capture, then replays and exits with an outro", async ({ page }) => {
  const cameraRequests: string[] = [];
  page.on("request", (request) => {
    if (/camera|webcam|mediaDevices/i.test(request.url())) cameraRequests.push(request.url());
  });
  await page.goto("/en?intro=0&phase=activation", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "photo");
  const controls = page.locator("[data-photo-spatial-controls]");
  const canvas = controls.locator("canvas");
  await expect(canvas).toHaveAttribute("data-transition-progress", "1.000");
  await expect(controls).toHaveAttribute("data-photo-state", "ready");
  await expect(director).toHaveAttribute("data-lifecycle", "active");
  await activateWithKeyboard(page, "[data-photo-look-choice='cool']");
  await expect(controls).toHaveAttribute("data-photo-look", "cool");
  await expect(page.locator("[data-photo-look-choice='cool']")).toHaveAttribute("aria-pressed", "true");
  await expect(canvas).toHaveAttribute("data-photo-look", "cool");
  await recordCountdown(page);
  await activateWithKeyboard(page, "[data-photo-capture]");
  await expect(controls).toHaveAttribute("data-photo-state", "captured", { timeout: 10_000 });
  await expect(page.locator("html")).toHaveAttribute("data-photo-countdown-observed", "true");
  await expect(canvas).toHaveAttribute("data-painted-photo-state", "captured");
  await expect(controls.locator("[role='status']")).toContainText("Simulated portrait preview");
  await expect(director).toHaveAttribute("data-lifecycle", "complete");
  expect(cameraRequests).toEqual([]);

  await activateWithKeyboard(page, "[data-photo-replay]");
  await expect(director).toHaveAttribute("data-lifecycle", "active");
  await expect(controls).toHaveAttribute("data-photo-state", "ready");
  await expect(controls).toHaveAttribute("data-photo-look", "cool");
  await activateWithKeyboard(page, "[data-photo-look-choice='warm']");
  await expect(canvas).toHaveAttribute("data-photo-look", "warm");
  await recordCountdown(page);
  await activateWithKeyboard(page, "[data-photo-capture]");
  await expect(controls).toHaveAttribute("data-photo-state", "captured", { timeout: 10_000 });
  await expect(page.locator("html")).toHaveAttribute("data-photo-countdown-observed", "true");
  await expect(director).toHaveAttribute("data-lifecycle", "complete");

  await page.evaluate(() => {
    const director = document.querySelector<HTMLElement>("[data-interaction-director]");
    if (!director) return;
    const startedAt = performance.now();
    const observer = new MutationObserver(() => {
      if (director.dataset.activeStation !== "none") return;
      document.documentElement.dataset.photoOutroDuration = String(performance.now() - startedAt);
      observer.disconnect();
    });
    observer.observe(director, { attributes: true, attributeFilter: ["data-active-station"] });
  });
  await activateWithKeyboard(page, "[data-photo-spatial-controls] [data-interaction-continue]");
  await expect(director).toHaveAttribute("data-active-station", "none", { timeout: 3_000 });
  const outroDuration = await page.evaluate(() => Number(document.documentElement.dataset.photoOutroDuration));
  expect(outroDuration).toBeGreaterThanOrEqual(400);
});
