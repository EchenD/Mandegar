import { expect, test } from "@playwright/test";
import { enterStationWithKeyboard } from "./hero-interaction-helpers";

test("photo booth completes a local simulated capture and replays", async ({ page }) => {
  const cameraRequests: string[] = [];
  page.on("request", (request) => {
    if (/camera|webcam|mediaDevices/i.test(request.url())) cameraRequests.push(request.url());
  });
  await page.goto("/en?intro=0&phase=activation", { waitUntil: "networkidle" });
  await enterStationWithKeyboard(page, "photo");
  await page.getByRole("button", { name: "Start capture" }).click();
  await expect(page.locator("[data-photo-state='captured']")).toBeAttached({ timeout: 4_000 });
  await expect(page.getByText("Preview created — no camera was used.")).toBeVisible();
  await expect(page.locator("[data-interaction-panel='photo']")).toHaveAttribute("data-lifecycle", "complete");
  expect(cameraRequests).toEqual([]);
  await page.getByRole("button", { name: "Replay" }).click();
  await expect(page.getByRole("button", { name: "Start capture" })).toBeVisible();
});
