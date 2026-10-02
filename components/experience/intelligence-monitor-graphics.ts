import { narrativeScore } from "./narrative-score";
import { interactionSurfaceSizes } from "./scene-config";

export const intelligenceMonitorSize = interactionSurfaceSizes.videoWall.canvas;
export const intelligenceMonitorFrameInterval = 1000 / 24;

const tau = Math.PI * 2;
const waveSamples = 112;
const waveCount = 3;
const barCount = 16;
const pointCount = 24;
const binaryRowCount = 3;
const binaryFrameCount = 32;
const binaryBitCount = 56;
const intelligenceBeat = narrativeScore.find((beat) => beat.id === "intelligence")!;
const waveColors = ["rgba(107, 225, 255, .9)", "rgba(34, 92, 255, .74)", "rgba(247, 247, 244, .28)"];
const binaryColors = ["rgba(117, 216, 255, .34)", "rgba(79, 125, 255, .38)", "rgba(247, 247, 244, .22)"];

export type IntelligenceSignalState = {
  person: string | null;
  seed: number;
  time: number;
  coefficients: Float32Array;
  targets: Float32Array;
  barCoefficients: Float32Array;
  barTargets: Float32Array;
  waves: Float32Array;
  bars: Float32Array;
  points: Float32Array;
  binaryRows: string[];
  binaryFrame: number;
};

/** A deterministic illustrative pattern, unrelated to personal or visitor data. */
export function getIntelligenceSignalSeed(id: string | null) {
  const value = id ?? "ambient-signal";
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

export function getIntelligenceSignalUnit(seed: number, index: number) {
  let value = (Math.floor(seed * 4294967295) ^ Math.imul(index + 1, 0x9e3779b9)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

export function retargetIntelligenceSignal(state: IntelligenceSignalState, person: string | null) {
  if (state.person === person && state.targets[0] !== 0) return false;
  state.person = person;
  state.seed = getIntelligenceSignalSeed(person);
  for (let index = 0; index < waveCount; index += 1) {
    state.targets[index * 3] = 1.15 + getIntelligenceSignalUnit(state.seed, index * 3) * 2.6;
    state.targets[index * 3 + 1] = 0.3 + getIntelligenceSignalUnit(state.seed, index * 3 + 1) * 0.48;
    state.targets[index * 3 + 2] = getIntelligenceSignalUnit(state.seed, index * 3 + 2) * tau;
  }
  for (let index = 0; index < barCount; index += 1) {
    state.barTargets[index] = 0.18 + getIntelligenceSignalUnit(state.seed, 9 + index) * 0.72;
  }
  // Cache the complete rolling cycle only when a new illustrative seed arrives.
  // Animated frames select existing strings rather than allocate text each paint.
  for (let frame = 0; frame < binaryFrameCount; frame += 1) {
    for (let row = 0; row < binaryRowCount; row += 1) {
      let text = "";
      for (let bit = 0; bit < binaryBitCount; bit += 1) {
        if (bit > 0 && bit % 8 === 0) text += " ";
        const index = 25 + row * 64 + (frame * 2 + row * 7 + bit) % 64;
        text += getIntelligenceSignalUnit(state.seed, index) >= 0.5 ? "1" : "0";
      }
      state.binaryRows[frame * binaryRowCount + row] = text;
    }
  }
  return true;
}

export function getIntelligenceBinaryRow(state: IntelligenceSignalState, row: number) {
  return state.binaryRows[state.binaryFrame * binaryRowCount + row];
}

export function createIntelligenceSignalState(person: string | null = null): IntelligenceSignalState {
  const state: IntelligenceSignalState = {
    person: null,
    seed: 0,
    time: 0,
    coefficients: new Float32Array(waveCount * 3),
    targets: new Float32Array(waveCount * 3),
    barCoefficients: new Float32Array(barCount),
    barTargets: new Float32Array(barCount),
    waves: new Float32Array(waveSamples * waveCount),
    bars: new Float32Array(barCount),
    points: new Float32Array(pointCount * 2),
    binaryRows: new Array<string>(binaryFrameCount * binaryRowCount).fill(""),
    binaryFrame: 0,
  };
  retargetIntelligenceSignal(state, person);
  state.coefficients.set(state.targets);
  state.barCoefficients.set(state.barTargets);
  stepIntelligenceSignal(state, 0);
  return state;
}

/** Mutates only the preallocated signal buffers; callers pause by not stepping. */
export function stepIntelligenceSignal(state: IntelligenceSignalState, delta: number, reducedMotion = false) {
  const elapsed = Number.isFinite(delta) ? Math.min(0.125, Math.max(0, delta)) : 0;
  if (!reducedMotion) state.time = (state.time + elapsed) % (tau * 100);
  const blend = reducedMotion ? 1 : 1 - Math.exp(-elapsed * 13);
  for (let index = 0; index < state.coefficients.length; index += 1) {
    state.coefficients[index] += (state.targets[index] - state.coefficients[index]) * blend;
  }
  for (let index = 0; index < barCount; index += 1) {
    state.barCoefficients[index] += (state.barTargets[index] - state.barCoefficients[index]) * blend;
    const pulse = reducedMotion ? 0.88 : 0.79 + Math.sin(state.time * 0.9 + index * 0.61) * 0.16;
    state.bars[index] = state.barCoefficients[index] * pulse;
  }
  const clock = reducedMotion ? 0 : state.time;
  state.binaryFrame = Math.floor(clock * 4) % binaryFrameCount;
  for (let wave = 0; wave < waveCount; wave += 1) {
    const frequency = state.coefficients[wave * 3];
    const amplitude = state.coefficients[wave * 3 + 1];
    const offset = state.coefficients[wave * 3 + 2];
    for (let index = 0; index < waveSamples; index += 1) {
      const x = index / (waveSamples - 1);
      const envelope = Math.sin(x * Math.PI);
      const primary = Math.sin(x * tau * frequency - clock * (0.72 + wave * 0.14) + offset);
      const secondary = Math.sin(x * tau * (frequency * 0.45 + 0.75) + clock * 0.46 + offset * 0.6);
      state.waves[wave * waveSamples + index] = (primary * 0.76 + secondary * 0.24) * amplitude * envelope;
    }
  }
  for (let index = 0; index < pointCount; index += 1) {
    const x = (index / pointCount + clock * 0.055) % 1;
    const sample = x * (waveSamples - 1);
    const before = Math.floor(sample);
    const after = Math.min(waveSamples - 1, before + 1);
    state.points[index * 2] = x;
    state.points[index * 2 + 1] = state.waves[before] + (state.waves[after] - state.waves[before]) * (sample - before);
  }
}

function smooth(value: number) {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}

/** Scroll fades are restricted to the actual Intelligence beat, in both directions. */
export function getIntelligenceMonitorVisibility(progress: number, sequence: string = "loop") {
  if (sequence !== "loop" || !Number.isFinite(progress) || progress <= intelligenceBeat.start || progress >= intelligenceBeat.end) return 0;
  const fade = Math.min(0.016, (intelligenceBeat.end - intelligenceBeat.start) * 0.25);
  return Math.min(smooth((progress - intelligenceBeat.start) / fade), smooth((intelligenceBeat.end - progress) / fade));
}

export function advanceIntelligenceMonitorBlend(current: number, target: number, delta: number) {
  const start = Number.isFinite(current) ? Math.max(0, Math.min(1, current)) : 0;
  const desired = Number.isFinite(target) ? Math.max(0, Math.min(1, target)) : 0;
  const elapsed = Number.isFinite(delta) ? Math.max(0, Math.min(1, delta)) : 0;
  const distance = elapsed / 0.18;
  return desired > start ? Math.min(desired, start + distance) : Math.max(desired, start - distance);
}

/** Resources and text are cached once; painting reuses the same state and canvas. */
export function createIntelligenceMonitorPainter(context: CanvasRenderingContext2D, _signal: string, example: string, rtl: boolean) {
  const { width, height } = intelligenceMonitorSize;
  const background = context.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#09141c");
  background.addColorStop(0.6, "#111a23");
  background.addColorStop(1, "#0c1320");
  const startX = width * 0.045;
  const waveWidth = width * 0.665;
  const baseline = height * 0.48;
  const amplitude = height * 0.235;
  const ringX = width * 0.893;
  const ringY = height * 0.39;
  const ringRadius = height * 0.135;
  return (state: IntelligenceSignalState) => {
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.direction = "ltr";
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.font = '500 16px ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", monospace';
    for (let row = 0; row < binaryRowCount; row += 1) {
      context.fillStyle = binaryColors[row];
      context.fillText(getIntelligenceBinaryRow(state, row), startX, height * 0.13 + row * 24);
    }
    context.strokeStyle = "rgba(117, 216, 255, .065)";
    context.lineWidth = 1;
    for (let row = -1; row <= 1; row += 1) {
      context.beginPath();
      context.moveTo(startX, baseline + row * height * 0.16);
      context.lineTo(startX + waveWidth, baseline + row * height * 0.16);
      context.stroke();
    }
    for (let wave = waveCount - 1; wave >= 0; wave -= 1) {
      context.strokeStyle = waveColors[wave];
      context.lineWidth = wave === 0 ? 3.6 : 2;
      context.beginPath();
      for (let index = 0; index < waveSamples; index += 1) {
        const x = startX + index / (waveSamples - 1) * waveWidth;
        const y = baseline + state.waves[wave * waveSamples + index] * amplitude;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.stroke();
    }
    context.fillStyle = "rgba(155, 234, 255, .72)";
    for (let index = 0; index < pointCount; index += 1) {
      context.beginPath();
      context.arc(startX + state.points[index * 2] * waveWidth, baseline + state.points[index * 2 + 1] * amplitude, index % 5 === 0 ? 3 : 1.5, 0, tau);
      context.fill();
    }
    context.strokeStyle = "rgba(34, 92, 255, .4)";
    context.lineWidth = 2.5;
    context.beginPath();
    context.arc(ringX, ringY, ringRadius, 0, tau);
    context.stroke();
    context.strokeStyle = "rgba(117, 216, 255, .78)";
    context.lineWidth = 4;
    context.beginPath();
    context.arc(ringX, ringY, ringRadius, state.time * 0.38, state.time * 0.38 + Math.PI * 0.7);
    context.stroke();
    context.strokeStyle = "rgba(247, 247, 244, .22)";
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(ringX, ringY, ringRadius * 0.67, -state.time * 0.21, -state.time * 0.21 + Math.PI * 1.35);
    context.stroke();
    const barWidth = 9;
    const barGap = 9;
    const histogramWidth = barCount * (barWidth + barGap) - barGap;
    const histogramX = ringX - histogramWidth / 2;
    const histogramY = height * 0.81;
    for (let index = 0; index < barCount; index += 1) {
      const barHeight = state.bars[index] * height * 0.2;
      context.fillStyle = index % 4 === 0 ? "rgba(34, 92, 255, .8)" : "rgba(117, 216, 255, .55)";
      context.fillRect(histogramX + index * (barWidth + barGap), histogramY - barHeight, barWidth, barHeight);
    }
    context.direction = rtl ? "rtl" : "ltr";
    context.textAlign = rtl ? "right" : "left";
    context.textBaseline = "middle";
    context.font = '450 17px "Vazirmatn Variable", Tahoma, sans-serif';
    context.fillStyle = "rgba(247, 247, 244, .5)";
    context.fillText(example, rtl ? width - startX : startX, height * 0.91, width * 0.6);
  };
}
