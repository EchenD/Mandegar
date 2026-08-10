export type IntroFrame = {
  progress: number;
  sceneVisibility: number;
  wireVisibility: number;
  particleVisibility: number;
  lightVisibility: number;
  beacon: number;
  bloomBoost: number;
  cameraLocalOffset: readonly [number, number, number];
  cameraFovOffset: number;
};

export const experienceHomeFrame: IntroFrame = {
  progress: 1,
  sceneVisibility: 1,
  wireVisibility: 1,
  particleVisibility: 1,
  lightVisibility: 1,
  beacon: 0,
  bloomBoost: 0,
  cameraLocalOffset: [0, 0, 0],
  cameraFovOffset: 0,
};

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(value: number) {
  const safe = clamp01(value);
  return safe * safe * (3 - 2 * safe);
}

function range(value: number, start: number, end: number) {
  return smoothstep((value - start) / Math.max(0.0001, end - start));
}

function pulse(value: number, start: number, peak: number, end: number) {
  return range(value, start, peak) * (1 - range(value, peak, end));
}

export function getIntroFrame(progress: number): IntroFrame {
  const safe = clamp01(progress);
  if (safe >= 1) return experienceHomeFrame;
  const arrival = range(safe, 0.18, 0.92);
  const cameraSettle = range(safe, 0.12, 0.94);
  const orbit = Math.sin(safe * Math.PI);
  return {
    progress: safe,
    sceneVisibility: range(safe, 0.02, 0.3),
    wireVisibility: range(safe, 0.1, 0.78),
    particleVisibility: range(safe, 0.04, 0.48),
    lightVisibility: range(safe, 0.08, 0.72),
    beacon: pulse(safe, 0.04, 0.3, 0.82),
    bloomBoost: pulse(safe, 0.42, 0.66, 0.94) * 0.72,
    cameraLocalOffset: [
      (1 - cameraSettle) * -3.8 + orbit * 0.65,
      (1 - cameraSettle) * 1.2 + orbit * 0.28,
      (1 - arrival) * -8.5,
    ],
    cameraFovOffset: (1 - cameraSettle) * -5.5,
  };
}

export function validateIntroSeam(tolerance = 0.000001) {
  const end = getIntroFrame(1);
  const scalarKeys: Array<Exclude<keyof IntroFrame, "cameraLocalOffset">> = [
    "progress",
    "sceneVisibility",
    "wireVisibility",
    "particleVisibility",
    "lightVisibility",
    "beacon",
    "bloomBoost",
    "cameraFovOffset",
  ];
  scalarKeys.forEach((key) => {
    if (Math.abs(end[key] - experienceHomeFrame[key]) > tolerance) {
      throw new Error(`Intro seam channel '${key}' does not settle at the loop home frame.`);
    }
  });
  end.cameraLocalOffset.forEach((value, index) => {
    if (Math.abs(value - experienceHomeFrame.cameraLocalOffset[index]) > tolerance) {
      throw new Error(`Intro camera offset ${index} does not settle at the loop home frame.`);
    }
  });
  return true;
}
