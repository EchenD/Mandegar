export type IntroFrame = {
  progress: number;
  assemblyProgress: number;
  cameraLocalOffset: readonly [number, number, number];
};

export const experienceHomeFrame: IntroFrame = {
  progress: 1,
  assemblyProgress: 1,
  cameraLocalOffset: [0, 0, 0],
};

export const introCameraHandoffProgress = 5 / 7;

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

export function getIntroFrame(progress: number): IntroFrame {
  const safe = clamp01(progress);
  if (safe >= 1) return experienceHomeFrame;
  const assembly = smoothstep(safe);
  const cameraProgress = clamp01(safe / introCameraHandoffProgress);
  const cameraSettle = range(cameraProgress, 0.04, 0.96);
  return {
    progress: safe,
    assemblyProgress: assembly,
    cameraLocalOffset: [0, (1 - cameraSettle) * 3.8, 0],
  };
}

export function validateIntroSeam(tolerance = 0.000001) {
  const end = getIntroFrame(1);
  const scalarKeys: Array<Exclude<keyof IntroFrame, "cameraLocalOffset">> = [
    "progress",
    "assemblyProgress",
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
