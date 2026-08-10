import { publicAssetPath } from "@/lib/public-asset-path";
import {
  clampNarrativeProgress,
  getNarrativeBeat,
  getNarrativeFrame,
  getNarrativePreview,
  narrativeCueRanges,
  narrativeMoments,
  narrativeScore,
  rangeProgress,
  type ScenePhaseId,
} from "./narrative-score";

export type { ScenePhaseId } from "./narrative-score";
export type SceneQuality = "full" | "adaptive";
export type CameraKeyframe = {
  progress: number;
  position: readonly [number, number, number];
  mobilePosition: readonly [number, number, number];
  target: readonly [number, number, number];
  roll: number;
  mobileRoll: number;
  fov: number;
  ease: "calm" | "reveal" | "loop";
};

export const sceneTokens = {
  colors: {
    warmWhite: "#f7f7f4",
    fog: "#cdd2d4",
    silver: "#b9c0c6",
    charcoal: "#16191d",
    cobalt: "#225cff",
    cyan: "#50c7ff",
    magenta: "#d95cff",
    amber: "#ffb54a",
  },
  particles: {
    count: { full: 4200, adaptive: 1400 },
    quietColor: "#9dabb8",
    palette: ["#789dff", "#75d8ff", "#ef86ff", "#ffc77a"],
    luminance: { quiet: 1.7, active: 3.6 },
    layers: {
      atmosphere: 0.55,
      surface: 0.31,
      signal: 0.14,
    },
    modelNodes: {
      floor: "hall_floor",
      haloMesh: "ring_signature_halo",
      haloAnchor: "fxAnchor_halo_center",
      focusAnchor: "fxAnchor_camera_focus",
      signalRoutes: [
        ["fxAnchor_left_interaction", "led_left_screen_16x9"],
        ["led_left_screen_16x9", "led_central_media_21x9"],
        ["fxAnchor_right_interaction", "led_right_screen_16x9"],
        ["led_right_screen_16x9", "led_central_media_21x9"],
        ["led_central_media_21x9", "ring_signature_halo"],
      ],
    },
    surfaceNodes: [
      { name: "stage_signal_edge", wake: 0.1, color: "#75d8ff", weight: 0.8 },
      { name: "led_left_screen_16x9", wake: 0.2, color: "#ef86ff", weight: 0.8 },
      { name: "led_right_screen_16x9", wake: 0.25, color: "#75d8ff", weight: 0.8 },
      { name: "led_central_media_21x9", wake: 0.29, color: "#789dff", weight: 1.2 },
      { name: "booth_left_portal", wake: 0.34, color: "#ef86ff", weight: 0.6 },
      { name: "booth_right_portal", wake: 0.34, color: "#75d8ff", weight: 0.6 },
      { name: "hero_canopy_light", wake: 0.38, color: "#ffc77a", weight: 0.9 },
      { name: "hero_core_shell", wake: 0.38, color: "#789dff", weight: 0.8 },
      { name: "ring_signature_halo", wake: 0.4, color: "#d7ecff", weight: 1.6 },
    ],
    motion: {
      drift: 0.075,
      surfaceOffset: 0.018,
      signalSpeed: 0.095,
      pointerRadius: 2.55,
      pointerCurl: 0.34,
      pointerPush: 0.12,
      pressRipple: 0.42,
    },
    opacity: {
      core: { idle: 0.48, active: 0.9 },
      glow: { idle: 0.12, active: 0.32 },
    },
    size: {
      full: { core: 0.034, glow: 0.108 },
      adaptive: { core: 0.038, glow: 0.118 },
    },
    screenSize: {
      minimum: 1.5,
      maximum: { full: 14, adaptive: 12 },
    },
  },
  visualStory: {
    livingWorld: narrativeMoments.livingWorld,
    peakReveal: narrativeMoments.peakReveal,
    particles: {
      quietPopulation: 0.58,
      livingPopulation: 0.86,
      peakPopulation: 1,
      livingScale: 1.18,
      peakScale: 1.52,
      livingBrightness: 1.16,
      peakBrightness: 1.42,
    },
    audience: {
      enter: [0.41, 0.51] as const,
      exit: [0.875, 0.93] as const,
      opacity: { full: 0.42, adaptive: 0.48 },
      peakBoost: 0.2,
      gatherDistance: 0.58,
      motion: 0.035,
      palette: ["#657184", "#7187a4", "#83768e", "#8b8078"],
    },
    trails: {
      colors: ["#225cff", "#50c7ff", "#d95cff", "#50c7ff", "#ffb54a", "#d95cff"],
      livingOpacity: 0.68,
      peakOpacity: 0.96,
    },
  },
  environment: {
    background: {
      quiet: "#cdd2d4",
      active: "#b7c2cf",
      peak: "#98a7bc",
    },
    fog: { near: 15, far: 44 },
    exposure: 0.92,
    lights: {
      ambient: 0.36,
      hemisphere: 0.58,
      key: 1.55,
      fill: 0.38,
    },
    postprocessing: {
      full: {
        bloom: true,
        bloomStrength: 0.34,
        bloomRevealBoost: 0.16,
        bloomPeakBoost: 0.2,
        bloomRadius: 0.3,
        bloomThreshold: 1.7,
        depthOfField: true,
        aperture: 0.0001,
        maxBlur: 0.008,
      },
      adaptive: {
        bloom: false,
        bloomStrength: 0,
        bloomRevealBoost: 0,
        bloomPeakBoost: 0,
        bloomRadius: 0,
        bloomThreshold: 2,
        depthOfField: false,
        aperture: 0,
        maxBlur: 0,
      },
    },
  },
  authoredCamera: {
    enabled: true,
    enabledOnMobile: true,
    node: "camera_mandegar_master",
    clip: "camera_master_loop",
    focusTarget: [0, 2.4, 0] as const,
  },
  cameraMotion: {
    breathing: {
      position: [0.045, 0.028, 0.02] as const,
      rotation: [0.0022, 0.003, 0.0014] as const,
      frequency: [0.11, 0.083, 0.067] as const,
      mobileScale: 0.45,
    },
    pointer: {
      position: [0.34, 0.17] as const,
      rotation: [0.015, 0.024] as const,
      mobileScale: 0,
      stiffness: 70,
      damping: 16,
      maximumDelta: 0.04,
    },
  },
  spatialLabels: {
    moments: {
      assembly: [0.115, 0.225] as const,
      activationLeft: [0.225, 0.34] as const,
      activationRight: [0.34, 0.455] as const,
      reveal: [0.47, 0.52] as const,
      experiences: [0.52, 0.64] as const,
      proof: [0.64, 0.76] as const,
      intelligence: [0.76, 0.837] as const,
    },
    nodes: {
      core: "hero_core_shell",
      media: "led_central_media_21x9",
      leftScreen: "led_left_screen_16x9",
      rightScreen: "led_right_screen_16x9",
      canopy: "hero_canopy_light",
      leftZone: "booth_left_portal",
      rightZone: "booth_right_portal",
      leftShell: "booth_left_shell",
      rightShell: "booth_right_shell",
      leftTouch: "touch_left_surface",
      rightTouch: "touch_right_surface",
    },
    accent: "#75d8ff",
    ink: "#16191d",
    safeArea: {
      desktop: { inline: 96, top: 88, bottom: 112 },
      compact: { inline: 64, top: 76, bottom: 96 },
    },
  },
  scrollLengthVh: { desktop: 2175, mobile: 1950 },
  featureFlags: {
    audience: true,
    screenShader: true,
    proceduralSound: true,
  },
} as const;

export const scenePhases = narrativeScore;

export const activationSequence = narrativeCueRanges;

export const cameraKeyframes: readonly CameraKeyframe[] = [
  { progress: 0, position: [0, 4, 27], mobilePosition: [0, 4.8, 32], target: [0, 2.4, 0], roll: 0, mobileRoll: 0, fov: 48, ease: "loop" },
  { progress: 0.035, position: [-3, 3.8, 27], mobilePosition: [-1.6, 4.6, 32], target: [-0.18, 2.38, 0], roll: -0.012, mobileRoll: -0.006, fov: 47, ease: "loop" },
  { progress: 0.12, position: [0.4, 2.9, 15.2], mobilePosition: [0.2, 4.1, 26.5], target: [0, 2.3, 0], roll: 0.015, mobileRoll: 0, fov: 42, ease: "reveal" },
  { progress: 0.23, position: [5.8, 3.2, 12.5], mobilePosition: [1.8, 4.4, 24.5], target: [0, 2.05, 0], roll: -0.035, mobileRoll: -0.012, fov: 43, ease: "calm" },
  { progress: 0.39, position: [-4.8, 2.3, 10.8], mobilePosition: [-2, 4, 23], target: [0, 2, 0], roll: 0.05, mobileRoll: 0.016, fov: 41, ease: "reveal" },
  { progress: 0.52, position: [0, 12.8, 5.5], mobilePosition: [0, 11, 12.5], target: [0, 1.2, 0], roll: -0.13, mobileRoll: -0.045, fov: 47, ease: "reveal" },
  { progress: 0.64, position: [6, 3, 9.6], mobilePosition: [2.3, 4.1, 21.8], target: [2, 1.8, 0], roll: 0.04, mobileRoll: 0.014, fov: 40, ease: "reveal" },
  { progress: 0.76, position: [-5.4, 2.4, 9.8], mobilePosition: [-2.2, 4, 22.2], target: [-2, 1.8, 0], roll: -0.04, mobileRoll: -0.014, fov: 40, ease: "calm" },
  { progress: 0.84, position: [0, 6.8, 11.8], mobilePosition: [0, 6.5, 22.8], target: [0, 2.1, 0], roll: 0.07, mobileRoll: 0.025, fov: 44, ease: "reveal" },
  { progress: 0.93, position: [0, 3.7, 18], mobilePosition: [0, 4.4, 28], target: [0, 2.4, 0], roll: 0, mobileRoll: 0, fov: 46, ease: "calm" },
  { progress: 0.965, position: [3, 4.2, 27], mobilePosition: [1.6, 5, 32], target: [0.18, 2.42, 0], roll: 0.012, mobileRoll: 0.006, fov: 49, ease: "loop" },
  { progress: 1, position: [0, 4, 27], mobilePosition: [0, 4.8, 32], target: [0, 2.4, 0], roll: 0, mobileRoll: 0, fov: 48, ease: "loop" },
] as const;

export const qualityProfiles: Record<SceneQuality, {
  dpr: readonly [number, number];
  audiencePoints: number;
  radialSegments: number;
  antialias: boolean;
}> = {
  full: { dpr: [1, 1.5], audiencePoints: 34, radialSegments: 64, antialias: true },
  adaptive: { dpr: [1, 1.15], audiencePoints: 16, radialSegments: 32, antialias: false },
};

export const assetSlots = {
  assembled: `${publicAssetPath("/models/mandegar/mandegar_hero.glb")}?revision=camera-v2`,
} as const;

export function clamp01(value: number) {
  return clampNarrativeProgress(value);
}

export function phaseProgress(progress: number, range: readonly [number, number]) {
  return rangeProgress(progress, range);
}

export function getVisualStoryState(progress: number) {
  const { living, peak, energy, reset } = getNarrativeFrame(progress);
  return { living, peak, energy, reset };
}

export function getScenePhase(progress: number): ScenePhaseId {
  return getNarrativeBeat(progress).id;
}

export function getPreviewProgress(value: string | null) {
  return getNarrativePreview(value);
}
