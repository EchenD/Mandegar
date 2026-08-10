import { narrativeScore } from "./narrative-score";

export const narrativeVelocity = {
  minimum: 0.15,
  maximum: 1.8,
  tangentPower: 5,
} as const;

const curveSamples = 512;

const narrativeAnchors = [
  0,
  ...narrativeScore.map((beat) => beat.preview),
  1,
].filter((anchor, index, anchors) => index === 0 || anchor !== anchors[index - 1]);

function getVelocity(localProgress: number, correction: number) {
  const unit = Math.min(1, Math.max(0, localProgress));
  const bell = 4 * unit * (1 - unit);
  const shapedBell = Math.pow(bell, narrativeVelocity.tangentPower);
  const velocity = narrativeVelocity.minimum
    + (narrativeVelocity.maximum - narrativeVelocity.minimum) * shapedBell
    + correction * shapedBell * (1 - shapedBell);
  return Math.min(narrativeVelocity.maximum, Math.max(narrativeVelocity.minimum, velocity));
}

function getMeanVelocity(correction: number) {
  let area = 0;
  let previous = getVelocity(0, correction);
  for (let index = 1; index <= curveSamples; index += 1) {
    const current = getVelocity(index / curveSamples, correction);
    area += (previous + current) * 0.5 / curveSamples;
    previous = current;
  }
  return area;
}

function solveVelocityCorrection() {
  if (!(narrativeVelocity.minimum > 0 && narrativeVelocity.minimum < 1)) {
    throw new Error("Narrative minimum velocity must be greater than 0 and less than 1.");
  }
  if (!(narrativeVelocity.maximum > 1)) {
    throw new Error("Narrative maximum velocity must be greater than 1.");
  }
  if (!(narrativeVelocity.tangentPower > 0)) {
    throw new Error("Narrative tangent power must be greater than 0.");
  }

  const initialMean = getMeanVelocity(0);
  let lower = initialMean > 1 ? -1 : 0;
  let upper = initialMean > 1 ? 0 : 1;
  if (initialMean > 1) {
    while (getMeanVelocity(lower) > 1) lower *= 2;
  } else {
    while (getMeanVelocity(upper) < 1) upper *= 2;
  }
  for (let iteration = 0; iteration < 48; iteration += 1) {
    const midpoint = (lower + upper) * 0.5;
    if (getMeanVelocity(midpoint) < 1) lower = midpoint;
    else upper = midpoint;
  }
  return (lower + upper) * 0.5;
}

const velocityCorrection = solveVelocityCorrection();

/**
 * The derivative of narrative progress. Higher tangent power holds near the
 * minimum longer, then concentrates acceleration around the transition centre.
 */
export function getNarrativeVelocity(localProgress: number) {
  return getVelocity(localProgress, velocityCorrection);
}

function createProgressLookup() {
  const cumulative = new Float64Array(curveSamples + 1);
  let previous = getNarrativeVelocity(0);
  for (let index = 1; index <= curveSamples; index += 1) {
    const current = getNarrativeVelocity(index / curveSamples);
    cumulative[index] = cumulative[index - 1] + (previous + current) * 0.5 / curveSamples;
    previous = current;
  }
  const total = cumulative[curveSamples];
  for (let index = 1; index <= curveSamples; index += 1) cumulative[index] /= total;
  return cumulative;
}

const progressLookup = createProgressLookup();

function warpInterval(localProgress: number) {
  const unit = Math.min(1, Math.max(0, localProgress));
  const sample = unit * curveSamples;
  const lowerIndex = Math.min(curveSamples - 1, Math.floor(sample));
  const mix = sample - lowerIndex;
  return progressLookup[lowerIndex]
    + (progressLookup[lowerIndex + 1] - progressLookup[lowerIndex]) * mix;
}

/** Preserves every authored anchor while changing visual velocity between them. */
export function warpNarrativeProgress(progress: number) {
  const safeProgress = Math.min(1, Math.max(0, progress));
  const nextIndex = narrativeAnchors.findIndex((anchor) => anchor >= safeProgress);
  if (nextIndex <= 0) return narrativeAnchors[0];
  const to = narrativeAnchors[nextIndex];
  if (Math.abs(to - safeProgress) < 0.000001) return to;
  const from = narrativeAnchors[nextIndex - 1];
  const localProgress = (safeProgress - from) / Math.max(0.0001, to - from);
  return from + (to - from) * warpInterval(localProgress);
}

export function validateNarrativeProgressCurve(samples = 200) {
  narrativeAnchors.forEach((anchor) => {
    if (Math.abs(warpNarrativeProgress(anchor) - anchor) > 0.000001) {
      throw new Error(`Narrative velocity curve moved anchor '${anchor}'.`);
    }
  });
  let previous = warpNarrativeProgress(0);
  for (let index = 1; index <= samples; index += 1) {
    const current = warpNarrativeProgress(index / samples);
    if (current < previous) throw new Error("Narrative velocity curve must remain monotonic.");
    previous = current;
  }
  return true;
}

if (process.env.NODE_ENV !== "production") validateNarrativeProgressCurve();
