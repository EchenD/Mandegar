import { experienceState } from "./experience-state";
import { getNarrativeFrame } from "./narrative-score";

/**
 * Computes the authored narrative once for a progress update and publishes the
 * same immutable frame to every renderer system.
 */
export function directNarrative(progress: number) {
  const frame = getNarrativeFrame(progress);
  experienceState.progress = frame.progress;
  experienceState.narrative = frame;
  return frame;
}

export function resetNarrative() {
  return directNarrative(0);
}
