export const SERVICE_POSES = [.12, .31, .5, .69, .88] as const;
export const SERVICE_TURN_PADDING = .05;

export const SERVICE_NODE_NAMES = [
  "ServicesEvent",
  "ServicesExhibition",
  "ServicesDigital",
  "ServicesContent",
  "ServicesAdvertising",
] as const;

export type ServicesMotionState = {
  index: number;
  outgoingIndex: number;
  rootRotation: number;
  kitLift: number[];
  entry: number;
  exit: number;
  scale: number;
};

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(value: number) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function smootherstep(value: number) {
  const t = clamp01(value);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Hold the boundary silhouette in ink before revealing the baked surface. */
export function getServicesColorReveal(motion: Pick<ServicesMotionState, "entry" | "exit">) {
  return smoothstep((motion.entry - .4) / .6) * (1 - smoothstep(motion.exit / .7));
}

/** One reversible scroll score; the prop exchange happens underneath the deck. */
export function getServicesMotionState(progress: number): ServicesMotionState {
  const p = Number.isFinite(progress) ? clamp01(progress) : 0;
  const entry = smoothstep(p / .1);
  const exit = smoothstep((p - .9) / .1);
  const scale = .006 + entry * (1 - exit) * .994;
  const kitLift = SERVICE_NODE_NAMES.map(() => 0);
  let index = 0;
  let outgoingIndex = 0;
  let rootRotation = -.16 * (1 - smootherstep(p / .1));

  for (let current = 0; current < SERVICE_POSES.length - 1; current += 1) {
    const start = SERVICE_POSES[current] + SERVICE_TURN_PADDING;
    const end = SERVICE_POSES[current + 1] - SERVICE_TURN_PADDING;
    if (p < start) break;
    if (p >= end) {
      index = current + 1;
      outgoingIndex = index;
      rootRotation = index * Math.PI / 2;
      continue;
    }

    const turn = (p - start) / (end - start);
    index = turn < .5 ? current : current + 1;
    outgoingIndex = current;
    rootRotation = (current + smootherstep(turn)) * Math.PI / 2;
    kitLift[current] = 1 - smoothstep(turn / .36);
    kitLift[current + 1] = smoothstep((turn - .64) / .36);
    return { index, outgoingIndex, rootRotation, kitLift, entry, exit, scale };
  }

  kitLift[index] = entry * (1 - exit);
  rootRotation += .16 * smootherstep((p - .9) / .1);
  return { index, outgoingIndex, rootRotation, kitLift, entry, exit, scale };
}
