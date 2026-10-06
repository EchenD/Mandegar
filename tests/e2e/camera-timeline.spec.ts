import { expect, test } from "@playwright/test";
import { getCameraLoopSampleProgress } from "../../components/experience/camera-timeline";

// Samples recorded from the original camera mapping before extracting it.
const baselineSamples = [
  { progress: 0, clipProgress: 0 },
  { progress: 0.025, clipProgress: 0.0275 },
  { progress: 0.1, clipProgress: 0.125 },
  { progress: 0.2, clipProgress: 0.2695 },
  { progress: 0.24, clipProgress: 0.3184 },
  { progress: 0.25, clipProgress: 0.325 },
  { progress: 0.26, clipProgress: 0.3316 },
  { progress: 0.3, clipProgress: 0.358 },
  { progress: 0.35, clipProgress: 0.39975 },
  { progress: 0.5, clipProgress: 0.58 },
  { progress: 0.7, clipProgress: 0.72 },
  { progress: 0.9, clipProgress: 0.917 },
  { progress: 1, clipProgress: 1 },
] as const;

test("extracting camera timing preserves existing compositions in forward, reverse and seek order", () => {
  for (const samples of [baselineSamples, [...baselineSamples].reverse(), [baselineSamples[7], baselineSamples[1], baselineSamples[11]]]) {
    for (const sample of samples) {
      expect(getCameraLoopSampleProgress(sample.progress)).toBeCloseTo(sample.clipProgress, 12);
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
