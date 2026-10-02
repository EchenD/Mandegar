import { expect, test } from "@playwright/test";
import { activateWithKeyboard, puzzleTiles, solvePuzzle, swapPuzzleSlots, waitForStation } from "./hero-interaction-helpers";

test.setTimeout(120_000);
test.use({ video: "off", trace: "off" });

for (const station of [
  { name: "game", phase: "experiences", file: "screen-game-3x4.webp", canvas: "[data-game-canvas]" },
  { name: "stage", phase: "reveal", file: "screen-center-21x9.webp", canvas: "[data-stage-canvas]" },
  { name: "draw", phase: "connection", file: "screen-main-4x3.webp", canvas: "[data-drawing-canvas]" },
  { name: "touch", phase: "engagement", file: "screen-interactive-16x9.webp", canvas: "[data-composer-canvas]" },
]) {
  test(`${station.name} starts while idle artwork is stalled and keeps visitor input when it arrives`, async ({ page }) => {
    let releaseArtwork!: () => void;
    const artworkGate = new Promise<void>((resolve) => { releaseArtwork = resolve; });
    let requested = false;
    await page.route(`**/${station.file}`, async (route) => {
      requested = true;
      await artworkGate;
      await route.continue().catch(() => {});
    });
    try {
      await page.goto(`/en?intro=0&phase=${station.phase}`, { waitUntil: "domcontentloaded" });
      const director = await waitForStation(page, station.name);
      const canvas = page.locator(station.canvas);
      await expect(canvas).toHaveAttribute("data-transition-progress", "1.000", { timeout: 10_000 });
      expect(requested).toBe(true);

      let controls;
      let retainedAttribute;
      if (station.name === "game") {
        controls = page.locator("[data-game-spatial-controls]");
        retainedAttribute = "data-game-attempts";
        await page.locator("[data-game-action]").evaluate((button: HTMLButtonElement) => {
          button.click();
          button.click();
        });
        await expect(controls).toHaveAttribute("data-game-status", "paused");
      } else if (station.name === "stage") {
        controls = page.locator("[data-stage-spatial-controls]");
        retainedAttribute = "data-stage-active-count";
        await activateWithKeyboard(page, "[data-stage-beam='1']");
      } else if (station.name === "touch") {
        controls = page.locator("[data-touch-spatial-controls]");
        retainedAttribute = "data-puzzle-moves";
        await swapPuzzleSlots(page, 0, 1);
      } else {
        controls = page.locator("[data-drawing-spatial-controls]");
        retainedAttribute = "data-stroke-count";
        await canvas.focus();
        await page.keyboard.press("Space");
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("Space");
      }
      await expect(controls).toHaveAttribute(retainedAttribute, "1");
      await canvas.evaluate((element) => {
        document.documentElement.dataset.artworkRestarted = "false";
        const observer = new MutationObserver(() => {
          if (Number((element as HTMLElement).dataset.transitionProgress) < 1) {
            document.documentElement.dataset.artworkRestarted = "true";
          }
        });
        observer.observe(element, { attributes: true, attributeFilter: ["data-transition-progress"] });
      });
      const response = page.waitForResponse((result) => result.url().endsWith(station.file) && result.ok());
      releaseArtwork();
      await response;
      await page.waitForTimeout(350);
      await expect(page.locator("html")).toHaveAttribute("data-artwork-restarted", "false");
      await expect(canvas).toHaveAttribute("data-transition-progress", "1.000");
      await expect(controls).toHaveAttribute(retainedAttribute, "1");
      await page.keyboard.press("Escape");
      await expect(director).toHaveAttribute("data-active-station", "none");
      await expect(director).toHaveAttribute("data-scroll-locked", "false");
    } finally {
      releaseArtwork();
    }
  });
}

test("late puzzle artwork paints the current arrangement without replaying its entrance", async ({ page }) => {
  let releaseArtwork!: () => void;
  const gate = new Promise<void>((resolve) => { releaseArtwork = resolve; });
  await page.route("**/mandegar-puzzle.webp", async (route) => {
    await gate;
    await route.continue().catch(() => {});
  });
  try {
    await page.goto("/en?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
    await waitForStation(page, "touch");
    const canvas = page.locator("[data-composer-canvas]");
    const controls = page.locator("[data-touch-spatial-controls]");
    await expect(canvas).toHaveAttribute("data-transition-progress", "1.000");
    await swapPuzzleSlots(page, 0, 1);
    const arrangement = await puzzleTiles(page);
    await canvas.evaluate((element) => {
      document.documentElement.dataset.puzzleEntranceRestarted = "false";
      new MutationObserver(() => {
        if (Number((element as HTMLElement).dataset.transitionProgress) < 1) {
          document.documentElement.dataset.puzzleEntranceRestarted = "true";
        }
      }).observe(element, { attributes: true, attributeFilter: ["data-transition-progress"] });
    });
    releaseArtwork();
    await expect(controls).toHaveAttribute("data-puzzle-artwork", "ready", { timeout: 15_000 });
    await expect(canvas).toHaveAttribute("data-puzzle-preview-tiles", JSON.stringify(arrangement));
    expect(await puzzleTiles(page)).toEqual(arrangement);
    await expect(controls).toHaveAttribute("data-puzzle-moves", "1");
    await expect(page.locator("html")).toHaveAttribute("data-puzzle-entrance-restarted", "false");
  } finally {
    releaseArtwork();
  }
});

test("missing puzzle artwork keeps a usable nine-piece fallback and exact completion", async ({ page }, testInfo) => {
  await page.route("**/mandegar-puzzle.webp", (route) => route.abort());
  await page.goto("/en?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "touch");
  const controls = page.locator("[data-touch-spatial-controls]");
  await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-transition-progress", "1.000");
  await expect(controls).toHaveAttribute("data-puzzle-artwork", "missing");
  await expect(page.locator("[data-puzzle-slot]")).toHaveCount(9);
  await solvePuzzle(page);
  await expect(controls).toHaveAttribute("data-puzzle-solved", "true");
  await expect(director).toHaveAttribute("data-lifecycle", "complete");
  await page.screenshot({ path: testInfo.outputPath("puzzle-missing-artwork-fallback.png") });
});
