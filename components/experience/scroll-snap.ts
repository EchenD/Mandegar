import { narrativeScore } from "./narrative-score";

export const narrativeSnapTiming = {
  idleMs: 2_000,
  durationSeconds: 1.2,
  settledTolerance: 0.008,
} as const;

export function getNearestNarrativeSnap(progress: number, direction = 0) {
  const safeProgress = Math.min(1, Math.max(0, progress));
  return narrativeScore.reduce((nearest, candidate) => {
    const nearestDistance = Math.abs(nearest.preview - safeProgress);
    const candidateDistance = Math.abs(candidate.preview - safeProgress);
    if (candidateDistance < nearestDistance - 0.000001) return candidate;
    if (Math.abs(candidateDistance - nearestDistance) <= 0.000001) {
      if (direction > 0 && candidate.preview > nearest.preview) return candidate;
      if (direction < 0 && candidate.preview < nearest.preview) return candidate;
    }
    return nearest;
  }, narrativeScore[0]);
}

export function shouldSnapNarrative(progress: number, target: number) {
  return Math.abs(progress - target) > narrativeSnapTiming.settledTolerance;
}
