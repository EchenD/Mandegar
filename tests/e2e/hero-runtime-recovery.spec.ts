import { expect, test } from "@playwright/test";
import { waitForStation } from "./hero-interaction-helpers";

test.setTimeout(180_000);
test.use({ trace: "off", video: "off" });

test("a live reduced-motion preference releases an active interaction and blocks reopening during fallback", async ({ page }) => {
  await page.goto("/en?intro=0&phase=experiences", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "game");
  await expect(page.locator("[data-game-canvas]")).toHaveAttribute("data-transition-progress", "1.000");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("[data-webgl='fallback']")).toBeAttached();
  await expect(director).toHaveAttribute("data-runtime", "fallback");
  await expect(director).toHaveAttribute("data-active-station", "none");
  await expect(director).toHaveAttribute("data-scroll-locked", "false");
  await expect(page.locator("[data-game-spatial-controls]")).toHaveCount(0);
  await expect(page.locator("[data-experience-root]")).not.toHaveAttribute("data-interaction-active");
  await expect(page.locator("[data-semantic-fallback]")).toBeVisible();

  // Programmatic requests use the same entry path as scene hotspots. They must
  // remain inert after the renderer is removed, even during phase recovery.
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("mandegar:interaction-request", {
      detail: { station: "game", input: "keyboard" },
    }));
  });
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(director).toHaveAttribute("data-active-station", "none");
  await expect(director).toHaveAttribute("data-scroll-locked", "false");
});

test("a failed scene asset releases the loader into the complete semantic experience", async ({ page }) => {
  await page.route("**/mandegar_environment.glb", (route) => route.abort());
  await page.goto("/en?intro=0", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-webgl='fallback']")).toBeAttached({ timeout: 30_000 });
  await expect(page.locator("[data-semantic-fallback]")).toBeVisible();
  await expect(page.locator("[data-semantic-fallback] section")).toHaveCount(10);
  const director = page.locator("[data-interaction-director]");
  await expect(director).toHaveAttribute("data-active-station", "none");
  await expect(director).toHaveAttribute("data-scroll-locked", "false");
});
