import { expect, test } from "@playwright/test";
import { getNarrativeCopyTiming, validateNarrativeCopyTimings } from "../../components/experience/narrative-copy-timing";
import { narrativeScore } from "../../components/experience/narrative-score";

test("copy appears only in its authored viewing window and leaves camera travel clear", () => {
  expect(validateNarrativeCopyTimings()).toBe(true);
  for (const phase of narrativeScore) {
    const timing = getNarrativeCopyTiming(phase.id);
    expect(timing.enterStart).toBeGreaterThanOrEqual(phase.start);
    expect(timing.exitEnd).toBeLessThanOrEqual(phase.end);
    expect(timing.enterEnd).toBeLessThanOrEqual(timing.exitStart);
  }
});

test("photo text begins at the Ready cue and a terminal loop does not introduce a new message", () => {
  expect(getNarrativeCopyTiming("activation").enterStart).toBe(520 / 2500);
  expect(getNarrativeCopyTiming("activation").exitEnd).toBe(700 / 2500);
  const loop = getNarrativeCopyTiming("loop");
  expect(loop.enterStart).toBe(1);
  expect(loop.exitEnd).toBe(1);
});
