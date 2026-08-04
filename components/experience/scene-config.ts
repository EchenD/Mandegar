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
  environment: {
    background: {
      quiet: "#cdd2d4",
      active: "#bec8d5",
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
        bloomAssemblyBoost: 0.2,
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
        bloomAssemblyBoost: 0,
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
  assembled: "/models/mandegar/mandegar_hero.glb?revision=camera-v2",
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
