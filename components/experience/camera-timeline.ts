import { narrativeScore, type ScenePhaseId } from "./narrative-score";

/** Existing clip compositions, preserved while the revised camera is authored. */
export const cameraRestingClipProgress = {
  arrival: 0.05,
  discovery: 0.175,
  activation: 0.31,
  engagement: 0.37,
  reveal: 0.455,
  experiences: 0.58,
  connection: 0.625,
  proof: 0.7,
  intelligence: 0.8,
  invitation: 0.885,
  loop: 0.965,
} as const satisfies Record<ScenePhaseId, number>;

export const cameraTimelineAnchors = [
  { id: "start", narrativeProgress: 0, clipProgress: 0 },
  ...narrativeScore.map((stage) => ({
    id: stage.id,
    narrativeProgress: stage.preview,
    clipProgress: cameraRestingClipProgress[stage.id],
  })),
  { id: "end", narrativeProgress: 1, clipProgress: 1 },
] as const;

/** Maps the current narrative playhead to the authored clip without adding easing. */
export function getCameraLoopSampleProgress(progress: number) {
  const safeProgress = Math.min(1, Math.max(0, progress));
  const nextIndex = cameraTimelineAnchors.findIndex((anchor) => anchor.narrativeProgress >= safeProgress);
  if (nextIndex <= 0) return cameraTimelineAnchors[0].clipProgress;
  const from = cameraTimelineAnchors[nextIndex - 1];
  const to = cameraTimelineAnchors[nextIndex];
  const timelineSpan = Math.max(0.0001, to.narrativeProgress - from.narrativeProgress);
  const mix = (safeProgress - from.narrativeProgress) / timelineSpan;
  return from.clipProgress + (to.clipProgress - from.clipProgress) * mix;
}
