import { narrativeScore, rangeProgress, smoothRange } from "../narrative-score";
import { interactionRuntime } from "./interaction-runtime";

const photoBeat = narrativeScore.find((beat) => beat.id === "activation")!;
const stageBeat = narrativeScore.find((beat) => beat.id === "reveal")!;
export const photoScrollTiming = {
  countdownStart: 0.08,
  capture: 0.28,
  deliveryEnd: 0.38,
  fadeStart: 0.56,
  fadeEnd: 0.72,
  countdownMs: 1500,
  deliveryMs: 550,
} as const;

export const scrollHoldTiming = {
  photoMs: photoScrollTiming.countdownMs + photoScrollTiming.deliveryMs + 550,
  stageMs: 2400,
  wheelThreshold: 360,
  touchThreshold: 180,
  interactionWheelThreshold: 1080,
  interactionTouchThreshold: 540,
} as const;

/** Pure scroll samples make forward, reverse, seeks, and fast passes identical. */
export function getScrollScenes(progress: number, overrides?: { photo?: number; stage?: number }) {
  const duration = photoBeat.end - photoBeat.start;
  const photo = overrides?.photo ?? rangeProgress(progress, [photoBeat.start + duration * 0.5, photoBeat.end - duration * 0.08]);
  const stageDuration = stageBeat.end - stageBeat.start;
  const stage = overrides?.stage ?? rangeProgress(progress, [stageBeat.start + stageDuration * 0.5, stageBeat.end - stageDuration * 0.05]);
  return {
    photo,
    photoVisibility: smoothRange(photo, [0.03, photoScrollTiming.countdownStart]) * (1 - smoothRange(photo, [photoScrollTiming.fadeStart, photoScrollTiming.fadeEnd])),
    photoStep: photo < photoScrollTiming.countdownStart || photo >= photoScrollTiming.fadeEnd ? "idle" as const : photo < photoScrollTiming.capture ? "countdown" as const : "captured" as const,
    photoCount: Math.max(1, 3 - Math.floor(rangeProgress(photo, [photoScrollTiming.countdownStart, photoScrollTiming.capture]) * 3)),
    stage,
    stageVisibility: smoothRange(stage, [0.08, 0.2]) * (1 - smoothRange(stage, [0.88, 1])),
    beams: Array.from({ length: 5 }, (_, index) => smoothRange(stage, [0.2 + index * 0.1, 0.34 + index * 0.1])),
  };
}

export function syncScrollScenes(progress: number) {
  const nativeStage = getScrollScenes(progress).stage;
  const frame = getScrollScenes(progress, {
    stage: interactionRuntime.activeStation === "stage" && interactionRuntime.stageHoldProgress !== null
      ? interactionRuntime.stageHoldProgress
      : nativeStage > 0 && nativeStage < 1 && interactionRuntime.stageHoldProgress !== null
      ? Math.max(nativeStage, interactionRuntime.stageHoldProgress)
      : nativeStage,
  });
  interactionRuntime.stageProgress = frame.stage;
  interactionRuntime.stageVisibility = frame.stageVisibility;
  interactionRuntime.beamIntensities = frame.beams;
  interactionRuntime.activeBeams = frame.beams.map((value) => value > 0.01);
  interactionRuntime.stageComplete = frame.stage >= 0.74 && frame.stage < 1;
}
