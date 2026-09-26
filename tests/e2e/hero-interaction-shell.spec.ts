import { expect, test } from "@playwright/test";
import { enterStationWithKeyboard, getStationPoint } from "./hero-interaction-helpers";

const phaseStations = {
  activation: "photo",
  engagement: "touch",
  reveal: "stage",
  experiences: "game",
  connection: "draw",
} as const;

test.describe("hero interaction shell", () => {
  for (const [phase, station] of Object.entries(phaseStations)) {
    test(`${station} is the only available station at ${phase}`, async ({ page }) => {
      await page.goto(`/en?intro=0&phase=${phase}`, { waitUntil: "networkidle" });
      const director = page.locator("[data-interaction-director]");
      await expect(director).toHaveAttribute("data-available-station", station);
      if (station === "touch") {
        await expect(director).toHaveAttribute("data-active-station", "touch");
        await expect(page.locator("[data-interaction-hotspot]")).toHaveCount(0);
        return;
      }
      await expect(page.locator("[data-interaction-hotspot]")).toHaveCount(1);
      await expect(page.locator(`[data-interaction-hotspot='${station}']`)).toBeAttached();
    });
  }

  test("entry locks and Escape restores the exact scroll position", async ({ page }) => {
    await page.goto("/en?intro=0&phase=activation", { waitUntil: "networkidle" });
    const director = page.locator("[data-interaction-director]");
    await expect(director).toHaveAttribute("data-available-station", "photo");
    const before = await page.evaluate(() => window.scrollY);
    const cue = await getStationPoint(page, "photo");
    await page.mouse.click(cue.x, cue.y);
    await expect(director).toHaveAttribute("data-scroll-locked", "true");
    await expect(page.locator("[data-interaction-panel='photo']")).toBeVisible();
    await expect.poll(() => page.evaluate(() => ({
      body: document.body.style.overflow,
      html: document.documentElement.style.overflow,
    }))).toEqual({ body: "hidden", html: "hidden" });
    await page.evaluate(() => window.scrollBy({ top: 300, behavior: "auto" }));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(before);
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-interaction-panel]")).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(before);
    await expect.poll(() => page.evaluate(() => ({
      body: document.body.style.overflow,
      html: document.documentElement.style.overflow,
    }))).toEqual({ body: "", html: "" });
  });

  test("legacy hover UI and invisible scene navigation are absent", async ({ page }) => {
    await page.goto("/en?intro=0&phase=proof", { waitUntil: "networkidle" });
    await expect(page.locator("[data-spatial-labels], [data-spatial-annotation]")).toHaveCount(0);
    await expect(page.getByText("LEARN MORE", { exact: true })).toHaveCount(0);
    await expect(page.locator("[data-scene-a11y]")).toHaveCount(0);
  });

  test("client route teardown clears active mode and scroll locking", async ({ page }) => {
    await page.goto("/en?intro=0&phase=activation", { waitUntil: "networkidle" });
    await enterStationWithKeyboard(page, "photo");
    await expect(page.locator("[data-interaction-panel='photo']")).toBeVisible();
    await page.getByLabel("Primary navigation").getByRole("link", { name: "About" }).click();
    await expect(page).toHaveURL(/\/en\/about$/, { timeout: 15_000 });
    await expect(page.locator("[data-interaction-panel]")).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => ({
      body: document.body.style.overflow,
      html: document.documentElement.style.overflow,
    }))).toEqual({ body: "", html: "" });
  });

  test("browser blur and tab visibility preserve active mode", async ({ page }) => {
    await page.goto("/en?intro=0&phase=activation", { waitUntil: "networkidle" });
    await enterStationWithKeyboard(page, "photo");
    const panel = page.locator("[data-interaction-panel='photo']");
    const director = page.locator("[data-interaction-director]");
    await expect(panel).toBeVisible();
    await page.evaluate(() => {
      window.dispatchEvent(new Event("blur"));
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(panel).toBeVisible();
    await expect(director).toHaveAttribute("data-active-station", "photo");
    await expect(director).toHaveAttribute("data-scroll-locked", "true");
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: false });
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
    });
    await expect(panel).toBeVisible();
  });

  test("WebGL context loss cancels active mode", async ({ page }) => {
    await page.goto("/en?intro=0&phase=activation", { waitUntil: "networkidle" });
    await enterStationWithKeyboard(page, "photo");
    await expect(page.locator("[data-interaction-panel='photo']")).toBeVisible();
    await page.locator("[data-experience-canvas='true']").evaluate((canvas) => {
      canvas.dispatchEvent(new Event("webglcontextlost", { bubbles: true, cancelable: true }));
    });
    await expect(page.locator("[data-interaction-panel]")).toHaveCount(0);
    await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-scroll-locked", "false");
  });
});
