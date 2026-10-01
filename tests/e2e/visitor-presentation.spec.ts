import { expect, test } from "@playwright/test";
import { narrativeScore } from "../../components/experience/narrative-score";
import { getVisitorPresentation } from "../../components/experience/interactions/visitor-presentation";

const chapter = (id: string) => narrativeScore.find((beat) => beat.id === id)!;

test("saved effects leave the earlier story clear and return in their own chapters", () => {
  expect(getVisitorPresentation(chapter("activation").preview)).toMatchObject({
    composerVisibility: 0, lightingVisibility: 0, drawingVisibility: 0, lightingPlayback: false,
  });
  expect(getVisitorPresentation(chapter("engagement").preview)).toMatchObject({
    composerVisibility: 1, lightingVisibility: 0, drawingVisibility: 0,
  });
  expect(getVisitorPresentation(chapter("reveal").preview).lightingVisibility).toBe(1);
  expect(getVisitorPresentation(chapter("connection").preview).drawingVisibility).toBe(1);
});

test("lighting stops at Intelligence while artwork remains until the return to the opening", () => {
  expect(getVisitorPresentation(chapter("proof").preview).lightingPlayback).toBe(true);
  expect(getVisitorPresentation(chapter("intelligence").start)).toMatchObject({
    lightingVisibility: 0, lightingPlayback: false, composerVisibility: 0, drawingVisibility: 1,
  });
  expect(getVisitorPresentation(chapter("loop").start).drawingVisibility).toBe(0);
});

test("forward and reverse scroll use the same smooth presentation", () => {
  const samples = Array.from({ length: 301 }, (_, index) => index / 300);
  const forward = samples.map(getVisitorPresentation);
  const backward = samples.toReversed().map(getVisitorPresentation).toReversed();
  expect(backward).toEqual(forward);
  for (let index = 1; index < forward.length; index += 1) {
    for (const field of ["lightingVisibility", "composerVisibility", "drawingVisibility"] as const) {
      expect(Math.abs(forward[index][field] - forward[index - 1][field])).toBeLessThan(0.25);
    }
  }
});
