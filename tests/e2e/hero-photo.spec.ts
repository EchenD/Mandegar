import { expect, test } from "@playwright/test";

test("photo booth automatically completes its visible countdown and replays", async ({ page }) => {
  const cameraRequests: string[] = [];
  page.on("request", (request) => {
    if (/camera|webcam|mediaDevices/i.test(request.url())) cameraRequests.push(request.url());
  });
  await page.goto("/en?intro=0&phase=activation", { waitUntil: "networkidle" });
  await expect(page.locator("[data-interaction-director]")).toHaveAttribute(
    "data-active-station",
    "photo",
  );
  await expect(page.locator("[data-photo-state='captured']")).toBeAttached({ timeout: 4_000 });
  await expect(page.locator("[data-photo-spatial-controls] canvas")).toHaveAttribute(
    "data-painted-photo-state",
    "captured",
  );
  await expect(page.getByRole("status")).toHaveText("Preview created — no camera was used.");
  await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-lifecycle", "complete");
  expect(cameraRequests).toEqual([]);
  await page.getByRole("button", { name: "Replay" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-photo-state='countdown']")).toBeAttached({ timeout: 2_000 });
  await expect(page.locator("[data-photo-state='captured']")).toBeAttached({ timeout: 4_000 });
  await expect(page.locator("[data-photo-spatial-controls] canvas")).toHaveAttribute(
    "data-painted-photo-state",
    "captured",
  );
  await page.getByRole("button", { name: "Continue journey" }).focus();
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
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-interaction-director]")).toHaveAttribute(
    "data-active-station",
    "none",
    { timeout: 2_000 },
  );
  const outroDuration = await page.evaluate(() => Number(
    document.documentElement.dataset.photoOutroDuration,
  ));
  expect(outroDuration).toBeGreaterThanOrEqual(400);
});
