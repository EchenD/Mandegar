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

test("event photo delivery demo captures, reaches the phone, replays and exits", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const photoWindow = window as Window & { photoCameraRequests?: number };
    photoWindow.photoCameraRequests = 0;
    if (!navigator.mediaDevices) return;
    navigator.mediaDevices.getUserMedia = async () => {
      photoWindow.photoCameraRequests = (photoWindow.photoCameraRequests ?? 0) + 1;
      throw new Error("The delivery demo must not request a camera");
    };
  });
  const deliveryRequests: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") deliveryRequests.push(request.url());
  });
  await page.goto("/en?intro=0&phase=activation", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "photo");
  const controls = page.locator("[data-photo-spatial-controls]");
  const canvas = controls.locator("canvas");
  await expect(canvas).toHaveAttribute("data-transition-progress", "1.000");
  await expect(controls).toHaveAttribute("data-photo-state", "ready");
  await expect(director).toHaveAttribute("data-lifecycle", "active");
  await expect(controls.getByRole("heading")).toHaveText("Capture the moment.");
  await expect(controls.getByRole("heading")).toBeInViewport();
  await expect(controls.locator("p")).toHaveText("Straight to your phone.");
  await expect(controls.locator("small")).toHaveText("Demo · example photo");
  await expect(controls).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(page.locator("[data-interaction-hint]")).toBeHidden();
  await expect(page.locator("[data-photo-look-choice], [data-mobile-photo-look], [data-mobile-photo-preview]")).toHaveCount(0);
  await expect(controls.locator("img")).toHaveCount(0);
  await expect(page.locator("[data-photo-capture]")).toHaveText("Watch delivery");
  await expect(controls.getByRole("button")).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath("photo-desktop-ready.png") });
  await recordCountdown(page);
  await activateWithKeyboard(page, "[data-photo-capture]");
  await expect(controls).toHaveAttribute("data-photo-state", "captured", { timeout: 10_000 });
  await expect(page.locator("html")).toHaveAttribute("data-photo-countdown-observed", "true");
  await expect(canvas).toHaveAttribute("data-painted-photo-state", "captured");
  await expect(controls.locator("[role='status']")).toContainText("On your phone.");
  await expect(controls.getByRole("heading")).toHaveText("On your phone.");
  await expect(page.locator("[data-photo-replay]")).toBeInViewport();
  await expect(page.locator("[data-photo-continue]")).toBeInViewport();
  await expect(page.locator("[data-interaction-escape]")).toBeHidden();
  await expect(controls.getByRole("button")).toHaveCount(2);
  const attachedInterface = await canvas.evaluate((element: HTMLCanvasElement) => {
    const pixels = element.getContext("2d")?.getImageData(0, 0, element.width, element.height).data;
    return pixels?.some((channel, index) => index % 4 === 3 && channel > 0);
  });
  expect(attachedInterface).toBe(false);
  await expect(director).toHaveAttribute("data-lifecycle", "complete");
  expect(await page.evaluate(() => (window as Window & { photoCameraRequests?: number }).photoCameraRequests)).toBe(0);
  expect(deliveryRequests).toEqual([]);
  // Capture the delivered phone after its authored arrival has settled.
  await page.waitForTimeout(1_200);
  await page.screenshot({ path: testInfo.outputPath("photo-desktop-delivered.png") });

  await activateWithKeyboard(page, "[data-photo-replay]");
  await expect(director).toHaveAttribute("data-lifecycle", "active");
  await expect(controls).toHaveAttribute("data-photo-state", "ready");
  await expect(page.locator("[data-photo-capture]")).toBeFocused();
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
