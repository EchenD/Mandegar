export type ScenePhaseId = "arrival" | "discovery" | "activation" | "reveal" | "loop";
export type SceneQuality = "full" | "adaptive";
export type CameraKeyframe = {
  progress: number;
  position: readonly [number, number, number];
  mobilePosition: readonly [number, number, number];
  target: readonly [number, number, number];
  ease: "calm" | "reveal";
};

export const sceneTokens = {
  colors: {
    warmWhite: "#f7f7f4",
    fog: "#e8ebea",
    silver: "#b9c0c6",
    charcoal: "#16191d",
    cobalt: "#225cff",
    cyan: "#50c7ff",
    magenta: "#d95cff",
    amber: "#ffb54a",
  },
  scrollLengthVh: { desktop: 540, mobile: 470 },
  pointerParallax: { desktop: 0.085, mobile: 0 },
  featureFlags: {
    audience: true,
    screenShader: true,
    proceduralSound: true,
  },
} as const;

export const scenePhases: ReadonlyArray<{
  id: ScenePhaseId;
  start: number;
  end: number;
  preview: number;
}> = [
  { id: "arrival", start: 0, end: 0.18, preview: 0.08 },
  { id: "discovery", start: 0.18, end: 0.38, preview: 0.29 },
  { id: "activation", start: 0.38, end: 0.74, preview: 0.57 },
  { id: "reveal", start: 0.74, end: 0.91, preview: 0.83 },
  { id: "loop", start: 0.91, end: 1, preview: 0.955 },
] as const;

export const activationSequence = {
  lightTrails: [0.16, 0.43],
  screens: [
    [0.28, 0.4],
    [0.42, 0.53],
    [0.49, 0.61],
  ],
  mediaWall: [0.52, 0.65],
  booths: [0.59, 0.72],
  branding: [0.66, 0.77],
  audience: [0.7, 0.84],
  totalReveal: [0.75, 0.9],
  loopReset: [0.92, 1],
} as const;

export const cameraKeyframes: readonly CameraKeyframe[] = [
  { progress: 0, position: [0, 2.85, 15.6], mobilePosition: [0, 3.1, 18.2], target: [0, 1.65, 0], ease: "calm" },
  { progress: 0.18, position: [0.25, 2.65, 13.4], mobilePosition: [0.2, 2.95, 16.4], target: [0, 1.55, 0], ease: "calm" },
  { progress: 0.38, position: [4.15, 2.65, 10.6], mobilePosition: [2.45, 2.9, 13.8], target: [0, 1.35, 0], ease: "calm" },
  { progress: 0.7, position: [-3.45, 2.5, 9.6], mobilePosition: [-1.8, 2.85, 12.8], target: [0, 1.3, -0.1], ease: "calm" },
  { progress: 0.82, position: [0.15, 3.45, 11.9], mobilePosition: [0.05, 3.45, 14.7], target: [0, 1.45, 0], ease: "reveal" },
  { progress: 0.92, position: [0, 3.0, 13.7], mobilePosition: [0, 3.2, 16.5], target: [0, 1.55, 0], ease: "calm" },
  { progress: 1, position: [0, 2.85, 15.6], mobilePosition: [0, 3.1, 18.2], target: [0, 1.65, 0], ease: "calm" },
] as const;

export const qualityProfiles: Record<SceneQuality, {
  dpr: readonly [number, number];
  audiencePoints: number;
  radialSegments: number;
  antialias: boolean;
}> = {
  full: { dpr: [1, 1.5], audiencePoints: 26, radialSegments: 64, antialias: true },
  adaptive: { dpr: [1, 1.15], audiencePoints: 12, radialSegments: 32, antialias: false },
};

export const assetSlots = {
  hall: "hall_shell_v01.glb",
  hero: "hero_zone_v01.glb",
  halo: "ring_signature_v01.glb",
  stage: "stage_central_v01.glb",
  mediaWall: "led_main_16x9_v01.glb",
  photoBooth: "booth_photo_v01.glb",
  gameStation: "booth_game_v01.glb",
  touchTable: "touch_table_v01.glb",
  audience: "audience_style_pending_v01.glb",
} as const;

export function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function phaseProgress(progress: number, range: readonly [number, number]) {
  return clamp01((progress - range[0]) / (range[1] - range[0]));
}

export function getScenePhase(progress: number): ScenePhaseId {
  return scenePhases.reduce<ScenePhaseId>((active, phase) => progress >= phase.start ? phase.id : active, "arrival");
}

export function getPreviewProgress(value: string | null) {
  return scenePhases.find((phase) => phase.id === value)?.preview;
}
