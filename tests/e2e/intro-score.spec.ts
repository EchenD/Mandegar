import { expect, test } from "@playwright/test";
import {
  experienceHomeFrame,
  getIntroFrame,
  introCameraHandoffProgress,
  validateIntroSeam,
} from "../../components/experience/intro-score";

test.describe("one-shot intro score", () => {
  test("settles exactly on the loop home frame", () => {
    expect(validateIntroSeam()).toBe(true);
    expect(getIntroFrame(1)).toEqual(experienceHomeFrame);
  });

  test("keeps the assembly channel normalized", () => {
    for (let index = 0; index <= 100; index += 1) {
      const frame = getIntroFrame(index / 100);
      expect(frame.assemblyProgress).toBeGreaterThanOrEqual(0);
      expect(frame.assemblyProgress).toBeLessThanOrEqual(1);
    }
  });

  test("hands off at the fully assembled camera home", () => {
    const end = getIntroFrame(1);
    expect(end.assemblyProgress).toBe(1);
    expect(end.cameraLocalOffset).toEqual([0, 0, 0]);
  });

  test("assembles monotonically during a vertical-only camera move", () => {
    let previousAssembly = 0;
    let previousCameraY = Number.POSITIVE_INFINITY;
    for (let index = 0; index <= 100; index += 1) {
      const frame = getIntroFrame(index / 100);
      expect(frame.assemblyProgress).toBeGreaterThanOrEqual(previousAssembly);
      expect(frame.cameraLocalOffset[0]).toBe(0);
      expect(frame.cameraLocalOffset[2]).toBe(0);
      expect(frame.cameraLocalOffset[1]).toBeLessThanOrEqual(previousCameraY);
      previousAssembly = frame.assemblyProgress;
      previousCameraY = frame.cameraLocalOffset[1];
    }
  });

  test("finishes the camera before the shader reveal completes", () => {
    const handoff = getIntroFrame(introCameraHandoffProgress);
    expect(handoff.cameraLocalOffset).toEqual([0, 0, 0]);
    expect(handoff.assemblyProgress).toBeGreaterThan(0);
    expect(handoff.assemblyProgress).toBeLessThan(1);
    expect(getIntroFrame(0.5).cameraLocalOffset[1]).toBeGreaterThan(0);
  });
});
