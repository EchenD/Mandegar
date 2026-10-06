import type { ScenePhaseId } from "./hero-timeline";
import { heroTimeline, retimeEffectRange } from "./hero-timeline-config";

export type { ScenePhaseId } from "./hero-timeline";

export type NarrativeAttention =
  | "space"
  | "signal"
  | "systems"
  | "engagement"
  | "reveal"
  | "zones"
  | "connection"
  | "projects"
  | "data"
  | "invitation"
  | "return";

export type NarrativeInteraction = "none" | "subtle" | "zones" | "projects" | "cta";

export type NarrativeChannel =
  | "architecture"
  | "signal"
  | "screens"
  | "audience"
  | "color"
  | "intelligence"
  | "annotations";

export type NarrativeBeat = {
  id: ScenePhaseId;
  start: number;
  end: number;
  preview: number;
  transitionEnd: number;
  attention: NarrativeAttention;
  interaction: NarrativeInteraction;
  cameraShot: string;
  assets: readonly string[];
  channels: readonly NarrativeChannel[];
};

export const narrativeStageCount = heroTimeline.phases.length;

function getAuthoredStageTiming(index: number) {
  const { start, end, preview, transitionEnd } = heroTimeline.phases[index];
  return { start, end, preview, transitionEnd };
}

/**
 * The authored story score is the single source of truth for phase order,
 * phase boundaries, review checkpoints, and the intended owner of attention.
 * Viewing windows and camera travel follow the source animation frames.
 */
export const narrativeScore = [
  {
    id: "arrival",
    ...getAuthoredStageTiming(0),
    attention: "space",
    interaction: "subtle",
    cameraShot: "arrival-wide",
    assets: ["arrival"],
    channels: ["architecture"],
  },
  {
    id: "discovery",
    ...getAuthoredStageTiming(1),
    attention: "signal",
    interaction: "subtle",
    cameraShot: "discovery-approach",
    assets: ["arrival"],
    channels: ["architecture", "signal", "screens"],
  },
  {
    id: "activation",
    ...getAuthoredStageTiming(2),
    attention: "systems",
    interaction: "subtle",
    cameraShot: "activation-traverse",
    assets: ["arrival", "activation"],
    channels: ["architecture", "signal", "screens"],
  },
  {
    id: "engagement",
    ...getAuthoredStageTiming(3),
    attention: "engagement",
    interaction: "subtle",
    cameraShot: "engagement-focus",
    assets: ["arrival", "activation"],
    channels: ["architecture", "signal", "screens", "audience"],
  },
  {
    id: "reveal",
    ...getAuthoredStageTiming(4),
    attention: "reveal",
    interaction: "none",
    cameraShot: "full-reveal",
    assets: ["arrival", "activation"],
    channels: ["architecture", "signal", "screens", "audience", "color"],
  },
  {
    id: "experiences",
    ...getAuthoredStageTiming(5),
    attention: "zones",
    interaction: "zones",
    cameraShot: "experience-zones",
    assets: ["arrival", "activation", "zones"],
    channels: ["architecture", "signal", "screens", "audience", "annotations"],
  },
  {
    id: "connection",
    ...getAuthoredStageTiming(6),
    attention: "connection",
    interaction: "zones",
    cameraShot: "connected-journey",
    assets: ["arrival", "activation", "zones"],
    channels: ["architecture", "signal", "screens", "audience", "annotations"],
  },
  {
    id: "proof",
    ...getAuthoredStageTiming(7),
    attention: "projects",
    interaction: "projects",
    cameraShot: "project-proof",
    assets: ["arrival", "activation", "zones", "projects"],
    channels: ["architecture", "signal", "screens", "audience", "annotations"],
  },
  {
    id: "intelligence",
    ...getAuthoredStageTiming(8),
    attention: "data",
    interaction: "subtle",
    cameraShot: "event-intelligence",
    assets: ["arrival", "activation", "intelligence"],
    channels: ["architecture", "signal", "intelligence", "annotations"],
  },
  {
    id: "invitation",
    ...getAuthoredStageTiming(9),
    attention: "invitation",
    interaction: "cta",
    cameraShot: "invitation-hold",
    assets: ["arrival", "activation"],
    channels: ["architecture", "signal"],
  },
  {
    id: "loop",
    ...getAuthoredStageTiming(10),
    attention: "return",
    interaction: "subtle",
    cameraShot: "loop-return",
    assets: ["arrival"],
    channels: ["architecture", "signal"],
  },
] as const satisfies readonly NarrativeBeat[];

/** Existing effect cues, centralized here while their visual values are preserved. */
export const narrativeCueRanges = {
  lightTrails: retimeEffectRange([0.081818, 0.166667]),
  screens: [
    retimeEffectRange([0.153199, 0.207071]),
    retimeEffectRange([0.186869, 0.257576]),
    retimeEffectRange([0.213805, 0.318182]),
  ],
  mediaWall: retimeEffectRange([0.213805, 0.328877]),
  booths: retimeEffectRange([0.272727, 0.382353]),
  branding: retimeEffectRange([0.328877, 0.42]),
  audience: retimeEffectRange([0.360963, 0.449091]),
  totalReveal: retimeEffectRange([0.350267, 0.456364]),
  intelligence: retimeEffectRange([0.709091, 0.794118]),
  haloCondense: retimeEffectRange([0.794118, 0.892045]),
  loopReset: [heroTimeline.cues.heroHandoffStart, heroTimeline.cues.heroHandoffEnd],
} as const;

export const narrativeMoments = {
  livingWorld: {
    enter: retimeEffectRange([0.30303, 0.441818]),
    exit: retimeEffectRange([0.815508, 0.914773]),
  },
  peakReveal: {
    enter: retimeEffectRange([0.355615, 0.416364]),
    exit: retimeEffectRange([0.445455, 0.492727]),
  },
} as const;

export type NarrativeFrame = {
  progress: number;
  phase: ScenePhaseId;
  phaseProgress: number;
  attention: NarrativeAttention;
  interaction: NarrativeInteraction;
  cameraShot: string;
  assets: readonly string[];
  channels: readonly NarrativeChannel[];
  living: number;
  peak: number;
  energy: number;
  reset: number;
};

export function clampNarrativeProgress(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function rangeProgress(value: number, range: readonly [number, number]) {
  const span = Math.max(0.0001, range[1] - range[0]);
  return clampNarrativeProgress((value - range[0]) / span);
}

export function smoothRange(value: number, range: readonly [number, number]) {
  const progress = rangeProgress(value, range);
  return progress * progress * (3 - 2 * progress);
}

export function getNarrativeBeat(progress: number): NarrativeBeat {
  const safeProgress = clampNarrativeProgress(progress);
  return narrativeScore.reduce<NarrativeBeat>(
    (active, beat) => safeProgress >= beat.start ? beat : active,
    narrativeScore[0],
  );
}

export function getNarrativeFrame(progress: number): NarrativeFrame {
  const safeProgress = clampNarrativeProgress(progress);
  const beat = getNarrativeBeat(safeProgress);
  const reset = smoothRange(safeProgress, narrativeCueRanges.loopReset);
  const living = smoothRange(safeProgress, narrativeMoments.livingWorld.enter)
    * (1 - smoothRange(safeProgress, narrativeMoments.livingWorld.exit))
    * (1 - reset);
  const peak = smoothRange(safeProgress, narrativeMoments.peakReveal.enter)
    * (1 - smoothRange(safeProgress, narrativeMoments.peakReveal.exit))
    * (1 - reset);
  return {
    progress: safeProgress,
    phase: beat.id,
    phaseProgress: rangeProgress(safeProgress, [beat.start, beat.end]),
    attention: beat.attention,
    interaction: beat.interaction,
    cameraShot: beat.cameraShot,
    assets: beat.assets,
    channels: beat.channels,
    living,
    peak,
    energy: Math.min(1, Math.max(living * 0.72, peak)),
    reset,
  };
}

export function getNarrativePreview(value: string | null) {
  const beat = narrativeScore.find((beat) => beat.id === value);
  return beat?.preview;
}

export function validateNarrativeScore(score: readonly NarrativeBeat[] = narrativeScore) {
  if (score.length === 0) throw new Error("Narrative score must contain at least one beat.");
  const ids = new Set<ScenePhaseId>();
  score.forEach((beat, index) => {
    if (ids.has(beat.id)) throw new Error(`Narrative beat '${beat.id}' is duplicated.`);
    ids.add(beat.id);
    if (beat.start < 0 || beat.end > 1 || (beat.start > beat.end || beat.start === beat.end && beat.id !== "loop")) {
      throw new Error(`Narrative beat '${beat.id}' has an invalid range.`);
    }
    if (beat.preview < beat.start || beat.preview > beat.end) {
      throw new Error(`Narrative beat '${beat.id}' preview is outside its range.`);
    }
    if (index > 0 && score[index - 1].end > beat.start) {
      throw new Error(`Narrative beat ${beat.id} overlaps the previous viewing window.`);
    }
  });
  if (score[0].start !== 0 || score[score.length - 1].end !== 1) {
    throw new Error("Narrative score must cover normalized progress from 0 to 1.");
  }
  return true;
}

if (process.env.NODE_ENV !== "production") validateNarrativeScore();
