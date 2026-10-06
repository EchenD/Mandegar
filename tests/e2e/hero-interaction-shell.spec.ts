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

test("section navigation cancels a completed station's pending advance and releases its ownership", async ({ page }) => {
  await page.goto("/en?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  await waitForStation(page, "touch");
  const sample = await page.locator("[data-experience-root]").evaluate((root) => new Promise<{
    requests: number;
    resultPresent: boolean;
  }>((resolve) => {
    let requests = 0;
    const finish = () => { requests += 1; };
    root.addEventListener("mandegar:finish-phase", finish);
    root.querySelector<HTMLButtonElement>("[data-interaction-finish]")!.click();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const resultPresent = root.querySelector("p[data-interaction-result='touch']") !== null;
      document.querySelector<HTMLAnchorElement>("header nav a[href='#showcase']")!.click();
      setTimeout(() => {
        root.removeEventListener("mandegar:finish-phase", finish);
        resolve({ requests, resultPresent });
      }, 2_000);
    }));
  }));
  expect(sample.resultPresent).toBe(true);
  expect(sample.requests).toBe(0);
  await expect(page).toHaveURL(/#showcase$/);
  await expect(page.locator("[data-connected-journey]")).toHaveAttribute("data-journey-phase", "projects");
  await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-active-station", "none");
  await expect(page.locator("[data-experience-root]")).not.toHaveAttribute("data-interaction-active");
  await expect(page.locator("[data-experience-root]")).not.toHaveAttribute("data-finish-scrolling");
  expect(await page.evaluate(() => document.documentElement.style.overscrollBehavior)).not.toBe("none");
});
