import { expect, test } from "@playwright/test";
import {
  advanceIntelligenceMonitorBlend,
  createIntelligenceMonitorPainter,
  createIntelligenceSignalState,
  getIntelligenceBinaryRow,
  getIntelligenceMonitorVisibility,
  getIntelligenceSignalSeed,
  getIntelligenceSignalUnit,
  intelligenceMonitorFrameInterval,
  intelligenceMonitorSize,
  retargetIntelligenceSignal,
  stepIntelligenceSignal,
} from "../../components/experience/intelligence-monitor-graphics";
import { narrativeScore } from "../../components/experience/narrative-score";
import { interactionSurfaceSizes } from "../../components/experience/scene-config";

test("Intelligence graphics use the exact measured wide monitor and a bounded paint rate", () => {
  expect(intelligenceMonitorSize).toBe(interactionSurfaceSizes.videoWall.canvas);
  expect(intelligenceMonitorSize).toEqual({ width: 1740, height: 450 });
  expect(1000 / intelligenceMonitorFrameInterval).toBe(24);
});

test("illustrative person patterns are stable and share normalized coefficients with the head signal", () => {
  const seed = getIntelligenceSignalSeed("Human_12");
  expect(seed).toBe(getIntelligenceSignalSeed("Human_12"));
  expect(seed).toBeGreaterThanOrEqual(0);
  expect(seed).toBeLessThanOrEqual(1);
  expect(seed).not.toBe(getIntelligenceSignalSeed("Human_13"));
  const first = createIntelligenceSignalState("Human_12");
  const second = createIntelligenceSignalState("Human_12");
  expect(Array.from(first.waves)).toEqual(Array.from(second.waves));
  expect(Array.from(first.bars)).toEqual(Array.from(second.bars));
  expect(first.barTargets[0]).toBeCloseTo(0.18 + getIntelligenceSignalUnit(seed, 9) * 0.72);
});

test("rapid retargeting keeps the current curve and converges only to the latest selection", () => {
  const state = createIntelligenceSignalState("Human_1");
  const current = Array.from(state.coefficients);
  retargetIntelligenceSignal(state, "Human_2");
  retargetIntelligenceSignal(state, "Human_3");
  retargetIntelligenceSignal(state, "Human_19");
  expect(state.person).toBe("Human_19");
  expect(Array.from(state.coefficients)).toEqual(current);
  expect(Array.from(state.targets)).toEqual(Array.from(createIntelligenceSignalState("Human_19").targets));
  for (let frame = 0; frame < 80; frame += 1) stepIntelligenceSignal(state, 0.01);
  for (let index = 0; index < state.targets.length; index += 1) {
    expect(Math.abs(state.coefficients[index] - state.targets[index])).toBeLessThan(0.0002);
  }
  expect(retargetIntelligenceSignal(state, "Human_19")).toBe(false);
  expect(retargetIntelligenceSignal(state, null)).toBe(true);
  expect(state.seed).toBe(getIntelligenceSignalSeed(null));
});

test("waves, bars and streams animate in place with finite bounded buffers", () => {
  const state = createIntelligenceSignalState("Human_7");
  const waves = state.waves;
  const bars = state.bars;
  const points = state.points;
  const initial = Array.from(waves);
  for (let frame = 0; frame < 400; frame += 1) stepIntelligenceSignal(state, 1 / 24);
  expect(state.waves).toBe(waves);
  expect(state.bars).toBe(bars);
  expect(state.points).toBe(points);
  expect(Array.from(waves)).not.toEqual(initial);
  for (const value of waves) { expect(Number.isFinite(value)).toBe(true); expect(Math.abs(value)).toBeLessThanOrEqual(1); }
  for (const value of bars) { expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThanOrEqual(1); }
  for (let index = 0; index < points.length; index += 2) {
    expect(points[index]).toBeGreaterThanOrEqual(0);
    expect(points[index]).toBeLessThanOrEqual(1);
    expect(Math.abs(points[index + 1])).toBeLessThanOrEqual(1);
  }
  const time = state.time;
  stepIntelligenceSignal(state, Number.NaN);
  stepIntelligenceSignal(state, Number.POSITIVE_INFINITY);
  expect(state.time).toBe(time);
});

test("reduced motion holds a complete static pattern and applies new selections without oscillation", () => {
  const state = createIntelligenceSignalState("Human_4");
  stepIntelligenceSignal(state, 0.1);
  retargetIntelligenceSignal(state, "Human_9");
  const time = state.time;
  stepIntelligenceSignal(state, 0.1, true);
  const waves = Array.from(state.waves);
  const bars = Array.from(state.bars);
  const points = Array.from(state.points);
  const binary = getIntelligenceBinaryRow(state, 0);
  for (let frame = 0; frame < 20; frame += 1) stepIntelligenceSignal(state, 0.1, true);
  expect(state.time).toBe(time);
  expect(Array.from(state.coefficients)).toEqual(Array.from(state.targets));
  expect(Array.from(state.waves)).toEqual(waves);
  expect(Array.from(state.bars)).toEqual(bars);
  expect(Array.from(state.points)).toEqual(points);
  expect(state.binaryFrame).toBe(0);
  expect(getIntelligenceBinaryRow(state, 0)).toBe(binary);
});

test("binary rows roll through cached seed-specific bit patterns without per-frame text allocation", () => {
  const state = createIntelligenceSignalState("Human_7");
  const pool = state.binaryRows;
  const initial = getIntelligenceBinaryRow(state, 0);
  expect(pool).toEqual(createIntelligenceSignalState("Human_7").binaryRows);
  expect(pool).not.toEqual(createIntelligenceSignalState("Human_8").binaryRows);
  for (const row of pool) expect(row).toMatch(/^(?:[01]{8} ){6}[01]{8}$/);
  stepIntelligenceSignal(state, 0.125);
  expect(getIntelligenceBinaryRow(state, 0)).toBe(initial);
  stepIntelligenceSignal(state, 0.125);
  expect(state.binaryFrame).toBe(1);
  expect(getIntelligenceBinaryRow(state, 0)).not.toBe(initial);
  expect(getIntelligenceBinaryRow(state, 0)).toBe(pool[3]);
  for (let frame = 0; frame < 120; frame += 1) stepIntelligenceSignal(state, 1 / 24);
  expect(state.binaryRows).toBe(pool);
  retargetIntelligenceSignal(state, "Human_8");
  expect(state.binaryRows).toBe(pool);
  expect(pool).toEqual(createIntelligenceSignalState("Human_8").binaryRows);
});

test("monitor scroll fades are symmetric on reverse and hidden outside the Intelligence beat", () => {
  const beat = narrativeScore.find((candidate) => candidate.id === "intelligence")!;
  expect(getIntelligenceMonitorVisibility(beat.preview)).toBe(1);
  expect(getIntelligenceMonitorVisibility(beat.start)).toBe(0);
  expect(getIntelligenceMonitorVisibility(beat.end)).toBe(0);
  expect(getIntelligenceMonitorVisibility(beat.start - 0.001)).toBe(0);
  expect(getIntelligenceMonitorVisibility(beat.end + 0.001)).toBe(0);
  expect(getIntelligenceMonitorVisibility(beat.start + 0.008)).toBeCloseTo(getIntelligenceMonitorVisibility(beat.end - 0.008));
  expect(getIntelligenceMonitorVisibility(beat.preview, "intro")).toBe(0);
  expect(getIntelligenceMonitorVisibility(Number.NaN)).toBe(0);
});

test("temporal monitor fading handles scroll jumps and reverses from the current blend", () => {
  const halfwayOut = advanceIntelligenceMonitorBlend(1, 0, 0.09);
  expect(halfwayOut).toBeCloseTo(0.5);
  expect(advanceIntelligenceMonitorBlend(halfwayOut, 1, 0.045)).toBeCloseTo(0.75);
  expect(advanceIntelligenceMonitorBlend(0.75, 0, 0.18)).toBe(0);
  expect(advanceIntelligenceMonitorBlend(1, 0, 1)).toBe(0);
  expect(advanceIntelligenceMonitorBlend(0, 1, 1)).toBe(1);
  expect(advanceIntelligenceMonitorBlend(0.4, 1, Number.NaN)).toBe(0.4);
  expect(advanceIntelligenceMonitorBlend(Number.NaN, -1, 0.1)).toBe(0);
});

test("the painter shows localized participation and audience labels without binary rows", () => {
  const labels: string[] = [];
  const rectangles: number[][] = [];
  const context = {
    createLinearGradient: () => ({ addColorStop: () => {} }),
    fillRect: (...values: number[]) => { rectangles.push(values); },
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    arc: () => {},
    fill: () => {},
    fillText: (value: string) => { labels.push(value); },
  } as unknown as CanvasRenderingContext2D;
  const paint = createIntelligenceMonitorPainter(context, "سیگنال نمونه", "داده نمونه · شبیه‌سازی‌شده", true);
  paint(createIntelligenceSignalState("Human_11"));
  expect(rectangles[0]).toEqual([0, 0, 1740, 450]);
  expect(labels).toEqual(["سیگنال نمونه", "داده نمونه · شبیه‌سازی‌شده"]);
  expect(labels.some((label) => /^[01 ]+$/.test(label))).toBe(false);
  expect(context.direction).toBe("rtl");
  expect(context.textAlign).toBe("right");
});
