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
  scrollLengthVh: { desktop: 900, mobile: 820 },
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
  { id: "arrival", start: 0, end: 0.11, preview: 0.045 },
  { id: "discovery", start: 0.11, end: 0.22, preview: 0.165 },
  { id: "activation", start: 0.22, end: 0.4, preview: 0.31 },
  { id: "reveal", start: 0.4, end: 0.53, preview: 0.465 },
  { id: "experiences", start: 0.53, end: 0.65, preview: 0.59 },
  { id: "proof", start: 0.65, end: 0.77, preview: 0.71 },
  { id: "intelligence", start: 0.77, end: 0.87, preview: 0.82 },
  { id: "invitation", start: 0.87, end: 0.96, preview: 0.915 },
  { id: "loop", start: 0.96, end: 1, preview: 0.982 },
] as const;

export const activationSequence = {
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
  loopReset: [0.96, 1],
} as const;

export const cameraKeyframes: readonly CameraKeyframe[] = [
  { progress: 0, position: [0, 3.0, 16.2], mobilePosition: [0, 4.15, 27.5], target: [0, 2.35, 0], ease: "calm" },
  { progress: 0.11, position: [0.2, 2.9, 15], mobilePosition: [0.15, 4.05, 26.5], target: [0, 2.3, 0], ease: "calm" },
  { progress: 0.22, position: [3.4, 2.95, 13.5], mobilePosition: [1.4, 3.95, 24.5], target: [0, 2.2, 0], ease: "calm" },
  { progress: 0.4, position: [-2.6, 2.9, 13], mobilePosition: [-1.15, 3.9, 24], target: [0, 2.15, 0], ease: "calm" },
  { progress: 0.53, position: [0.1, 3.45, 14.1], mobilePosition: [0, 4.25, 24.6], target: [0, 2.35, 0], ease: "reveal" },
  { progress: 0.65, position: [4.5, 2.55, 11.8], mobilePosition: [2.1, 3.75, 22.8], target: [1.4, 1.75, -0.1], ease: "calm" },
  { progress: 0.77, position: [-4.1, 2.75, 12.3], mobilePosition: [-1.8, 3.9, 23.4], target: [-1.25, 1.85, 0], ease: "calm" },
  { progress: 0.87, position: [0, 4.1, 14.8], mobilePosition: [0, 4.45, 25], target: [0, 2.45, 0], ease: "calm" },
  { progress: 0.96, position: [0, 3.3, 15.5], mobilePosition: [0, 4.2, 26.2], target: [0, 2.35, 0], ease: "calm" },
  { progress: 1, position: [0, 3.0, 16.2], mobilePosition: [0, 4.15, 27.5], target: [0, 2.35, 0], ease: "calm" },
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
  assembled: "/models/mandegar-v1/mandegar_hero_assembled_v1.glb",
  hall: "/models/mandegar-v1/mandegar_hall_shell_v1.glb",
  hero: "/models/mandegar-v1/mandegar_hero_core_v1.glb",
  halo: "/models/mandegar-v1/mandegar_halo_v1.glb",
  experiencePods: "/models/mandegar-v1/mandegar_experience_pods_v1.glb",
  stage: "stage_base",
  mediaWall: "led_central_media_21x9",
  photoBooth: "booth_left_shell",
  gameStation: "booth_right_shell",
  touchTable: "touch_left_surface",
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
