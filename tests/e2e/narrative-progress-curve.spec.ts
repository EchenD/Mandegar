import { expect, test } from "@playwright/test";
import { narrativeScore } from "../../components/experience/narrative-score";
import {
  getNarrativeVelocity,
  narrativeVelocity,
  validateNarrativeProgressCurve,
  warpNarrativeProgress,
} from "../../components/experience/narrative-progress-curve";

test.describe("narrative progress velocity", () => {
  test("is slow at stages and fast halfway through transitions", () => {
    expect(getNarrativeVelocity(0)).toBeCloseTo(narrativeVelocity.minimum, 8);
    expect(getNarrativeVelocity(0.5)).toBeCloseTo(narrativeVelocity.maximum, 8);
    expect(getNarrativeVelocity(1)).toBeCloseTo(narrativeVelocity.minimum, 8);
  });

  test("exposes a GSAP-like tangent power for creative tuning", () => {
    expect(narrativeVelocity.tangentPower).toBeGreaterThan(0);
    expect(getNarrativeVelocity(0.1)).toBeLessThan(getNarrativeVelocity(0.25));
  });

  test("preserves all nine stage anchors and remains monotonic", () => {
    expect(validateNarrativeProgressCurve()).toBe(true);
    for (const stage of narrativeScore) {
      expect(warpNarrativeProgress(stage.preview)).toBeCloseTo(stage.preview, 8);
    }
  });

  test("lags after departure and leads while arriving", () => {
    const from = narrativeScore[2].preview;
    const to = narrativeScore[3].preview;
    const quarter = from + (to - from) * 0.25;
    const threeQuarters = from + (to - from) * 0.75;

    expect(warpNarrativeProgress(quarter)).toBeLessThan(quarter);
    expect(warpNarrativeProgress(threeQuarters)).toBeGreaterThan(threeQuarters);
  });
});
