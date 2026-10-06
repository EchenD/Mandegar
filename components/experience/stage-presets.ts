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

export type ProductionStageControls = {
  environmentReveal: number;
  centralReveal: number;
  leftReveal: number;
  rightReveal: number;
  environmentPeak: number;
  centralPeak: number;
  leftPeak: number;
  rightPeak: number;
  interactiveScreen: number;
  gameScreen: number;
  videoWallScreen: number;
  mainScreen: number;
  crowdPresence: number;
  dataFlow: number;
  transitionParticles: number;
  transitionParticleSize: number;
  transitionTurbulence: number;
  revealEdgeWidth: number;
  revealTurbulence: number;
};

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
  production: ProductionStageControls;
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
  production: ProductionStageControls;
};

export type StageTuning = Omit<ProductionStageControls, "environmentReveal"> & {
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

export type CreativeStagePresetSnapshot = {
  version: 1;
  stages: Partial<Record<ScenePhaseId, Partial<StageTuning>>>;
};

/**
 * The eleven creative review states. Values are normalized art-direction
 * controls; render systems interpolate between them through narrative progress.
 */
export const stagePresets = {
  arrival: {
    id: "arrival",
    camera: { shot: "arrival-wide", life: 0.18, pointer: 0.08 },
    particles: { mode: "quiet", presence: 0.18, response: 0.06, signal: 0, halo: 0 },
    lighting: { mode: "neutral", energy: 0.14, contrast: 0.12 },
    spatialInfo: { mode: "hidden", prominence: 0 },
    production: {
      environmentReveal: 1, centralReveal: 0, leftReveal: 0, rightReveal: 0,
      environmentPeak: 0, centralPeak: 0, leftPeak: 0, rightPeak: 0,
      interactiveScreen: 0, gameScreen: 0, videoWallScreen: 0, mainScreen: 0,
      crowdPresence: 0, dataFlow: 0, transitionParticles: 0.78,
      transitionParticleSize: 0.52, transitionTurbulence: 0.38,
      revealEdgeWidth: 0.42, revealTurbulence: 0.4,
    },
    interaction: "subtle",
    channels: ["architecture"],
  },
  discovery: {
    id: "discovery",
    camera: { shot: "discovery-approach", life: 0.32, pointer: 0.24 },
    particles: { mode: "trace", presence: 0.38, response: 0.22, signal: 0.12, halo: 0 },
    lighting: { mode: "guided", energy: 0.32, contrast: 0.28 },
    spatialInfo: { mode: "assembly", prominence: 0.58 },
    production: {
      environmentReveal: 1, centralReveal: 1, leftReveal: 1, rightReveal: 1,
      environmentPeak: 0, centralPeak: 0, leftPeak: 0, rightPeak: 0,
      interactiveScreen: 0, gameScreen: 0, videoWallScreen: 0, mainScreen: 0,
      crowdPresence: 1, dataFlow: 0, transitionParticles: 1,
      transitionParticleSize: 0.62, transitionTurbulence: 0.54,
      revealEdgeWidth: 0.48, revealTurbulence: 0.56,
    },
    interaction: "subtle",
    channels: ["architecture", "signal", "screens"],
  },
  activation: {
    id: "activation",
    camera: { shot: "activation-traverse", life: 0.52, pointer: 0.48 },
    particles: { mode: "wake", presence: 0.62, response: 0.55, signal: 0.44, halo: 0.06 },
    lighting: { mode: "activated", energy: 0.58, contrast: 0.5 },
    spatialInfo: { mode: "activation", prominence: 0.82 },
    production: {
      environmentReveal: 1, centralReveal: 1, leftReveal: 1, rightReveal: 1,
      environmentPeak: 1, centralPeak: 1, leftPeak: 1, rightPeak: 1,
      interactiveScreen: 1, gameScreen: 0, videoWallScreen: 0, mainScreen: 0,
      crowdPresence: 1, dataFlow: 0, transitionParticles: 1,
      transitionParticleSize: 0.68, transitionTurbulence: 0.62,
      revealEdgeWidth: 0.46, revealTurbulence: 0.64,
    },
    interaction: "subtle",
    channels: ["architecture", "signal", "screens"],
  },
  engagement: {
    id: "engagement",
    camera: { shot: "engagement-focus", life: 0.5, pointer: 0.4 },
    particles: { mode: "wake", presence: 0.72, response: 0.62, signal: 0.5, halo: 0.12 },
    lighting: { mode: "activated", energy: 0.68, contrast: 0.56 },
    spatialInfo: { mode: "activation", prominence: 0.9 },
    production: {
      environmentReveal: 1, centralReveal: 1, leftReveal: 1, rightReveal: 1,
      environmentPeak: 1, centralPeak: 1, leftPeak: 1, rightPeak: 1,
      interactiveScreen: 1, gameScreen: 0, videoWallScreen: 0, mainScreen: 0,
      crowdPresence: 1, dataFlow: 0, transitionParticles: 0.94,
      transitionParticleSize: 0.66, transitionTurbulence: 0.56,
      revealEdgeWidth: 0.43, revealTurbulence: 0.58,
    },
    interaction: "subtle",
    channels: ["architecture", "signal", "screens", "audience"],
  },
  reveal: {
    id: "reveal",
    camera: { shot: "full-reveal", life: 0.42, pointer: 0.28 },
    particles: { mode: "radiant", presence: 1, response: 0.72, signal: 0.58, halo: 0.35 },
    lighting: { mode: "reveal", energy: 1, contrast: 0.72 },
    spatialInfo: { mode: "activation", prominence: 1 },
    production: {
      environmentReveal: 1, centralReveal: 1, leftReveal: 1, rightReveal: 1,
      environmentPeak: 1, centralPeak: 1, leftPeak: 1, rightPeak: 1,
      interactiveScreen: 1, gameScreen: 0, videoWallScreen: 1, mainScreen: 0,
      crowdPresence: 1, dataFlow: 0, transitionParticles: 0.84,
      transitionParticleSize: 0.64, transitionTurbulence: 0.5,
      revealEdgeWidth: 0.4, revealTurbulence: 0.52,
    },
    interaction: "none",
    channels: ["architecture", "signal", "screens", "audience", "color"],
  },
  experiences: {
    id: "experiences",
    camera: { shot: "experience-zones", life: 0.55, pointer: 0.68 },
    particles: { mode: "zones", presence: 0.72, response: 0.82, signal: 0.5, halo: 0.22 },
    lighting: { mode: "focused", energy: 0.68, contrast: 0.58 },
    spatialInfo: { mode: "zones", prominence: 1 },
    production: {
      environmentReveal: 1, centralReveal: 1, leftReveal: 1, rightReveal: 1,
      environmentPeak: 1, centralPeak: 1, leftPeak: 1, rightPeak: 1,
      interactiveScreen: 1, gameScreen: 1, videoWallScreen: 1, mainScreen: 1,
      crowdPresence: 1, dataFlow: 0, transitionParticles: 0.28,
      transitionParticleSize: 0.5, transitionTurbulence: 0.32,
      revealEdgeWidth: 0.34, revealTurbulence: 0.38,
    },
    interaction: "zones",
    channels: ["architecture", "signal", "screens", "audience", "annotations"],
  },
  connection: {
    id: "connection",
    camera: { shot: "connected-journey", life: 0.5, pointer: 0.6 },
    particles: { mode: "zones", presence: 0.65, response: 0.72, signal: 0.46, halo: 0.19 },
    lighting: { mode: "focused", energy: 0.62, contrast: 0.62 },
    spatialInfo: { mode: "zones", prominence: 1 },
    production: {
      environmentReveal: 1, centralReveal: 1, leftReveal: 1, rightReveal: 1,
      environmentPeak: 1, centralPeak: 1, leftPeak: 1, rightPeak: 1,
      interactiveScreen: 1, gameScreen: 1, videoWallScreen: 1, mainScreen: 1,
      crowdPresence: 1, dataFlow: 0, transitionParticles: 0.16,
      transitionParticleSize: 0.48, transitionTurbulence: 0.28,
      revealEdgeWidth: 0.32, revealTurbulence: 0.34,
    },
    interaction: "zones",
    channels: ["architecture", "signal", "screens", "audience", "annotations"],
  },
  proof: {
    id: "proof",
    camera: { shot: "project-proof", life: 0.42, pointer: 0.52 },
    particles: { mode: "proof", presence: 0.58, response: 0.62, signal: 0.42, halo: 0.16 },
    lighting: { mode: "focused", energy: 0.56, contrast: 0.66 },
    spatialInfo: { mode: "projects", prominence: 1 },
    production: {
      environmentReveal: 1, centralReveal: 1, leftReveal: 1, rightReveal: 1,
      environmentPeak: 1, centralPeak: 1, leftPeak: 1, rightPeak: 1,
      interactiveScreen: 1, gameScreen: 1, videoWallScreen: 1, mainScreen: 1,
      crowdPresence: 1, dataFlow: 0, transitionParticles: 0.06,
      transitionParticleSize: 0.46, transitionTurbulence: 0.24,
      revealEdgeWidth: 0.3, revealTurbulence: 0.3,
    },
    interaction: "projects",
    channels: ["architecture", "signal", "screens", "audience", "annotations"],
  },
  intelligence: {
    id: "intelligence",
    camera: { shot: "event-intelligence", life: 0.35, pointer: 0.42 },
    particles: { mode: "data", presence: 0.7, response: 0.52, signal: 1, halo: 0.46 },
    lighting: { mode: "analytical", energy: 0.5, contrast: 0.72 },
    spatialInfo: { mode: "metrics", prominence: 1 },
    production: {
      environmentReveal: 1, centralReveal: 1, leftReveal: 1, rightReveal: 1,
      environmentPeak: 1, centralPeak: 1, leftPeak: 1, rightPeak: 1,
      interactiveScreen: 0.86, gameScreen: 0.86, videoWallScreen: 0.86, mainScreen: 1,
      crowdPresence: 1, dataFlow: 1, transitionParticles: 0.04,
      transitionParticleSize: 0.48, transitionTurbulence: 0.44,
      revealEdgeWidth: 0.3, revealTurbulence: 0.34,
    },
    interaction: "subtle",
    channels: ["architecture", "signal", "intelligence", "annotations"],
  },
  invitation: {
    id: "invitation",
    camera: { shot: "invitation-hold", life: 0.28, pointer: 0.3 },
    particles: { mode: "gather", presence: 0.48, response: 0.38, signal: 0.46, halo: 1 },
    lighting: { mode: "inviting", energy: 0.42, contrast: 0.42 },
    spatialInfo: { mode: "invitation", prominence: 1 },
    production: {
      environmentReveal: 1, centralReveal: 1, leftReveal: 1, rightReveal: 1,
      environmentPeak: 1, centralPeak: 1, leftPeak: 1, rightPeak: 1,
      interactiveScreen: 1, gameScreen: 1, videoWallScreen: 1, mainScreen: 1,
      crowdPresence: 1, dataFlow: 0, transitionParticles: 0.025,
      transitionParticleSize: 0.46, transitionTurbulence: 0.2,
      revealEdgeWidth: 0.28, revealTurbulence: 0.28,
    },
    interaction: "cta",
    channels: ["architecture", "signal"],
  },
  loop: {
    id: "loop",
    camera: { shot: "loop-return", life: 0.32, pointer: 0.28 },
    particles: { mode: "resolve", presence: 0.3, response: 0.22, signal: 0.12, halo: 0.16 },
    lighting: { mode: "reset", energy: 0.24, contrast: 0.2 },
    spatialInfo: { mode: "hidden", prominence: 0 },
    production: {
      environmentReveal: 1, centralReveal: 1, leftReveal: 1, rightReveal: 1,
      environmentPeak: 1, centralPeak: 1, leftPeak: 1, rightPeak: 1,
      interactiveScreen: 1, gameScreen: 1, videoWallScreen: 1, mainScreen: 1,
      crowdPresence: 1, dataFlow: 0, transitionParticles: 0.68,
      transitionParticleSize: 0.52, transitionTurbulence: 0.4,
      revealEdgeWidth: 0.4, revealTurbulence: 0.42,
    },
    interaction: "subtle",
    channels: ["architecture", "signal"],
  },
} as const satisfies Record<ScenePhaseId, StagePreset>;

const creativeStageOverrides: Partial<Record<ScenePhaseId, Partial<StageTuning>>> = {};

const tuningKeys: readonly (keyof StageTuning)[] = [
  "cameraLife",
  "cameraPointer",
  "particlePresence",
  "particleResponse",
  "particleSignal",
  "particleHalo",
  "lightEnergy",
  "lightContrast",
  "spatialProminence",
  "centralReveal",
  "leftReveal",
  "rightReveal",
  "environmentPeak",
  "centralPeak",
  "leftPeak",
  "rightPeak",
  "interactiveScreen",
  "gameScreen",
  "videoWallScreen",
  "mainScreen",
  "crowdPresence",
  "dataFlow",
  "transitionParticles",
  "transitionParticleSize",
  "transitionTurbulence",
  "revealEdgeWidth",
  "revealTurbulence",
];

function clampTuning(value: number) {
  return Math.min(1, Math.max(0, value));
}

function getBaseStageTuning(phase: ScenePhaseId): StageTuning {
  const preset = stagePresets[phase];
  return {
    cameraLife: preset.camera.life,
    cameraPointer: preset.camera.pointer,
    particlePresence: preset.particles.presence,
    particleResponse: preset.particles.response,
    particleSignal: preset.particles.signal,
    particleHalo: preset.particles.halo,
    lightEnergy: preset.lighting.energy,
    lightContrast: preset.lighting.contrast,
    spatialProminence: preset.spatialInfo.prominence,
    centralReveal: preset.production.centralReveal,
    leftReveal: preset.production.leftReveal,
    rightReveal: preset.production.rightReveal,
    environmentPeak: preset.production.environmentPeak,
    centralPeak: preset.production.centralPeak,
    leftPeak: preset.production.leftPeak,
    rightPeak: preset.production.rightPeak,
    interactiveScreen: preset.production.interactiveScreen,
    gameScreen: preset.production.gameScreen,
    videoWallScreen: preset.production.videoWallScreen,
    mainScreen: preset.production.mainScreen,
    crowdPresence: preset.production.crowdPresence,
    dataFlow: preset.production.dataFlow,
    transitionParticles: preset.production.transitionParticles,
    transitionParticleSize: preset.production.transitionParticleSize,
    transitionTurbulence: preset.production.transitionTurbulence,
    revealEdgeWidth: preset.production.revealEdgeWidth,
    revealTurbulence: preset.production.revealTurbulence,
  };
}

export function getStageTuning(phase: ScenePhaseId): StageTuning {
  return { ...getBaseStageTuning(phase), ...creativeStageOverrides[phase] };
}

export function setCreativeStageTuning(phase: ScenePhaseId, key: keyof StageTuning, value: number) {
  if (!Number.isFinite(value)) return;
  creativeStageOverrides[phase] = {
    ...creativeStageOverrides[phase],
    [key]: clampTuning(value),
  };
}

export function resetCreativeStageTuning(phase?: ScenePhaseId) {
  if (phase) {
    delete creativeStageOverrides[phase];
    return;
  }
  Object.keys(creativeStageOverrides).forEach((key) => {
    delete creativeStageOverrides[key as ScenePhaseId];
  });
}

export function getCreativeStagePresetSnapshot(): CreativeStagePresetSnapshot {
  return {
    version: 1,
    stages: Object.fromEntries(
      Object.entries(creativeStageOverrides).map(([phase, values]) => [phase, { ...values }]),
    ) as CreativeStagePresetSnapshot["stages"],
  };
}

export function applyCreativeStagePresetSnapshot(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== "object") return false;
  const candidate = snapshot as Partial<CreativeStagePresetSnapshot>;
  if (candidate.version !== 1 || !candidate.stages || typeof candidate.stages !== "object") return false;
  resetCreativeStageTuning();
  narrativeScore.forEach(({ id }) => {
    const stage = candidate.stages?.[id];
    if (!stage || typeof stage !== "object") return;
    tuningKeys.forEach((key) => {
      const value = stage[key];
      if (typeof value === "number") setCreativeStageTuning(id, key, value);
    });
  });
  return true;
}

export function getStagePreset(phase: ScenePhaseId): StagePreset {
  const preset = stagePresets[phase];
  if (process.env.NODE_ENV === "production") return preset;
  const tuning = getStageTuning(phase);
  return {
    ...preset,
    camera: { ...preset.camera, life: tuning.cameraLife, pointer: tuning.cameraPointer },
    particles: {
      ...preset.particles,
      presence: tuning.particlePresence,
      response: tuning.particleResponse,
      signal: tuning.particleSignal,
      halo: tuning.particleHalo,
    },
    lighting: { ...preset.lighting, energy: tuning.lightEnergy, contrast: tuning.lightContrast },
    spatialInfo: { ...preset.spatialInfo, prominence: tuning.spatialProminence },
    production: {
      ...preset.production,
      centralReveal: tuning.centralReveal,
      leftReveal: tuning.leftReveal,
      rightReveal: tuning.rightReveal,
      environmentPeak: tuning.environmentPeak,
      centralPeak: tuning.centralPeak,
      leftPeak: tuning.leftPeak,
      rightPeak: tuning.rightPeak,
      interactiveScreen: tuning.interactiveScreen,
      gameScreen: tuning.gameScreen,
      videoWallScreen: tuning.videoWallScreen,
      mainScreen: tuning.mainScreen,
      crowdPresence: tuning.crowdPresence,
      dataFlow: tuning.dataFlow,
      transitionParticles: tuning.transitionParticles,
      transitionParticleSize: tuning.transitionParticleSize,
      transitionTurbulence: tuning.transitionTurbulence,
      revealEdgeWidth: tuning.revealEdgeWidth,
      revealTurbulence: tuning.revealTurbulence,
    },
  };
}

function mixValue(from: number, to: number, amount: number) {
  return from + (to - from) * amount;
}

function smoothstepValue(value: number) {
  const safe = Math.min(1, Math.max(0, value));
  return safe * safe * (3 - 2 * safe);
}

type ProductionTransitionWindows = Partial<Record<
  ScenePhaseId,
  Partial<Record<keyof ProductionStageControls, readonly [number, number]>>
>>;

/**
 * Per-channel windows preserve the eleven editable resting presets while giving
 * transitions an authored order. Values are normalized within the interval
 * between two adjacent preview anchors.
 */
const productionTransitionWindows: ProductionTransitionWindows = {
  discovery: {
    // Normalized between the equally spaced arrival and discovery checkpoints:
    // a short, early center → left → right cascade that reads as one reveal.
    centralReveal: [0.3, 0.62],
    leftReveal: [0.36, 0.68],
    rightReveal: [0.42, 0.74],
    crowdPresence: [0.78, 0.94],
  },
  activation: {
    environmentPeak: [0.04, 0.28],
    centralPeak: [0.08, 0.32],
    leftPeak: [0.12, 0.36],
    rightPeak: [0.16, 0.4],
    interactiveScreen: [0.62, 0.82],
  },
  reveal: {
    videoWallScreen: [0.62, 0.82],
  },
  experiences: {
    gameScreen: [0.62, 0.82],
    mainScreen: [0.62, 0.82],
  },
  proof: {
    centralPeak: [0.05, 0.3],
    leftPeak: [0.22, 0.52],
    rightPeak: [0.46, 0.78],
    crowdPresence: [0.55, 0.88],
  },
  intelligence: {
    dataFlow: [0.45, 0.82],
  },
  invitation: {
    dataFlow: [0, 0.55],
  },
};

function getProductionTransitionMix(
  key: keyof ProductionStageControls,
  destination: ScenePhaseId,
  linearMix: number,
) {
  const range = productionTransitionWindows[destination]?.[key];
  if (!range) return smoothstepValue(linearMix);
  return smoothstepValue(
    (linearMix - range[0]) / Math.max(0.0001, range[1] - range[0]),
  );
}

/** Interpolates renderer controls between the eleven authored preview anchors. */
export function getStageFrame(progress: number): StageFrame {
  const safeProgress = Math.min(1, Math.max(0, progress));
  const nextIndex = narrativeScore.findIndex((beat) => beat.preview >= safeProgress);
  const toIndex = nextIndex < 0 ? narrativeScore.length - 1 : nextIndex;
  const toBeat = narrativeScore[toIndex];
  const fromIndex = Math.abs(toBeat.preview - safeProgress) < 0.000001 ? toIndex : Math.max(0, toIndex - 1);
  const fromBeat = narrativeScore[fromIndex];
  const span = Math.max(0.0001, toBeat.preview - fromBeat.preview);
  const linearMix = fromIndex === toIndex ? 0 : Math.min(1, Math.max(0, (safeProgress - fromBeat.preview) / span));
  const mix = smoothstepValue(linearMix);
  const current = getStagePreset(fromBeat.id);
  const next = getStagePreset(toBeat.id);
  const cameraLife = mixValue(current.camera.life, next.camera.life, mix);
  const cameraPointer = mixValue(current.camera.pointer, next.camera.pointer, mix);
  const interpolateProduction = (key: keyof ProductionStageControls) => (
    mixValue(
      current.production[key],
      next.production[key],
      getProductionTransitionMix(key, toBeat.id, linearMix),
    )
  );
  const production: ProductionStageControls = {
    environmentReveal: interpolateProduction("environmentReveal"),
    centralReveal: interpolateProduction("centralReveal"),
    leftReveal: interpolateProduction("leftReveal"),
    rightReveal: interpolateProduction("rightReveal"),
    environmentPeak: interpolateProduction("environmentPeak"),
    centralPeak: interpolateProduction("centralPeak"),
    leftPeak: interpolateProduction("leftPeak"),
    rightPeak: interpolateProduction("rightPeak"),
    interactiveScreen: interpolateProduction("interactiveScreen"),
    gameScreen: interpolateProduction("gameScreen"),
    videoWallScreen: interpolateProduction("videoWallScreen"),
    mainScreen: interpolateProduction("mainScreen"),
    crowdPresence: interpolateProduction("crowdPresence"),
    dataFlow: interpolateProduction("dataFlow"),
    transitionParticles: interpolateProduction("transitionParticles"),
    transitionParticleSize: interpolateProduction("transitionParticleSize"),
    transitionTurbulence: interpolateProduction("transitionTurbulence"),
    revealEdgeWidth: interpolateProduction("revealEdgeWidth"),
    revealTurbulence: interpolateProduction("revealTurbulence"),
  };
  return {
    current,
    next,
    mix,
    cameraLife,
    cameraPointer,
    particlePresence: mixValue(current.particles.presence, next.particles.presence, mix),
    particleResponse: mixValue(current.particles.response, next.particles.response, mix),
    particleSignal: mixValue(current.particles.signal, next.particles.signal, mix),
    particleHalo: mixValue(current.particles.halo, next.particles.halo, mix),
    lightEnergy: mixValue(current.lighting.energy, next.lighting.energy, mix),
    lightContrast: mixValue(current.lighting.contrast, next.lighting.contrast, mix),
    spatialProminence: mixValue(current.spatialInfo.prominence, next.spatialInfo.prominence, mix),
    production,
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
