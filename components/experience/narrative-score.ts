export type ScenePhaseId =
  | "arrival"
  | "discovery"
  | "activation"
  | "engagement"
  | "reveal"
  | "experiences"
  | "connection"
  | "proof"
  | "intelligence"
  | "invitation"
  | "loop";

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
  attention: NarrativeAttention;
  interaction: NarrativeInteraction;
  cameraShot: string;
  assets: readonly string[];
  channels: readonly NarrativeChannel[];
};

export const narrativeStageCount = 11;
export const narrativeStageDuration = 1 / narrativeStageCount;

function getEqualStageTiming(index: number) {
  return {
    start: index * narrativeStageDuration,
    end: (index + 1) * narrativeStageDuration,
    preview: (index + 0.5) * narrativeStageDuration,
  };
}

/**
 * The authored story score is the single source of truth for phase order,
 * phase boundaries, review checkpoints, and the intended owner of attention.
 * Every stage owns the same amount of physical scroll time.
 */
export const narrativeScore = [
  {
    id: "arrival",
    ...getEqualStageTiming(0),
    attention: "space",
    interaction: "subtle",
    cameraShot: "arrival-wide",
    assets: ["arrival"],
    channels: ["architecture"],
  },
  {
    id: "discovery",
    ...getEqualStageTiming(1),
    attention: "signal",
    interaction: "subtle",
    cameraShot: "discovery-approach",
    assets: ["arrival"],
    channels: ["architecture", "signal", "screens"],
  },
  {
    id: "activation",
    ...getEqualStageTiming(2),
    attention: "systems",
    interaction: "subtle",
    cameraShot: "activation-traverse",
    assets: ["arrival", "activation"],
    channels: ["architecture", "signal", "screens"],
  },
  {
    id: "engagement",
    ...getEqualStageTiming(3),
    attention: "engagement",
    interaction: "subtle",
    cameraShot: "engagement-focus",
    assets: ["arrival", "activation"],
    channels: ["architecture", "signal", "screens", "audience"],
  },
  {
    id: "reveal",
    ...getEqualStageTiming(4),
    attention: "reveal",
    interaction: "none",
    cameraShot: "full-reveal",
    assets: ["arrival", "activation"],
    channels: ["architecture", "signal", "screens", "audience", "color"],
  },
  {
    id: "experiences",
    ...getEqualStageTiming(5),
    attention: "zones",
    interaction: "zones",
    cameraShot: "experience-zones",
    assets: ["arrival", "activation", "zones"],
    channels: ["architecture", "signal", "screens", "audience", "annotations"],
  },
  {
    id: "connection",
    ...getEqualStageTiming(6),
    attention: "connection",
    interaction: "zones",
    cameraShot: "connected-journey",
    assets: ["arrival", "activation", "zones"],
    channels: ["architecture", "signal", "screens", "audience", "annotations"],
  },
  {
    id: "proof",
    ...getEqualStageTiming(7),
    attention: "projects",
    interaction: "projects",
    cameraShot: "project-proof",
    assets: ["arrival", "activation", "zones", "projects"],
    channels: ["architecture", "signal", "screens", "audience", "annotations"],
  },
  {
    id: "intelligence",
    ...getEqualStageTiming(8),
    attention: "data",
    interaction: "subtle",
    cameraShot: "event-intelligence",
    assets: ["arrival", "activation", "intelligence"],
    channels: ["architecture", "signal", "intelligence", "annotations"],
  },
  {
    id: "invitation",
    ...getEqualStageTiming(9),
    attention: "invitation",
    interaction: "cta",
    cameraShot: "invitation-hold",
    assets: ["arrival", "activation"],
    channels: ["architecture", "signal"],
  },
  {
    id: "loop",
    ...getEqualStageTiming(10),
    attention: "return",
    interaction: "subtle",
    cameraShot: "loop-return",
    assets: ["arrival"],
    channels: ["architecture", "signal"],
  },
] as const satisfies readonly NarrativeBeat[];

/** Existing effect cues, centralized here while their visual values are preserved. */
export const narrativeCueRanges = {
  lightTrails: [0.081818, 0.166667],
  screens: [
    [0.153199, 0.207071],
    [0.186869, 0.257576],
    [0.213805, 0.318182],
  ],
  mediaWall: [0.213805, 0.328877],
  booths: [0.272727, 0.382353],
  branding: [0.328877, 0.42],
  audience: [0.360963, 0.449091],
  totalReveal: [0.350267, 0.456364],
  intelligence: [0.709091, 0.794118],
  haloCondense: [0.794118, 0.892045],
  loopReset: [0.976623, 1],
} as const;

export const narrativeMoments = {
  livingWorld: {
    enter: [0.30303, 0.441818],
    exit: [0.815508, 0.914773],
  },
  peakReveal: {
    enter: [0.355615, 0.416364],
    exit: [0.445455, 0.492727],
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
  return narrativeScore.find((beat) => beat.id === value)?.preview;
}

export function validateNarrativeScore(score: readonly NarrativeBeat[] = narrativeScore) {
  if (score.length === 0) throw new Error("Narrative score must contain at least one beat.");
  const ids = new Set<ScenePhaseId>();
  score.forEach((beat, index) => {
    if (ids.has(beat.id)) throw new Error(`Narrative beat '${beat.id}' is duplicated.`);
    ids.add(beat.id);
    if (beat.start < 0 || beat.end > 1 || beat.start >= beat.end) {
      throw new Error(`Narrative beat '${beat.id}' has an invalid range.`);
    }
    if (beat.preview < beat.start || beat.preview > beat.end) {
      throw new Error(`Narrative beat '${beat.id}' preview is outside its range.`);
    }
    if (Math.abs((beat.end - beat.start) - narrativeStageDuration) > 0.000001) {
      throw new Error(`Narrative beat '${beat.id}' does not have the shared stage duration.`);
    }
    if (index > 0 && Math.abs(score[index - 1].end - beat.start) > 0.0001) {
      throw new Error(`Narrative beat '${beat.id}' is not contiguous with the previous beat.`);
    }
    if (index > 0 && Math.abs((beat.preview - score[index - 1].preview) - narrativeStageDuration) > 0.000001) {
      throw new Error(`Narrative beat '${beat.id}' is not evenly spaced from the previous beat.`);
    }
  });
  if (score[0].start !== 0 || score[score.length - 1].end !== 1) {
    throw new Error("Narrative score must cover normalized progress from 0 to 1.");
  }
  return true;
}

if (process.env.NODE_ENV !== "production") validateNarrativeScore();
