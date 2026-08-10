import { expect, test } from "@playwright/test";
import {
  getNearestNarrativeSnap,
  narrativeSnapTiming,
  shouldSnapNarrative,
} from "../../components/experience/scroll-snap";
import { narrativeScore } from "../../components/experience/narrative-score";

test.describe("narrative magnetic snapping", () => {
  test("uses the nine authored preview moments as resting points", () => {
    expect(narrativeScore).toHaveLength(9);
    narrativeScore.forEach((stage) => {
      expect(getNearestNarrativeSnap(stage.preview).id).toBe(stage.id);
      expect(shouldSnapNarrative(stage.preview, stage.preview)).toBe(false);
    });
  });

  test("chooses the nearest stage and uses intent to break exact ties", () => {
    const left = narrativeScore[2];
    const right = narrativeScore[3];
    const middle = (left.preview + right.preview) / 2;
    expect(getNearestNarrativeSnap(middle, -1).id).toBe(left.id);
    expect(getNearestNarrativeSnap(middle, 1).id).toBe(right.id);
  });

  test("waits two seconds and ignores already settled positions", () => {
    expect(narrativeSnapTiming.idleMs).toBe(2_000);
    expect(narrativeSnapTiming.durationSeconds).toBeGreaterThanOrEqual(1);
    expect(shouldSnapNarrative(0.5, 0.6)).toBe(true);
    expect(shouldSnapNarrative(0.5, 0.505)).toBe(false);
  });
});
