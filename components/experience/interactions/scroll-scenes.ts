import { rangeProgress, smoothRange } from "../narrative-score";
import { getHeroPhase, heroTimeline } from "../hero-timeline-config";
import { interactionRuntime } from "./interaction-runtime";

const photoBeat = getHeroPhase("activation");
const stageBeat = getHeroPhase("reveal");
const cues = heroTimeline.cues;
export const photoScrollTiming = {
  countdownStart: 0,
  capture: 0.28,
  deliveryEnd: 0.38,
  fadeStart: 0.56,
  fadeEnd: 1,
} as const;

const photoAnchors = [
  [cues.photoTextReady, 0],
  [cues.photoCapture, photoScrollTiming.capture],
  [cues.photoDelivered, photoScrollTiming.deliveryEnd],
  [cues.photoDelivered + (cues.photoExit - cues.photoDelivered) * 0.65, photoScrollTiming.fadeStart],
  [cues.photoExit, photoScrollTiming.fadeEnd],
] as const;

export function getPhotoScrollProgress(progress: number) {
  if (progress <= photoAnchors[0][0]) return 0;
  const index = photoAnchors.findIndex(([at]) => progress <= at);
  if (index < 0) return 1;
  const [start, from] = photoAnchors[index - 1];
  const [end, to] = photoAnchors[index];
  return from + (to - from) * rangeProgress(progress, [start, end]);
}

/** Pure source-frame samples make forward, reverse, seeks and fast passes identical. */
export function getScrollScenes(progress: number, overrides?: { photo?: number; stage?: number }) {
  const photo = overrides?.photo ?? getPhotoScrollProgress(progress);
  const stage = overrides?.stage ?? rangeProgress(progress, [stageBeat.start, stageBeat.end]);
  const frameSpan = heroTimeline.lastFrame - heroTimeline.firstFrame;
  const lampFade = 8 / frameSpan;
  return {
    photo,
    photoVisibility: smoothRange(photo, [0, 0.08]) * (1 - smoothRange(photo, [photoScrollTiming.fadeStart, photoScrollTiming.fadeEnd])),
    photoStep: photo <= 0 || photo >= photoScrollTiming.fadeEnd ? "idle" as const : photo < photoScrollTiming.capture ? "countdown" as const : "captured" as const,
    photoCount: 1,
    stage,
    stageVisibility: smoothRange(progress, [stageBeat.start, stageBeat.start + lampFade])
      * (1 - smoothRange(progress, [stageBeat.end - lampFade, stageBeat.end])),
    beams: [cues.lightingBeam1, cues.lightingBeam2, cues.lightingBeam3, cues.lightingBeam4, cues.lightingBeam5]
      .map((at) => smoothRange(progress, [at, at + lampFade])),
    photoWindow: progress >= photoBeat.start && progress <= photoBeat.end,
  };
}

export function syncScrollScenes(progress: number) {
  const frame = getScrollScenes(progress);
  interactionRuntime.stageProgress = frame.stage;
  interactionRuntime.stageVisibility = frame.stageVisibility;
  interactionRuntime.beamIntensities = frame.beams;
  interactionRuntime.activeBeams = frame.beams.map((value) => value > 0.01);
  interactionRuntime.stageComplete = frame.beams.every((value) => value === 1) && progress <= stageBeat.end;
}
