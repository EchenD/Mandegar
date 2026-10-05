import { expect, test } from "@playwright/test";
import { narrativeScore } from "../../components/experience/narrative-score";
import { waitForStation } from "./hero-interaction-helpers";

test.setTimeout(120_000);
test.use({ video: "off", trace: "off" });


for (const [phase, station] of [["engagement", "touch"], ["experiences", "game"], ["connection", "draw"]]) {
  test(`${station} automatically enters at a settled forward checkpoint`, async ({ page }) => {
    await page.goto(`/en?intro=0&phase=${phase}`, { waitUntil: "domcontentloaded" });
    await waitForStation(page, station);
    await expect(page.locator("[data-journey-control]")).toBeVisible();
    await expect(page.locator("[data-copy-layer]")).toHaveAttribute("aria-hidden", "true");
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-active-station", "none");
    await expect(page.locator("[data-copy-layer]")).not.toHaveAttribute("aria-hidden", "true");
  });
}

test("reverse travel never automatically opens a station", async ({ page }) => {
  await page.goto("/en?intro=0&phase=proof", { waitUntil: "domcontentloaded" });
  const root = page.locator("[data-experience-root]");
  await expect(root).toHaveAttribute("data-story-stage", "proof", { timeout: 80_000 });
  const beat = narrativeScore.find((item) => item.id === "experiences")!;
  await root.evaluate((element, progress) => element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress, sync: true } })), beat.preview);
  await expect(root).toHaveAttribute("data-scroll-direction", "backward");
  await page.waitForTimeout(500);
  await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-active-station", "none");
});

test("navigation away from an active station releases its gesture and scroll ownership", async ({ page }) => {
  await page.goto("/en?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  await waitForStation(page, "touch");
  await page.getByLabel("Primary navigation").getByRole("link", { name: "Projects", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/projects/, { timeout: 30_000 });
  await expect(page.locator("[data-interaction-director]")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.style.overscrollBehavior)).not.toBe("none");
});
