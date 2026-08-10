import {
  narrativeScore,
  type NarrativeChannel,
  type NarrativeInteraction,
  type ScenePhaseId,
} from "./narrative-score";

export type ParticleStageMode =
  | "quiet"
  | "trace"
  | "wake"
  | "radiant"
  | "zones"
  | "proof"
  | "data"
  | "gather"
  | "resolve";

export type LightingStageMode =
  | "neutral"
  | "guided"
  | "activated"
  | "reveal"
  | "focused"
  | "analytical"
  | "inviting"
  | "reset";

export type SpatialInfoMode = "hidden" | "assembly" | "activation" | "zones" | "projects" | "metrics" | "invitation";

export type StagePreset = {
  id: ScenePhaseId;
  camera: {
    shot: string;
    life: number;
    pointer: number;
  };
  particles: {
    mode: ParticleStageMode;
    presence: number;
    response: number;
    signal: number;
    halo: number;
  };
  lighting: {
    mode: LightingStageMode;
    energy: number;
    contrast: number;
  };
  spatialInfo: {
    mode: SpatialInfoMode;
    prominence: number;
  };
  interaction: NarrativeInteraction;
  channels: readonly NarrativeChannel[];
};

export type StageFrame = {
  current: StagePreset;
  next: StagePreset;
  mix: number;
  cameraLife: number;
  cameraPointer: number;
  particlePresence: number;
  particleResponse: number;
  particleSignal: number;
  particleHalo: number;
  lightEnergy: number;
  lightContrast: number;
  spatialProminence: number;
};

/**
 * The nine creative review states. Values are normalized art-direction
 * controls; render systems interpolate between them through narrative progress.
 */
export const stagePresets = {
  arrival: {
    id: "arrival",
    camera: { shot: "arrival-wide", life: 0.18, pointer: 0.08 },
    particles: { mode: "quiet", presence: 0.18, response: 0.06, signal: 0, halo: 0 },
    lighting: { mode: "neutral", energy: 0.14, contrast: 0.12 },
    spatialInfo: { mode: "hidden", prominence: 0 },
    interaction: "subtle",
    channels: ["architecture"],
  },
  discovery: {
    id: "discovery",
    camera: { shot: "discovery-approach", life: 0.32, pointer: 0.24 },
    particles: { mode: "trace", presence: 0.38, response: 0.22, signal: 0.12, halo: 0 },
    lighting: { mode: "guided", energy: 0.32, contrast: 0.28 },
    spatialInfo: { mode: "assembly", prominence: 0.58 },
    interaction: "subtle",
    channels: ["architecture", "signal", "screens"],
  },
  activation: {
    id: "activation",
    camera: { shot: "activation-traverse", life: 0.52, pointer: 0.48 },
    particles: { mode: "wake", presence: 0.62, response: 0.55, signal: 0.44, halo: 0.06 },
    lighting: { mode: "activated", energy: 0.58, contrast: 0.5 },
    spatialInfo: { mode: "activation", prominence: 0.82 },
    interaction: "subtle",
    channels: ["architecture", "signal", "screens"],
  },
  reveal: {
    id: "reveal",
    camera: { shot: "full-reveal", life: 0.42, pointer: 0.28 },
    particles: { mode: "radiant", presence: 1, response: 0.72, signal: 0.58, halo: 0.35 },
    lighting: { mode: "reveal", energy: 1, contrast: 0.72 },
    spatialInfo: { mode: "hidden", prominence: 0 },
    interaction: "none",
    channels: ["architecture", "signal", "screens", "audience", "color"],
  },
  experiences: {
    id: "experiences",
    camera: { shot: "experience-zones", life: 0.55, pointer: 0.68 },
    particles: { mode: "zones", presence: 0.72, response: 0.82, signal: 0.5, halo: 0.22 },
    lighting: { mode: "focused", energy: 0.68, contrast: 0.58 },
    spatialInfo: { mode: "zones", prominence: 1 },
    interaction: "zones",
    channels: ["architecture", "signal", "screens", "audience", "annotations"],
  },
  proof: {
    id: "proof",
    camera: { shot: "project-proof", life: 0.42, pointer: 0.52 },
    particles: { mode: "proof", presence: 0.58, response: 0.62, signal: 0.42, halo: 0.16 },
    lighting: { mode: "focused", energy: 0.56, contrast: 0.66 },
    spatialInfo: { mode: "projects", prominence: 1 },
    interaction: "projects",
    channels: ["architecture", "signal", "screens", "audience", "annotations"],
  },
  intelligence: {
    id: "intelligence",
    camera: { shot: "event-intelligence", life: 0.35, pointer: 0.42 },
    particles: { mode: "data", presence: 0.7, response: 0.52, signal: 1, halo: 0.46 },
    lighting: { mode: "analytical", energy: 0.5, contrast: 0.72 },
    spatialInfo: { mode: "metrics", prominence: 1 },
    interaction: "subtle",
    channels: ["architecture", "signal", "intelligence", "annotations"],
  },
  invitation: {
    id: "invitation",
    camera: { shot: "invitation-hold", life: 0.28, pointer: 0.3 },
    particles: { mode: "gather", presence: 0.48, response: 0.38, signal: 0.46, halo: 1 },
    lighting: { mode: "inviting", energy: 0.42, contrast: 0.42 },
    spatialInfo: { mode: "invitation", prominence: 1 },
    interaction: "cta",
    channels: ["architecture", "signal"],
  },
  loop: {
    id: "loop",
    camera: { shot: "loop-return", life: 0.32, pointer: 0.28 },
    particles: { mode: "resolve", presence: 0.3, response: 0.22, signal: 0.12, halo: 0.16 },
    lighting: { mode: "reset", energy: 0.24, contrast: 0.2 },
    spatialInfo: { mode: "hidden", prominence: 0 },
    interaction: "subtle",
    channels: ["architecture", "signal"],
  },
} as const satisfies Record<ScenePhaseId, StagePreset>;

export function getStagePreset(phase: ScenePhaseId): StagePreset {
  return stagePresets[phase];
}

function mixValue(from: number, to: number, amount: number) {
  return from + (to - from) * amount;
}

/** Interpolates renderer controls between the nine authored preview anchors. */
export function getStageFrame(progress: number): StageFrame {
  const safeProgress = Math.min(1, Math.max(0, progress));
  const nextIndex = narrativeScore.findIndex((beat) => beat.preview >= safeProgress);
  const toIndex = nextIndex < 0 ? narrativeScore.length - 1 : nextIndex;
  const toBeat = narrativeScore[toIndex];
  const fromIndex = Math.abs(toBeat.preview - safeProgress) < 0.000001 ? toIndex : Math.max(0, toIndex - 1);
  const fromBeat = narrativeScore[fromIndex];
  const span = Math.max(0.0001, toBeat.preview - fromBeat.preview);
  const linearMix = fromIndex === toIndex ? 0 : Math.min(1, Math.max(0, (safeProgress - fromBeat.preview) / span));
  const mix = linearMix * linearMix * (3 - 2 * linearMix);
  const current = stagePresets[fromBeat.id];
  const next = stagePresets[toBeat.id];

  return {
    current,
    next,
    mix,
    cameraLife: mixValue(current.camera.life, next.camera.life, mix),
    cameraPointer: mixValue(current.camera.pointer, next.camera.pointer, mix),
    particlePresence: mixValue(current.particles.presence, next.particles.presence, mix),
    particleResponse: mixValue(current.particles.response, next.particles.response, mix),
    particleSignal: mixValue(current.particles.signal, next.particles.signal, mix),
    particleHalo: mixValue(current.particles.halo, next.particles.halo, mix),
    lightEnergy: mixValue(current.lighting.energy, next.lighting.energy, mix),
    lightContrast: mixValue(current.lighting.contrast, next.lighting.contrast, mix),
    spatialProminence: mixValue(current.spatialInfo.prominence, next.spatialInfo.prominence, mix),
  };
}

export function validateStagePresets() {
  narrativeScore.forEach((beat) => {
    const preset = stagePresets[beat.id];
    if (preset.id !== beat.id) throw new Error(`Stage preset '${beat.id}' has a mismatched id.`);
    if (preset.camera.shot !== beat.cameraShot) {
      throw new Error(`Stage preset '${beat.id}' does not match its authored camera shot.`);
    }
    if (preset.interaction !== beat.interaction) {
      throw new Error(`Stage preset '${beat.id}' does not match its authored interaction.`);
    }
  });
  return true;
}

if (process.env.NODE_ENV !== "production") validateStagePresets();
