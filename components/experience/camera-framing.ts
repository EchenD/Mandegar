import * as THREE from "three";
import type { ScenePhaseId } from "./hero-timeline";
import { heroTimeline } from "./hero-timeline-config";

// Horizontal framing at the authored lens. Close stations need less of the
// surrounding hall; establishing shots retain the original landscape width.
export const mobileCameraFraming = {
  arrival: 16 / 9,
  discovery: 1.6,
  activation: 1.6,
  engagement: 1.1,
  reveal: 16 / 9,
  experiences: 1.1,
  connection: 1.05,
  proof: 1.55,
  intelligence: 16 / 9,
  invitation: 1.7,
  loop: 16 / 9,
} as const satisfies Record<ScenePhaseId, number>;

const widestMobileFramingAspect = Math.max(...Object.values(mobileCameraFraming));

function sampleMobileFraming(progress: number, project: (aspect: number, phase: ScenePhaseId) => number) {
  const safe = Number.isFinite(progress) ? THREE.MathUtils.clamp(progress, 0, 1) : 0;
  for (let index = 0; index < heroTimeline.phases.length - 1; index += 1) {
    const current = heroTimeline.phases[index];
    const next = heroTimeline.phases[index + 1];
    const from = project(mobileCameraFraming[current.id], current.id);
    if (safe <= current.end) return from;
    if (safe < next.start) {
      const amount = (safe - current.end) / (next.start - current.end);
      // Zero velocity and acceleration at either end of the camera travel.
      const eased = THREE.MathUtils.smootherstep(amount, 0, 1);
      return THREE.MathUtils.lerp(from, project(mobileCameraFraming[next.id], next.id), eased);
    }
  }
  return project(mobileCameraFraming.loop, "loop");
}

export function getMobileCameraFramingAspect(progress: number) {
  return sampleMobileFraming(progress, (aspect) => aspect);
}

export function getResponsiveCameraFov(fov: number, width: number, height: number, progress = 0) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0
    || !Number.isFinite(fov) || fov <= 0 || fov >= 180) return fov;
  const aspect = width / height;
  // Fade into desktop framing instead of jumping at a width or orientation
  // breakpoint. Portrait tablets and narrow windows retain the mobile lens.
  const widthBlend = 1 - THREE.MathUtils.smootherstep(width, 760, 960);
  const portraitBlend = 1 - THREE.MathUtils.smootherstep(aspect, 0.9, 1.25);
  const blend = 1 - (1 - widthBlend) * (1 - portraitBlend);
  if (blend === 0) return fov;
  const authoredSlope = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
  const widestSlope = Math.min(
    authoredSlope * widestMobileFramingAspect / aspect,
    Math.tan(THREE.MathUtils.degToRad(Math.max(fov, 100)) / 2),
  );
  // Bound each phase before easing. Clamping the moving lens would flatten
  // tall-phone transitions and create a velocity kink when the cap releases.
  const shortGameBlend = 1 - THREE.MathUtils.smootherstep(height, 600, 760);
  const mobileSlope = sampleMobileFraming(progress, (framingAspect, phase) => {
    // The tall game screen needs room for its title, instructions and dock on
    // shorter phones. Fit its endpoints before easing the scroll transition.
    const fittedAspect = phase === "experiences"
      ? THREE.MathUtils.lerp(framingAspect, 1.25, shortGameBlend)
      : framingAspect;
    return Math.max(authoredSlope, widestSlope * fittedAspect / widestMobileFramingAspect);
  });
  const responsive = THREE.MathUtils.radToDeg(2 * Math.atan(THREE.MathUtils.lerp(authoredSlope, mobileSlope, blend)));
  return Math.min(Math.max(fov, 100), responsive);
}
