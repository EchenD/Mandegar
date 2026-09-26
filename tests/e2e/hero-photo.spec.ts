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
  await page.getByRole("button", { name: "Replay" }).click();
  await expect(page.locator("[data-photo-state='countdown']")).toBeAttached({ timeout: 2_000 });
  await expect(page.locator("[data-photo-state='captured']")).toBeAttached({ timeout: 4_000 });
  await expect(page.locator("[data-photo-spatial-controls] canvas")).toHaveAttribute(
    "data-painted-photo-state",
    "captured",
  );
});
