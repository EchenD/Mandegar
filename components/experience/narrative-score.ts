export type ScenePhaseId =
  | "arrival"
  | "discovery"
  | "activation"
  | "reveal"
  | "experiences"
  | "proof"
  | "intelligence"
  | "invitation"
  | "loop";

export type NarrativeAttention =
  | "space"
  | "signal"
  | "systems"
  | "reveal"
  | "zones"
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

/**
 * The authored story score is the single source of truth for phase order,
 * phase boundaries, review checkpoints, and the intended owner of attention.
 * Values intentionally match the existing production timeline.
 */
export const narrativeScore = [
  {
    id: "arrival",
    start: 0,
    end: 0.12,
    preview: 0.05,
    attention: "space",
    interaction: "subtle",
    cameraShot: "arrival-wide",
    assets: ["arrival"],
    channels: ["architecture"],
  },
  {
    id: "discovery",
    start: 0.12,
    end: 0.23,
    preview: 0.175,
    attention: "signal",
    interaction: "subtle",
    cameraShot: "discovery-approach",
    assets: ["arrival"],
    channels: ["architecture", "signal", "screens"],
  },
  {
    id: "activation",
    start: 0.23,
    end: 0.39,
    preview: 0.31,
    attention: "systems",
    interaction: "subtle",
    cameraShot: "activation-traverse",
    assets: ["arrival", "activation"],
    channels: ["architecture", "signal", "screens"],
  },
  {
    id: "reveal",
    start: 0.39,
    end: 0.52,
    preview: 0.455,
    attention: "reveal",
    interaction: "none",
    cameraShot: "full-reveal",
    assets: ["arrival", "activation"],
    channels: ["architecture", "signal", "screens", "audience", "color"],
  },
  {
    id: "experiences",
    start: 0.52,
    end: 0.64,
    preview: 0.58,
    attention: "zones",
    interaction: "zones",
    cameraShot: "experience-zones",
    assets: ["arrival", "activation", "zones"],
    channels: ["architecture", "signal", "screens", "audience", "annotations"],
  },
  {
    id: "proof",
    start: 0.64,
    end: 0.76,
    preview: 0.7,
    attention: "projects",
    interaction: "projects",
    cameraShot: "project-proof",
    assets: ["arrival", "activation", "zones", "projects"],
    channels: ["architecture", "signal", "screens", "audience", "annotations"],
  },
  {
    id: "intelligence",
    start: 0.76,
    end: 0.84,
    preview: 0.8,
    attention: "data",
    interaction: "subtle",
    cameraShot: "event-intelligence",
    assets: ["arrival", "activation", "intelligence"],
    channels: ["architecture", "signal", "intelligence", "annotations"],
  },
  {
    id: "invitation",
    start: 0.84,
    end: 0.93,
    preview: 0.885,
    attention: "invitation",
    interaction: "cta",
    cameraShot: "invitation-hold",
    assets: ["arrival", "activation"],
    channels: ["architecture", "signal"],
  },
  {
    id: "loop",
    start: 0.93,
    end: 1,
    preview: 0.965,
    attention: "return",
    interaction: "subtle",
    cameraShot: "loop-return",
    assets: ["arrival"],
    channels: ["architecture", "signal"],
  },
] as const satisfies readonly NarrativeBeat[];

/** Existing effect cues, centralized here while their visual values are preserved. */
export const narrativeCueRanges = {
  objectAssembly: [0.015, 0.18],
  lightTrails: [0.1, 0.22],
  screens: [
    [0.2, 0.28],
    [0.25, 0.33],
    [0.29, 0.37],
  ],
  mediaWall: [0.29, 0.38],
  booths: [0.34, 0.43],
  branding: [0.38, 0.47],
  audience: [0.41, 0.51],
  totalReveal: [0.4, 0.52],
  intelligence: [0.73, 0.82],
  haloCondense: [0.82, 0.91],
  loopReset: [0.93, 1],
} as const;

export const narrativeMoments = {
  livingWorld: {
    enter: [0.36, 0.5],
    exit: [0.84, 0.93],
  },
  peakReveal: {
    enter: [0.405, 0.465],
    exit: [0.505, 0.57],
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
    if (index > 0 && Math.abs(score[index - 1].end - beat.start) > 0.0001) {
      throw new Error(`Narrative beat '${beat.id}' is not contiguous with the previous beat.`);
    }
  });
  if (score[0].start !== 0 || score[score.length - 1].end !== 1) {
    throw new Error("Narrative score must cover normalized progress from 0 to 1.");
  }
  return true;
}

if (process.env.NODE_ENV !== "production") validateNarrativeScore();
