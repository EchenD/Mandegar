import { expect, test } from "@playwright/test";
import { getNarrativeBeat, getNarrativeFrame, narrativeScore, validateNarrativeScore } from "../../components/experience/narrative-score";
import { heroTimeline } from "../../components/experience/hero-timeline-config";

test("hero chapters use the authored windows and retain the camera travel between them", () => {
  expect(validateNarrativeScore()).toBe(true);
  const photo = narrativeScore.find((beat) => beat.id === "activation")!;
  expect(photo.start).toBe(500 / 2500);
  expect(photo.end).toBe(700 / 2500);
  expect(getNarrativeBeat(750 / 2500).id).toBe("activation");
  expect(getNarrativeBeat(800 / 2500).id).toBe("engagement");
  expect(photo.transitionEnd).toBe(800 / 2500);
});

test("all review checkpoints select the same authored chapter in either direction", () => {
  for (const beat of [...narrativeScore, ...[...narrativeScore].reverse()]) {
    expect(getNarrativeBeat(beat.preview).id).toBe(beat.id);
    expect(getNarrativeFrame(beat.preview).phase).toBe(beat.id);
  }
  expect(narrativeScore.map((beat) => beat.id)).toEqual(heroTimeline.phases.map((phase) => phase.id));
});

test("the final loop checkpoint settles every effect without an extra chapter of scroll", () => {
  const last = narrativeScore.at(-1)!;
  expect(last.start).toBe(1);
  expect(last.end).toBe(1);
  const end = getNarrativeFrame(1);
  expect(end.living).toBe(0);
  expect(end.peak).toBe(0);
  expect(end.reset).toBe(1);
});
