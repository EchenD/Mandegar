import { narrativeScore } from "../narrative-score";

const experiences = narrativeScore.find((beat) => beat.id === "experiences")!;

export function getAmbientGameVisibility(progress: number) {
  const amount = Math.max(0, Math.min(1, (progress - experiences.start) / (experiences.preview - experiences.start)));
  return amount * amount * (3 - 2 * amount);
}
