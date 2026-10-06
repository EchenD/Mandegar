import { expect, test } from "@playwright/test";
import { getCameraLoopSampleProgress } from "../../components/experience/camera-timeline";

const samples = [0, 0.025, 0.1, 0.2, 0.24, 0.25, 0.26, 0.3, 0.35, 0.5, 0.7, 0.9, 1];

test("the camera uses the same authored playhead in forward, reverse and seek order", () => {
  for (const order of [samples, [...samples].reverse(), [samples[7], samples[1], samples[11]]]) {
    for (const sample of order) {
      expect(getCameraLoopSampleProgress(sample)).toBe(sample);
    }
  }
});

test("camera sampling stays continuous through the complete clip and clamps outside the journey", () => {
  expect(getCameraLoopSampleProgress(-0.1)).toBe(0);
  expect(getCameraLoopSampleProgress(1.1)).toBe(1);
  let previous = getCameraLoopSampleProgress(0);
  for (let step = 1; step <= 1000; step += 1) {
    const current = getCameraLoopSampleProgress(step / 1000);
    expect(current).toBeGreaterThan(previous);
    expect(current - previous).toBeLessThan(0.002);
    previous = current;
  }
});
