import { narrativeScore, rangeProgress, smoothRange } from "../narrative-score";
import { getNarrativeCopyTiming } from "../narrative-copy-timing";
import { interactionRuntime } from "./interaction-runtime";

const photoBeat = narrativeScore.find((beat) => beat.id === "activation")!;
const stageBeat = narrativeScore.find((beat) => beat.id === "reveal")!;
export const photoScrollTiming = {
  countdownStart: 0,
  capture: 0.28,
  deliveryEnd: 0.38,
  fadeStart: 0.56,
  fadeEnd: 0.72,
} as const;

export const scrollHoldTiming = {
  stageWheelStep: 120,
  stageTouchStep: 72,
  wheelThreshold: 360,
  touchThreshold: 180,
  interactionWheelThreshold: 1080,
  interactionTouchThreshold: 540,
} as const;

const photoDuration = photoBeat.end - photoBeat.start;
const photoRange = [photoBeat.start + photoDuration * 0.5, photoBeat.end - photoDuration * 0.08] as const;
const photoCaptureProgress = photoRange[0] + (photoRange[1] - photoRange[0]) * photoScrollTiming.capture;
const photoCopyTiming = getNarrativeCopyTiming("activation");

export function getPhotoScrollProgress(progress: number) {
  if (progress <= photoCopyTiming.enterStart) return 0;
  // Begin the countdown with the copy while retaining the existing capture,
  // flight and exit points along the authored camera animation.
  if (progress < photoCaptureProgress) {
    return rangeProgress(progress, [photoCopyTiming.enterStart, photoCaptureProgress]) * photoScrollTiming.capture;
  }
  return rangeProgress(progress, photoRange);
}

/** Pure scroll samples make forward, reverse, seeks, and fast passes identical. */
export function getScrollScenes(progress: number, overrides?: { photo?: number; stage?: number }) {
  const photo = overrides?.photo ?? getPhotoScrollProgress(progress);
  const stageDuration = stageBeat.end - stageBeat.start;
  const stage = overrides?.stage ?? rangeProgress(progress, [stageBeat.start + stageDuration * 0.5, stageBeat.end - stageDuration * 0.05]);
  return {
    photo,
    photoVisibility: smoothRange(photo, [0, 0.08]) * (1 - smoothRange(photo, [photoScrollTiming.fadeStart, photoScrollTiming.fadeEnd])),
    photoStep: photo <= photoScrollTiming.countdownStart || photo >= photoScrollTiming.fadeEnd ? "idle" as const : photo < photoScrollTiming.capture ? "countdown" as const : "captured" as const,
    photoCount: Math.max(1, 3 - Math.floor(rangeProgress(photo, [photoScrollTiming.countdownStart, photoScrollTiming.capture]) * 3)),
    stage,
    stageVisibility: smoothRange(stage, [0.08, 0.2]) * (1 - smoothRange(stage, [0.88, 1])),
    beams: Array.from({ length: 5 }, (_, index) => Math.max(0, Math.min(1, (stage - 0.2) / 0.12 - index))),
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
  interactionRuntime.stageComplete = frame.stage >= 0.8 - 0.000001 && frame.stage < 1;
}
