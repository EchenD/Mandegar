import { expect, test } from "@playwright/test";
import { narrativeScore } from "../../components/experience/narrative-score";
import { activateWithKeyboard, waitForStation } from "./hero-interaction-helpers";

test.setTimeout(180_000);

test("finished drawing continues without a media flash and blends when reversing the story", async ({ page }) => {
  // Observe the actual screen shader without adding test hooks to the experience.
  await page.addInitScript(() => {
    const observer = window as unknown as Window & { __screenBlends: number[] };
    observer.__screenBlends = [];
    for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
      const names = new WeakMap<WebGLUniformLocation, string>();
      const locate = prototype.getUniformLocation;
      const write = prototype.uniform1f;
      prototype.getUniformLocation = function (program, name) {
        const location = locate.call(this, program, name);
        if (location) names.set(location, name);
        return location;
      };
      prototype.uniform1f = function (location, value) {
        if (location && names.get(location) === "uMediaBlend") {
          observer.__screenBlends.push(value);
          if (observer.__screenBlends.length > 200) observer.__screenBlends.shift();
        }
        write.call(this, location, value);
      };
    }
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/en?intro=0&phase=reveal", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "stage");
  await expect(page.locator("[data-stage-canvas]")).toHaveAttribute("data-transition-progress", "1.000");
  for (const beam of [1, 3]) {
    await activateWithKeyboard(page, `[data-stage-beam='${beam}']`);
  }
  await activateWithKeyboard(page, "[data-stage-finish]");
  await expect(director).toHaveAttribute("data-lifecycle", "complete");
  await activateWithKeyboard(page, "[data-stage-spatial-controls] [data-interaction-continue]");
  await expect(director).toHaveAttribute("data-active-station", "none");

  const connection = narrativeScore.find((beat) => beat.id === "connection");
  if (!connection) throw new Error("Drawing checkpoint is missing");
  const root = page.locator("[data-experience-root]");
  await root.evaluate((element, progress) => {
    element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress, sync: true } }));
  }, connection.preview);
  await waitForStation(page, "draw");
  const controls = page.locator("[data-drawing-spatial-controls]");
  await expect(page.locator("[data-drawing-canvas]")).toHaveAttribute("data-transition-progress", "1.000");
  await page.mouse.move(550, 250);
  await page.mouse.down();
  await page.mouse.move(750, 290, { steps: 8 });
  await page.mouse.up();
  await expect(controls).toHaveAttribute("data-stroke-count", "1");
  await page.evaluate(() => {
    (window as unknown as Window & { __screenBlends: number[] }).__screenBlends = [];
  });
  await activateWithKeyboard(page, "[data-drawing-spatial-controls] button:nth-of-type(3)");
  await expect(director).toHaveAttribute("data-lifecycle", "complete");
  await expect(controls).toHaveAttribute("data-drawing-finished", "true");
  await activateWithKeyboard(page, "[data-drawing-spatial-controls] button:nth-of-type(3)");
  await expect(director).toHaveAttribute("data-active-station", "none");
  const continuationBlends = await page.evaluate(() => {
    return (window as unknown as Window & { __screenBlends: number[] }).__screenBlends;
  });
  expect(continuationBlends.every((value) => value >= 0.99)).toBe(true);

  const activation = narrativeScore.find((beat) => beat.id === "activation");
  if (!activation) throw new Error("Opening checkpoint is missing");
  await page.evaluate(() => {
    (window as unknown as Window & { __screenBlends: number[] }).__screenBlends = [];
  });
  await root.evaluate((element, progress) => {
    element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress, sync: true } }));
  }, connection.start + 0.01);
  await expect.poll(() => page.evaluate(() => {
    return (window as unknown as Window & { __screenBlends: number[] }).__screenBlends.some((value) => value > 0 && value < 0.9);
  })).toBe(true);
  await expect(director).toHaveAttribute("data-active-station", "none");
  await root.evaluate((element, progress) => {
    element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress, sync: true } }));
  }, activation.preview);
  await expect(director).toHaveAttribute("data-active-station", "none");

  await root.evaluate((element, progress) => {
    element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress, sync: true } }));
  }, connection.preview);
  await expect(director).toHaveAttribute("data-available-station", "draw");
  await expect(director).toHaveAttribute("data-active-station", "none");
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("mandegar:interaction-request", {
      detail: { station: "draw", input: "keyboard" },
    }));
  });
  await waitForStation(page, "draw");
  await expect(controls).toHaveAttribute("data-stroke-count", "0");
  await page.keyboard.press("Escape");
  await expect(director).toHaveAttribute("data-active-station", "none");
});
