import { narrativeScore, type ScenePhaseId } from "./narrative-score";

export type NarrativeCopyTiming = {
  enterStart: number;
  enterEnd: number;
  exitStart: number;
  exitEnd: number;
  enterStagger: number;
  exitStagger: number;
};

export type NarrativeCopyStageTuning = {
  enterDuration: number;
  exitDuration: number;
  enterStagger: number;
  exitStagger: number;
};

/** One shared empty interval between every pair of messages. */
export const narrativeCopyRhythm = {
  breathing: 0.012,
  openingBreathingRatio: 3,
  closingBreathingRatio: 0.5,
  loopBoundary: 0.984,
} as const;

/** Per-stage animation character; these values never change the shared breathing gaps. */
export const narrativeCopyStageTuning = {
  arrival: { enterDuration: 0.016, exitDuration: 0.016, enterStagger: 0.003, exitStagger: 0.002 },
  discovery: { enterDuration: 0.016, exitDuration: 0.016, enterStagger: 0.004, exitStagger: 0.002 },
  activation: { enterDuration: 0.016, exitDuration: 0.016, enterStagger: 0.004, exitStagger: 0.002 },
  reveal: { enterDuration: 0.016, exitDuration: 0.016, enterStagger: 0.004, exitStagger: 0.002 },
  experiences: { enterDuration: 0.016, exitDuration: 0.016, enterStagger: 0.004, exitStagger: 0.002 },
  proof: { enterDuration: 0.016, exitDuration: 0.016, enterStagger: 0.004, exitStagger: 0.002 },
  intelligence: { enterDuration: 0.016, exitDuration: 0.016, enterStagger: 0.004, exitStagger: 0.002 },
  invitation: { enterDuration: 0.016, exitDuration: 0.016, enterStagger: 0.004, exitStagger: 0.002 },
  loop: { enterDuration: 0.016, exitDuration: 0.016, enterStagger: 0.004, exitStagger: 0.002 },
} as const satisfies Record<ScenePhaseId, NarrativeCopyStageTuning>;

export function getNarrativeCopyTiming(phaseId: ScenePhaseId): NarrativeCopyTiming {
  const index = narrativeScore.findIndex((item) => item.id === phaseId);
  if (index < 0) throw new Error(`Narrative copy timing is missing phase '${phaseId}'.`);
  const phase = narrativeScore[index];
  const previous = narrativeScore[index - 1];
  const next = narrativeScore[index + 1];
  const tuning = narrativeCopyStageTuning[phaseId];
  const halfBreath = narrativeCopyRhythm.breathing * 0.5;
  const openingBreath = narrativeCopyRhythm.breathing * narrativeCopyRhythm.openingBreathingRatio;
  const closingBreath = narrativeCopyRhythm.breathing * narrativeCopyRhythm.closingBreathingRatio;
  const leftBoundary = previous ? (previous.preview + phase.preview) * 0.5 : 0;
  const rightBoundary = next
    ? (phase.preview + next.preview) * 0.5
    : narrativeCopyRhythm.loopBoundary;
  const enterStart = previous ? leftBoundary + halfBreath : openingBreath;
  const exitEnd = next ? rightBoundary - halfBreath : rightBoundary - closingBreath;

  return {
    enterStart,
    enterEnd: Math.min(phase.preview, enterStart + tuning.enterDuration),
    exitStart: Math.max(phase.preview, exitEnd - tuning.exitDuration),
    exitEnd,
    enterStagger: tuning.enterStagger,
    exitStagger: tuning.exitStagger,
  };
}

export function validateNarrativeCopyTimings() {
  const timings = narrativeScore.map((phase) => getNarrativeCopyTiming(phase.id));
  timings.forEach((timing, index) => {
    const phase = narrativeScore[index];
    if (!(timing.enterStart < timing.enterEnd && timing.enterEnd <= phase.preview)) {
      throw new Error(`Narrative copy '${phase.id}' must finish entering by its resting point.`);
    }
    if (!(phase.preview <= timing.exitStart && timing.exitStart < timing.exitEnd)) {
      throw new Error(`Narrative copy '${phase.id}' must begin exiting after its resting point.`);
    }
    if (index > 0) {
      const gap = timing.enterStart - timings[index - 1].exitEnd;
      if (Math.abs(gap - narrativeCopyRhythm.breathing) > 0.000001) {
        throw new Error(`Narrative copy gap before '${phase.id}' does not match the shared breathing length.`);
      }
    }
  });
  const openingBreath = narrativeCopyRhythm.breathing * narrativeCopyRhythm.openingBreathingRatio;
  const closingBreath = narrativeCopyRhythm.breathing * narrativeCopyRhythm.closingBreathingRatio;
  if (Math.abs(timings[0].enterStart - openingBreath) > 0.000001) {
    throw new Error("Arrival does not preserve the opening breathing length.");
  }
  if (Math.abs(narrativeCopyRhythm.loopBoundary - timings[timings.length - 1].exitEnd - closingBreath) > 0.000001) {
    throw new Error("Loop does not preserve the closing breathing length.");
  }
  return true;
}

if (process.env.NODE_ENV !== "production") validateNarrativeCopyTimings();
