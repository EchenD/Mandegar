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

  test("arriving late in a phase still settles on the correct interaction frame", async ({ page }) => {
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
    const nativeProgress = await root.evaluate((element: HTMLElement) => Number(element.dataset.nativeProgress));
    expect(nativeProgress).toBeCloseTo(beat.preview, 3);
  });

  test("forward wheel travel opens the first interaction instead of missing it", async ({ page }) => {
    await page.goto("/en?intro=0&phase=discovery", { waitUntil: "domcontentloaded" });
    const root = page.locator("[data-experience-root]");
    await expect(root).toHaveAttribute("data-story-stage", "discovery", { timeout: 45_000 });
    await page.mouse.wheel(0, 2_500);
    await waitForStation(page, "photo");
    await expect(root).toHaveAttribute("data-story-stage", "activation");
  });

  test("scrolling back through a station does not reopen or lock it", async ({ page }) => {
    await page.goto("/en?intro=0&phase=connection", { waitUntil: "domcontentloaded" });
    const director = await waitForStation(page, "draw");
    await page.keyboard.press("Escape");
    await expect(director).toHaveAttribute("data-active-station", "none", { timeout: 3_000 });
    const root = page.locator("[data-experience-root]");
    const proof = narrativeScore.find((item) => item.id === "proof");
    const game = narrativeScore.find((item) => item.id === "experiences");
    if (!proof || !game) throw new Error("Reverse-scroll checkpoints are missing");
    await root.evaluate((element, progress) => {
      element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress, sync: true } }));
    }, proof.preview);
    await expect(root).toHaveAttribute("data-story-stage", "proof");
    await root.evaluate((element, progress) => {
      element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress, sync: true } }));
    }, game.preview);
    await expect(root).toHaveAttribute("data-story-stage", "experiences");
    await expect(root).toHaveAttribute("data-scroll-direction", "backward");
    await page.waitForTimeout(500);
    await expect(director).toHaveAttribute("data-active-station", "none");
    await expect(root).not.toHaveAttribute("data-interaction-active");
    await expect(director).toHaveAttribute("data-scroll-locked", "false");
  });

  test("a station can start again on a later forward pass", async ({ page }) => {
    await page.goto("/en?intro=0&phase=activation", { waitUntil: "domcontentloaded" });
    const director = await waitForStation(page, "photo");
    await page.keyboard.press("Escape");
    await expect(director).toHaveAttribute("data-active-station", "none", { timeout: 3_000 });
    const root = page.locator("[data-experience-root]");
    const discovery = narrativeScore.find((item) => item.id === "discovery");
    const activation = narrativeScore.find((item) => item.id === "activation");
    if (!discovery || !activation) throw new Error("Replay checkpoints are missing");
    await root.evaluate((element, progress) => {
      element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress, sync: true } }));
    }, discovery.preview);
    await expect(root).toHaveAttribute("data-story-stage", "discovery");
    await root.evaluate((element, progress) => {
      element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress, sync: true } }));
    }, activation.preview);
    await waitForStation(page, "photo");
  });

  test("reverse wheel travel passes interaction phases without trapping the visitor", async ({ page }) => {
    await page.goto("/en?intro=0&phase=proof", { waitUntil: "domcontentloaded" });
    const root = page.locator("[data-experience-root]");
    const director = page.locator("[data-interaction-director]");
    await expect(root).toHaveAttribute("data-story-stage", "proof", { timeout: 45_000 });
    await page.mouse.wheel(0, -4_200);
    await expect(root).toHaveAttribute("data-story-stage", "experiences", { timeout: 10_000 });
    await page.waitForTimeout(1_000);
    await expect(root).toHaveAttribute("data-scroll-direction", "backward");
    await expect(director).toHaveAttribute("data-active-station", "none");
    await expect(root).not.toHaveAttribute("data-interaction-active");
    const before = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, -250);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(before);
  });

  test("rapid phase changes never leave an orphan interaction lock", async ({ page }) => {
    await page.goto("/en?intro=0&phase=discovery", { waitUntil: "domcontentloaded" });
    const root = page.locator("[data-experience-root]");
    await expect(root).toHaveAttribute("data-story-stage", "discovery", { timeout: 45_000 });
    const photo = narrativeScore.find((item) => item.id === "activation");
    const discovery = narrativeScore.find((item) => item.id === "discovery");
    if (!photo || !discovery) throw new Error("Phase checkpoints are missing");
    await root.evaluate((element, progress) => {
      element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress, sync: true } }));
    }, photo.preview - 0.015);
    await root.evaluate((element, progress) => {
      element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress, sync: true } }));
    }, discovery.preview);
    await expect(root).toHaveAttribute("data-story-stage", "discovery");
    await page.waitForTimeout(500);
    await expect(root).not.toHaveAttribute("data-interaction-active");
    await expect(page.locator("[data-interaction-director]")).toHaveAttribute("data-active-station", "none");
    const before = await page.evaluate(() => window.scrollY);
    await page.evaluate(() => window.scrollBy({ top: 120, behavior: "auto" }));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
  });

  test("a viewport-fixed exit remains usable when scene controls are out of view", async ({ page }) => {
    await page.goto("/fa?intro=0&phase=activation", { waitUntil: "domcontentloaded" });
    const director = await waitForStation(page, "photo");
    const exitButton = page.locator("[data-interaction-escape]");
    await expect(exitButton).toBeInViewport();
    await exitButton.click();
    await expect(director).toHaveAttribute("data-active-station", "none", { timeout: 3_000 });
    await expect(director).toHaveAttribute("data-scroll-locked", "false");
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
