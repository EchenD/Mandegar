import { expect, test } from "@playwright/test";
import {
  experienceHomeFrame,
  getIntroFrame,
  validateIntroSeam,
} from "../../components/experience/intro-score";

test.describe("one-shot intro score", () => {
  test("settles exactly on the loop home frame", () => {
    expect(validateIntroSeam()).toBe(true);
    expect(getIntroFrame(1)).toEqual(experienceHomeFrame);
  });

  test("keeps normalized visibility channels bounded", () => {
    for (let index = 0; index <= 100; index += 1) {
      const frame = getIntroFrame(index / 100);
      expect(frame.sceneVisibility).toBeGreaterThanOrEqual(0);
      expect(frame.sceneVisibility).toBeLessThanOrEqual(1);
      expect(frame.wireVisibility).toBeGreaterThanOrEqual(0);
      expect(frame.wireVisibility).toBeLessThanOrEqual(1);
      expect(frame.particleVisibility).toBeGreaterThanOrEqual(0);
      expect(frame.particleVisibility).toBeLessThanOrEqual(1);
      expect(frame.lightVisibility).toBeGreaterThanOrEqual(0);
      expect(frame.lightVisibility).toBeLessThanOrEqual(1);
    }
  });

  test("removes every intro-only accent before handoff", () => {
    const end = getIntroFrame(1);
    expect(end.beacon).toBe(0);
    expect(end.bloomBoost).toBe(0);
    expect(end.cameraLocalOffset).toEqual([0, 0, 0]);
    expect(end.cameraFovOffset).toBe(0);
  });
});
