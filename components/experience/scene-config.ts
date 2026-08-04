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
  roll: number;
  mobileRoll: number;
  fov: number;
  ease: "calm" | "reveal" | "loop";
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
  scrollLengthVh: { desktop: 1450, mobile: 1300 },
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
  { id: "arrival", start: 0, end: 0.12, preview: 0.05 },
  { id: "discovery", start: 0.12, end: 0.23, preview: 0.175 },
  { id: "activation", start: 0.23, end: 0.39, preview: 0.31 },
  { id: "reveal", start: 0.39, end: 0.52, preview: 0.455 },
  { id: "experiences", start: 0.52, end: 0.64, preview: 0.58 },
  { id: "proof", start: 0.64, end: 0.76, preview: 0.7 },
  { id: "intelligence", start: 0.76, end: 0.84, preview: 0.8 },
  { id: "invitation", start: 0.84, end: 0.93, preview: 0.885 },
  { id: "loop", start: 0.93, end: 1, preview: 0.965 },
] as const;

export const activationSequence = {
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
