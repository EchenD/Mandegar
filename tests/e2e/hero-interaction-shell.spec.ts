import { expect, test } from "@playwright/test";
import { narrativeScore } from "../../components/experience/narrative-score";
import { waitForStation } from "./hero-interaction-helpers";

test.setTimeout(120_000);

const phaseStations = {
  activation: "photo",
  engagement: "touch",
  reveal: "stage",
  experiences: "game",
  connection: "draw",
} as const;

test.describe("hero interaction shell", () => {
  for (const [phase, station] of Object.entries(phaseStations)) {
    test(`${station} starts automatically at ${phase}`, async ({ page }) => {
      await page.goto(`/en?intro=0&phase=${phase}`, { waitUntil: "domcontentloaded" });
      const director = await waitForStation(page, station);
      await expect(director).toHaveAttribute("data-lifecycle", /active|completing|complete/);
      await expect(page.locator("[data-interaction-hotspot], [data-interaction-panel]")).toHaveCount(0);
    });
  }

  test("landing after the preview still starts the current station", async ({ page }) => {
    await page.goto("/en?intro=0&phase=discovery", { waitUntil: "domcontentloaded" });
    const root = page.locator("[data-experience-root]");
    await expect(root).toHaveAttribute("data-story-stage", "discovery", { timeout: 45_000 });
    await expect(root).toHaveAttribute("data-narrative-progress", /0\.1/);
    const beat = narrativeScore.find((item) => item.id === "activation");
    if (!beat) throw new Error("Activation beat is missing");
    await root.evaluate((element, progress) => {
      element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress } }));
    }, beat.end - 0.01);
    await expect(root).toHaveAttribute("data-story-stage", "activation");
    await waitForStation(page, "photo");
  });

  test("Escape plays the outro and restores the exact scroll position", async ({ page }) => {
    await page.goto("/en?intro=0&phase=activation", { waitUntil: "domcontentloaded" });
    const director = await waitForStation(page, "photo");
    const before = await page.evaluate(() => window.scrollY);
    await expect(page.locator("[data-experience-canvas='true']")).toHaveCSS("touch-action", "none");
    await page.evaluate(() => window.scrollBy({ top: 300, behavior: "auto" }));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(before);
    await page.evaluate(() => {
      const director = document.querySelector<HTMLElement>("[data-interaction-director]");
      if (!director) return;
      const startedAt = performance.now();
      const observer = new MutationObserver(() => {
        if (director.dataset.activeStation !== "none") return;
        document.documentElement.dataset.escapeOutroDuration = String(performance.now() - startedAt);
        observer.disconnect();
      });
      observer.observe(director, { attributes: true, attributeFilter: ["data-active-station"] });
    });
    await page.keyboard.press("Escape");
    await expect(director).toHaveAttribute("data-active-station", "none", { timeout: 3_000 });
    const outroDuration = await page.evaluate(() => Number(document.documentElement.dataset.escapeOutroDuration));
    expect(outroDuration).toBeGreaterThanOrEqual(400);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(before);
    await expect(director).toHaveAttribute("data-scroll-locked", "false");
    await expect(page.locator("[data-experience-canvas='true']")).not.toHaveCSS("touch-action", "none");
  });

  test("client route teardown clears active mode and scroll locking", async ({ page }) => {
    await page.goto("/en?intro=0&phase=activation", { waitUntil: "domcontentloaded" });
    await waitForStation(page, "photo");
    await page.getByLabel("Primary navigation").getByRole("link", { name: "About" }).click();
    await expect(page).toHaveURL(/\/en\/about$/, { timeout: 60_000 });
    await expect(page.locator("[data-interaction-director]")).toHaveCount(0);
    await expect(page.locator("[data-experience-root]")).toHaveCount(0);
  });

  test("browser blur and tab visibility preserve active mode", async ({ page }) => {
    await page.goto("/en?intro=0&phase=activation", { waitUntil: "domcontentloaded" });
    const director = await waitForStation(page, "photo");
    await page.evaluate(() => {
      window.dispatchEvent(new Event("blur"));
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new Event("visibilitychange"));
      Object.defineProperty(document, "hidden", { configurable: true, value: false });
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
    });
    await expect(director).toHaveAttribute("data-active-station", "photo");
    await expect(director).toHaveAttribute("data-scroll-locked", "true");
  });

  test("WebGL context loss cancels active mode", async ({ page }) => {
    await page.goto("/en?intro=0&phase=activation", { waitUntil: "domcontentloaded" });
    const director = await waitForStation(page, "photo");
    await page.locator("[data-experience-canvas='true']").evaluate((canvas) => {
      canvas.dispatchEvent(new Event("webglcontextlost", { bubbles: true, cancelable: true }));
    });
    await expect(director).toHaveAttribute("data-active-station", "none");
    await expect(director).toHaveAttribute("data-scroll-locked", "false");
  });
});
