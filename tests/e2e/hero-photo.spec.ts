import { expect, test } from "@playwright/test";
import { activateWithKeyboard, waitForStation } from "./hero-interaction-helpers";

test.setTimeout(120_000);

test("photo booth counts down, replays and exits with an outro", async ({ page }) => {
  const cameraRequests: string[] = [];
  page.on("request", (request) => {
    if (/camera|webcam|mediaDevices/i.test(request.url())) cameraRequests.push(request.url());
  });
  await page.goto("/en?intro=0&phase=activation", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "photo");
  const controls = page.locator("[data-photo-spatial-controls]");
  const canvas = controls.locator("canvas");
  await expect(controls).toHaveAttribute("data-photo-state", "captured", { timeout: 10_000 });
  await expect(canvas).toHaveAttribute("data-painted-photo-state", "captured");
  await expect(controls.locator("[role='status']")).toContainText("Preview created");
  await expect(director).toHaveAttribute("data-lifecycle", "complete");
  expect(cameraRequests).toEqual([]);

  await activateWithKeyboard(page, "[data-photo-spatial-controls] button:nth-of-type(2)");
  await expect(director).toHaveAttribute("data-lifecycle", "active");
  await expect(controls).toHaveAttribute("data-photo-state", "countdown", { timeout: 2_000 });
  await expect(controls).toHaveAttribute("data-photo-state", "captured", { timeout: 10_000 });
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
  await activateWithKeyboard(page, "[data-photo-spatial-controls] button:nth-of-type(3)");
  await expect(director).toHaveAttribute("data-active-station", "none", { timeout: 3_000 });
  const outroDuration = await page.evaluate(() => Number(document.documentElement.dataset.photoOutroDuration));
  expect(outroDuration).toBeGreaterThanOrEqual(400);
});
