import { narrativeScore, type ScenePhaseId } from "./narrative-score";
import { heroTimeline } from "./hero-timeline-config";

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
  engagement: { enterDuration: 0.016, exitDuration: 0.016, enterStagger: 0.004, exitStagger: 0.002 },
  reveal: { enterDuration: 0.016, exitDuration: 0.016, enterStagger: 0.004, exitStagger: 0.002 },
  experiences: { enterDuration: 0.016, exitDuration: 0.016, enterStagger: 0.004, exitStagger: 0.002 },
  connection: { enterDuration: 0.016, exitDuration: 0.016, enterStagger: 0.004, exitStagger: 0.002 },
  proof: { enterDuration: 0.016, exitDuration: 0.016, enterStagger: 0.004, exitStagger: 0.002 },
  intelligence: { enterDuration: 0.016, exitDuration: 0.016, enterStagger: 0.004, exitStagger: 0.002 },
  invitation: { enterDuration: 0.016, exitDuration: 0.016, enterStagger: 0.004, exitStagger: 0.002 },
  loop: { enterDuration: 0.016, exitDuration: 0.016, enterStagger: 0.004, exitStagger: 0.002 },
} as const satisfies Record<ScenePhaseId, NarrativeCopyStageTuning>;

export function getNarrativeCopyTiming(phaseId: ScenePhaseId): NarrativeCopyTiming {
  const phase = narrativeScore.find((item) => item.id === phaseId);
  if (!phase) throw new Error(`Narrative copy timing is missing phase '${phaseId}'.`);
  const tuning = narrativeCopyStageTuning[phaseId];
  const enterStart = phaseId === "activation" ? heroTimeline.cues.photoTextReady : phase.start;
  const span = Math.max(0, phase.end - enterStart);
  const enterDuration = Math.min(tuning.enterDuration, span * 0.25);
  const exitDuration = Math.min(tuning.exitDuration, span * 0.25);
  return {
    enterStart,
    enterEnd: enterStart + enterDuration,
    exitStart: phase.end - exitDuration,
    exitEnd: phase.end,
    enterStagger: Math.min(tuning.enterStagger, enterDuration * 0.5),
    exitStagger: Math.min(tuning.exitStagger, exitDuration * 0.5),
  };
}

export function validateNarrativeCopyTimings() {
  narrativeScore.forEach((phase) => {
    const timing = getNarrativeCopyTiming(phase.id);
    if (!(phase.start <= timing.enterStart && timing.enterStart <= timing.enterEnd
      && timing.enterEnd <= timing.exitStart && timing.exitStart <= timing.exitEnd && timing.exitEnd <= phase.end)) {
      throw new Error(`Narrative copy '${phase.id}' must stay inside its authored viewing window.`);
    }
  });
  return true;
}

if (process.env.NODE_ENV !== "production") validateNarrativeCopyTimings();
