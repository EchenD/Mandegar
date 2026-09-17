import { expect, test } from "@playwright/test";
import {
  getNarrativeCopyTiming,
  narrativeCopyRhythm,
  narrativeCopyStageTuning,
  validateNarrativeCopyTimings,
} from "../../components/experience/narrative-copy-timing";
import { narrativeScore } from "../../components/experience/narrative-score";

test.describe("narrative copy timing", () => {
  test("keeps one shared breathing length between all eleven stage timings", () => {
    expect(validateNarrativeCopyTimings()).toBe(true);
    const timings = narrativeScore.map((phase) => getNarrativeCopyTiming(phase.id));
    for (let index = 1; index < timings.length; index += 1) {
      expect(timings[index].enterStart - timings[index - 1].exitEnd).toBeCloseTo(
        narrativeCopyRhythm.breathing,
        8,
      );
    }
  });

  test("uses independently authored opening and closing breaths", () => {
    const loop = getNarrativeCopyTiming("loop");
    const arrival = getNarrativeCopyTiming("arrival");
    const openingBreath = narrativeCopyRhythm.breathing * narrativeCopyRhythm.openingBreathingRatio;
    const closingBreath = narrativeCopyRhythm.breathing * narrativeCopyRhythm.closingBreathingRatio;

    expect(arrival.enterStart).toBeCloseTo(openingBreath, 8);
    expect(narrativeCopyRhythm.loopBoundary - loop.exitEnd).toBeCloseTo(closingBreath, 8);
    expect(
      (narrativeCopyRhythm.loopBoundary - loop.exitEnd) + arrival.enterStart,
    ).toBeCloseTo(openingBreath + closingBreath, 8);
  });

  test("exposes independent animation tuning for every stage", () => {
    expect(Object.keys(narrativeCopyStageTuning)).toEqual(narrativeScore.map((phase) => phase.id));
    for (const phase of narrativeScore) {
      const timing = getNarrativeCopyTiming(phase.id);
      expect(timing.enterEnd).toBeLessThanOrEqual(phase.preview);
      expect(timing.exitStart).toBeGreaterThanOrEqual(phase.preview);
    }
  });
});
