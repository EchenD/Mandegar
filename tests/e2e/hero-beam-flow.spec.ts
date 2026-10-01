import { expect, test, type Page } from "@playwright/test";
import { narrativeScore } from "../../components/experience/narrative-score";
import { activateWithKeyboard, waitForStation } from "./hero-interaction-helpers";

type BeamObservation = {
  samples: { time: number; energy: number }[];
  lastEnergy: number;
  lastUploadTime: number;
  drawCalls: number;
  lastDrawTime: number;
  matchedBuffers: number;
};

type BeamWindow = Window & { __beamObservation: BeamObservation };

async function observeSelectedBeams(page: Page) {
  await page.addInitScript(() => {
    const observation: BeamObservation = {
      samples: [],
      lastEnergy: 0,
      lastUploadTime: 0,
      drawCalls: 0,
      lastDrawTime: 0,
      matchedBuffers: 0,
    };
    (window as unknown as BeamWindow).__beamObservation = observation;
    const boundBuffers = new WeakMap<object, WebGLBuffer | null>();
    const colorBuffers = new WeakSet<WebGLBuffer>();
    const constructors = [
      typeof WebGLRenderingContext === "undefined" ? null : WebGLRenderingContext,
      typeof WebGL2RenderingContext === "undefined" ? null : WebGL2RenderingContext,
    ];

    for (const constructor of constructors) {
      if (!constructor) continue;
      const prototype = constructor.prototype as unknown as Record<string, (this: WebGLRenderingContext, ...args: unknown[]) => unknown>;
      const bindBuffer = prototype.bindBuffer;
      prototype.bindBuffer = function (...args) {
        if (args[0] === this.ARRAY_BUFFER) boundBuffers.set(this, args[1] as WebGLBuffer | null);
        return bindBuffer.apply(this, args);
      };

      for (const method of ["bufferData", "bufferSubData"]) {
        const original = prototype[method];
        prototype[method] = function (...args) {
          const result = original.apply(this, args);
          const values = args[method === "bufferData" ? 1 : 2];
          const buffer = boundBuffers.get(this);
          if (args[0] !== this.ARRAY_BUFFER || !buffer || !(values instanceof Float32Array) || values.length !== 15) return result;

          // Five RGB beam colors: only the visitor's chosen lights 1 and 3 are on.
          const selectedEnergy = values[0] + values[1] + values[2] + values[6] + values[7] + values[8];
          const otherColorsOff = [3, 4, 5, 9, 10, 11, 12, 13, 14].every((index) => Math.abs(values[index]) < 0.000001);
          if (!colorBuffers.has(buffer)) {
            if (!otherColorsOff || values[2] <= 0.02 || values[8] <= 0.02 || !values.every((value) => value >= 0 && value <= 2)) return result;
            colorBuffers.add(buffer);
            observation.matchedBuffers += 1;
          }
          observation.lastEnergy = selectedEnergy;
          observation.lastUploadTime = performance.now();
          observation.samples.push({ time: observation.lastUploadTime, energy: selectedEnergy });
          if (observation.samples.length > 2400) observation.samples.shift();
          return result;
        };
      }

      for (const method of ["drawElements", "drawArrays", "drawElementsInstanced", "drawArraysInstanced"]) {
        const original = prototype[method];
        if (typeof original !== "function") continue;
        prototype[method] = function (...args) {
          const result = original.apply(this, args);
          observation.drawCalls += 1;
          observation.lastDrawTime = performance.now();
          return result;
        };
      }
    }
  });
}

const readObservation = (page: Page) => page.evaluate(() => (window as unknown as BeamWindow).__beamObservation);

test.setTimeout(180_000);

test("chosen beams keep playing, pause at Intelligence and return with backward scroll", async ({ page }, testInfo) => {
  await observeSelectedBeams(page);
  await page.goto("/en?intro=0&phase=reveal", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "stage");
  const root = page.locator("[data-experience-root]");
  const controls = page.locator("[data-stage-spatial-controls]");
  await activateWithKeyboard(page, "[data-stage-beam='1']");
  await activateWithKeyboard(page, "[data-stage-beam='3']");
  await expect.poll(async () => (await readObservation(page)).matchedBuffers, { timeout: 10_000 }).toBeGreaterThan(0);
  await activateWithKeyboard(page, "[data-stage-finish]");
  await expect(director).toHaveAttribute("data-lifecycle", "complete");
  await activateWithKeyboard(page, "[data-stage-spatial-controls] [data-interaction-continue]");
  await expect(director).toHaveAttribute("data-active-station", "none");
  await expect.poll(async () => (await readObservation(page)).lastEnergy, { timeout: 10_000 }).toBeGreaterThan(0.45);
  const savedLighting = testInfo.outputPath("saved-lighting.png");
  await page.screenshot({ path: savedLighting });
  await testInfo.attach("Saved lighting after Continue", { path: savedLighting, contentType: "image/png" });

  // Exclude the handoff damping, then observe a complete repeating show.
  const loopStartedAt = await page.evaluate(() => performance.now() + 1000);
  await expect.poll(async () => {
    const samples = (await readObservation(page)).samples.filter((sample) => sample.time >= loopStartedAt);
    if (samples.length < 6 || samples.at(-1)!.time - samples[0].time < 4000) return 0;
    return Math.max(...samples.map((sample) => sample.energy)) - Math.min(...samples.map((sample) => sample.energy));
  }, { timeout: 15_000, intervals: [250, 500] }).toBeGreaterThan(0.25);

  const intelligence = narrativeScore.find((beat) => beat.id === "intelligence")!;
  await root.evaluate((element, progress) => {
    element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress, sync: true } }));
  }, intelligence.preview);
  await expect(root).toHaveAttribute("data-story-stage", "intelligence");
  await expect(director).toHaveAttribute("data-active-station", "none");
  const intelligenceReached = await page.evaluate(() => ({
    time: performance.now(),
    drawCalls: (window as unknown as BeamWindow).__beamObservation.drawCalls,
  }));
  await expect.poll(async () => {
    const observation = await readObservation(page);
    const sceneIsDrawing = observation.drawCalls > intelligenceReached.drawCalls;
    // Invisible groups stop uploading their dirty colors; the rest of the scene must keep drawing.
    const colorsAreHidden = observation.lastDrawTime - Math.max(intelligenceReached.time, observation.lastUploadTime) >= 750;
    return observation.matchedBuffers > 0 && sceneIsDrawing && (observation.lastEnergy < 0.02 || colorsAreHidden);
  }, { timeout: 10_000 }).toBe(true);
  const quietLighting = testInfo.outputPath("intelligence-lighting.png");
  await page.screenshot({ path: quietLighting });
  await testInfo.attach("Lighting quiet at Intelligence", { path: quietLighting, contentType: "image/png" });

  const reveal = narrativeScore.find((beat) => beat.id === "reveal")!;
  const backwardStartedAt = await page.evaluate(() => performance.now());
  await root.evaluate((element, progress) => {
    element.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress, sync: true } }));
  }, reveal.preview);
  await expect(root).toHaveAttribute("data-story-stage", "reveal");
  await expect(root).toHaveAttribute("data-scroll-direction", "backward");
  await expect(director).toHaveAttribute("data-active-station", "none");
  await expect.poll(async () => {
    const observation = await readObservation(page);
    return observation.lastUploadTime >= backwardStartedAt && observation.lastEnergy > 0.05;
  }, { timeout: 10_000 }).toBe(true);

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("mandegar:interaction-request", { detail: { station: "stage", input: "keyboard" } }));
  });
  await waitForStation(page, "stage");
  await expect(controls.locator("[aria-pressed='true']")).toHaveCount(2);
  await expect(controls.locator("[data-stage-beam='1']")).toHaveAttribute("aria-pressed", "true");
  await expect(controls.locator("[data-stage-beam='3']")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(director).toHaveAttribute("data-active-station", "none");
});
