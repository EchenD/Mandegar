import { narrativeScore } from "../narrative-score";

const engagement = narrativeScore.find((beat) => beat.id === "engagement")!;
const reveal = narrativeScore.find((beat) => beat.id === "reveal")!;
const connection = narrativeScore.find((beat) => beat.id === "connection")!;
const intelligence = narrativeScore.find((beat) => beat.id === "intelligence")!;
const invitation = narrativeScore.find((beat) => beat.id === "invitation")!;
const loop = narrativeScore.find((beat) => beat.id === "loop")!;

function fade(progress: number, start: number, end: number) {
  const amount = Math.max(0, Math.min(1, (progress - start) / Math.max(0.0001, end - start)));
  return amount * amount * (3 - 2 * amount);
}

/** Saved choices survive the visit; their presentation follows the scroll in either direction. */
export function getVisitorPresentation(progress: number) {
  const untilIntelligence = 1 - fade(progress, intelligence.start - 0.02, intelligence.start);
  const lightingVisibility = fade(progress, reveal.start, reveal.preview) * untilIntelligence;
  return {
    lightingVisibility,
    lightingPlayback: lightingVisibility > 0,
    composerVisibility: fade(progress, engagement.start, engagement.preview) * untilIntelligence,
    drawingVisibility: fade(progress, connection.start, connection.preview)
      * (1 - fade(progress, invitation.start, loop.start)),
  };
}
