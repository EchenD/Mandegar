import handoff from "../../Docs/CreativeProduction/camera-timing-handoff.template.json";
import { compileHeroTimeline, type ScenePhaseId } from "./hero-timeline";

// The same source frames are used by the camera, copy, effects and controls.
// camera:check verifies these against the GLB's actual binary keyframe times.
export const heroTimeline = compileHeroTimeline(handoff, {
  cameraNode: handoff.cameraNode,
  clipName: handoff.clipName,
  durationSeconds: (handoff.lastFrame - handoff.firstFrame) / handoff.fps,
});

export function getHeroPhase(id: ScenePhaseId) {
  return heroTimeline.phases.find((phase) => phase.id === id)!;
}

/** Retains the existing effect choreography around the revised viewing windows. */
export function retimeEffectProgress(progress: number) {
  const anchors = [
    { previous: 0, current: 0 },
    ...heroTimeline.phases.map((phase, index) => ({
      previous: (index + 0.5) / heroTimeline.phases.length,
      current: (phase.start + phase.end) / 2,
    })),
    { previous: 1, current: 1 },
  ];
  const nextIndex = anchors.findIndex((anchor) => anchor.previous >= progress);
  if (nextIndex <= 0) return nextIndex === 0 ? 0 : 1;
  const from = anchors[nextIndex - 1];
  const to = anchors[nextIndex];
  return from.current + (to.current - from.current) * (progress - from.previous) / (to.previous - from.previous);
}

export function retimeEffectRange(range: readonly [number, number]): readonly [number, number] {
  return [retimeEffectProgress(range[0]), retimeEffectProgress(range[1])];
}
