import { expect, test } from "@playwright/test";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  compileHeroTimeline,
  getInteractionDepartureTarget,
  heroPhaseIds,
  sampleHeroTimeline,
} from "../../components/experience/hero-timeline";
import { narrativeScore } from "../../components/experience/narrative-score";

// Synthetic authoring data for tests only; it never becomes the live timeline.
function fixture() {
  const starts = [1, 150, 330, 650, 830, 1160, 1400, 1620, 1830, 2150, 2340];
  return {
    schemaVersion: 1,
    status: "ready",
    scope: "full-hero",
    asset: "mandegar_environment.glb",
    cameraNode: "camera_mandegar_master",
    clipName: "camera_master_loop",
    fps: 30,
    firstFrame: 1,
    lastFrame: 2500,
    phaseStartFrames: Object.fromEntries(heroPhaseIds.map((id, index) => [id, starts[index]])),
    phaseEndFrames: Object.fromEntries(heroPhaseIds.map((id, index) => [id, starts[index + 1] ?? 2500])),
    phaseRestFrames: Object.fromEntries(heroPhaseIds.map((id, index) => [id, (starts[index] + (starts[index + 1] ?? 2500)) / 2])),
    cues: {
      photoTextReady: 330,
      photoCapture: 420,
      photoDelivered: 500,
      photoExit: 620,
      lightingBeam1: 850,
      lightingBeam2: 910,
      lightingBeam3: 970,
      lightingBeam4: 1030,
      lightingBeam5: 1090,
      heroHandoffStart: 2440,
      heroHandoffEnd: 2500,
    },
  };
}

const clip = { cameraNode: "camera_mandegar_master", clipName: "camera_master_loop", durationSeconds: 2499 / 30 };

test("frame handoffs cover the existing hero chapters without enforcing equal camera durations", () => {
  const timeline = compileHeroTimeline(fixture(), clip);
  expect(timeline.phases.map((phase) => phase.id)).toEqual(narrativeScore.map((phase) => phase.id));
  expect(timeline.phases[3].start).toBeCloseTo(649 / 2499, 12);
  expect(timeline.phases[0].end - timeline.phases[0].start).not.toBe(timeline.phases[1].end - timeline.phases[1].start);
});

test("source frame offsets select the same authored frame and camera time in either scroll direction", () => {
  const timeline = compileHeroTimeline(fixture(), clip);
  for (const frame of [1, 1520, 2500, 1520, 1]) {
    const sample = sampleHeroTimeline(timeline, (frame - 1) / 2499);
    expect(sample.frame).toBeCloseTo(frame, 10);
    expect(sample.clipSeconds).toBeCloseTo((frame - 1) / 30, 10);
  }
  expect(sampleHeroTimeline(timeline, 1519 / 2499).phase.id).toBe("connection");
});

test("frame zero is valid and null never substitutes for a source frame", () => {
  const input = fixture();
  input.firstFrame = 0;
  input.lastFrame -= 1;
  for (const map of [input.phaseStartFrames, input.phaseEndFrames, input.phaseRestFrames, input.cues]) {
    for (const id of Object.keys(map)) (map as Record<string, number>)[id] -= 1;
  }
  expect(sampleHeroTimeline(compileHeroTimeline(input, clip), 0).frame).toBe(0);
  expect(() => compileHeroTimeline({ ...input, firstFrame: null }, clip)).toThrow("firstFrame needs a finite");
  expect(() => compileHeroTimeline({ ...input, cues: { ...input.cues, photoCapture: null } }, clip)).toThrow("cues.photoCapture needs a finite");
});

test("phase ends can derive from the next start and explicit gaps remain authored camera travel", () => {
  const input = fixture();
  const { phaseEndFrames, ...withoutEnds } = input;
  expect(compileHeroTimeline(withoutEnds, clip).phases.at(-1)?.end).toBe(1);
  const timeline = compileHeroTimeline({ ...input, phaseEndFrames: { ...phaseEndFrames, activation: 620 } }, clip);
  const travel = sampleHeroTimeline(timeline, 639 / 2499);
  expect(travel.frame).toBeCloseTo(640, 10);
  expect(travel.phase.id).toBe("activation");
  expect(travel.inViewingWindow).toBe(false);
  expect(travel.windowProgress).toBe(1);
  expect(travel.phase.transitionEnd).toBeCloseTo(649 / 2499, 12);
  expect(() => compileHeroTimeline({ ...input, phaseEndFrames: { ...phaseEndFrames, activation: 651 } }, clip)).toThrow("Viewing windows cannot overlap");
});

test("reversed chapter ranges and misspelled chapter IDs fail before integration", () => {
  const input = fixture();
  expect(() => compileHeroTimeline({ ...input, phaseStartFrames: { ...input.phaseStartFrames, engagement: 300 } }, clip)).toThrow("activation must end after it starts");
  expect(() => compileHeroTimeline({ ...input, phaseRestFrames: { ...input.phaseRestFrames, engagament: 740 } }, clip)).toThrow("engagament is not a hero chapter");
});

test("a stationary participation view defaults to its window start and leaves room for onward scroll", () => {
  const input = fixture();
  for (const frame of [null, 650]) {
    const timeline = compileHeroTimeline({ ...input, phaseRestFrames: { ...input.phaseRestFrames, engagement: frame } }, clip);
    expect(timeline.phases.find((phase) => phase.id === "engagement")?.viewFrame).toBe(650);
  }
  for (const frame of [649, 830]) {
    expect(() => compileHeroTimeline({ ...input, phaseRestFrames: { ...input.phaseRestFrames, engagement: frame } }, clip)).toThrow("phaseRestFrames.engagement");
  }
  const timeline = compileHeroTimeline({ ...input, phaseRestFrames: { ...input.phaseRestFrames, proof: null } }, clip);
  expect(timeline.phases.find((phase) => phase.id === "proof")?.viewFrame).toBe(1725);
});

test("an export with the wrong frame rate, camera or clip cannot become the live timeline", () => {
  const input = fixture();
  expect(() => compileHeroTimeline({ ...input, fps: 25 }, clip)).toThrow("Check FPS and export range");
  expect(() => compileHeroTimeline(input, { ...clip, cameraNode: "different_camera" })).toThrow("cameraNode does not match");
  expect(() => compileHeroTimeline(input, { ...clip, clipName: "different_clip" })).toThrow("clipName does not match");
  expect(() => compileHeroTimeline({ ...input, cameraNode: "other" }, { ...clip, cameraNode: "other" })).toThrow("cameraNode does not match");
  expect(() => compileHeroTimeline({ ...input, clipName: "other" }, { ...clip, clipName: "other" })).toThrow("clipName does not match");
  expect(() => compileHeroTimeline(input, { ...clip, durationSeconds: Number.NaN })).toThrow("positive finite duration");
});

test("fractional FPS and float32 export rounding preserve frame alignment", () => {
  const input = { ...fixture(), fps: 30000 / 1001 };
  const roundedClip = { ...clip, durationSeconds: Math.fround(2499 / input.fps) };
  const timeline = compileHeroTimeline(input, roundedClip);
  const sample = sampleHeroTimeline(timeline, 419 / 2499);
  expect(sample.frame).toBeCloseTo(420, 10);
  expect(sample.clipSeconds).toBeCloseTo(419 / 2499 * roundedClip.durationSeconds, 12);
  expect(sampleHeroTimeline(timeline, 1).clipSeconds).toBe(roundedClip.durationSeconds);
});

test("photo text and Ready can begin after camera arrival while photo and lamp cues remain in order", () => {
  const input = fixture();
  expect(compileHeroTimeline({ ...input, cues: { ...input.cues, photoTextReady: 350 } }, clip).cueFrames.photoTextReady).toBe(350);
  expect(() => compileHeroTimeline({ ...input, cues: { ...input.cues, photoDelivered: 420 } }, clip)).toThrow("photoDelivered must follow");
  expect(() => compileHeroTimeline({ ...input, cues: { ...input.cues, photoExit: 700 } }, clip)).toThrow("photoExit must be within");
  expect(() => compileHeroTimeline({ ...input, cues: { ...input.cues, lightingBeam2: 850 } }, clip)).toThrow("lightingBeam2 must follow");
  expect(() => compileHeroTimeline({ ...input, cues: { ...input.cues, heroHandoffStart: 2500 } }, clip)).toThrow("heroHandoffEnd must follow");
});

test("Finish targets the authored viewing window end without advancing a separate camera", () => {
  const timeline = compileHeroTimeline(fixture(), clip);
  for (const id of ["engagement", "experiences", "connection"] as const) {
    const phase = timeline.phases.find((item) => item.id === id)!;
    const target = getInteractionDepartureTarget(timeline, id, phase.preview)!;
    expect(target).toBe(phase.end);
    expect(sampleHeroTimeline(timeline, target).phase.id).toBe(heroPhaseIds[heroPhaseIds.indexOf(id) + 1]);
    expect(getInteractionDepartureTarget(timeline, id, phase.preview, "backward")).toBe(phase.start);
  }
});

test("Skip progress follows the actual playhead and Finish does not skip the moving departure", () => {
  const input = fixture();
  input.phaseEndFrames.engagement = 800;
  const timeline = compileHeroTimeline(input, clip);
  const mid = (650 + 800) / 2;
  const sample = sampleHeroTimeline(timeline, (mid - 1) / 2499);
  expect(sample.inViewingWindow).toBe(true);
  expect(sample.windowProgress).toBeCloseTo(0.5, 12);
  const target = getInteractionDepartureTarget(timeline, "engagement", sample.progress)!;
  expect(sampleHeroTimeline(timeline, target).frame).toBeCloseTo(800, 10);
  const travel = sampleHeroTimeline(timeline, 814 / 2499);
  expect(travel.frame).toBeCloseTo(815, 10);
  expect(travel.phase.id).toBe("engagement");
  expect(travel.inViewingWindow).toBe(false);
  expect(getInteractionDepartureTarget(timeline, "engagement", travel.progress)).toBeNull();
});

test("the last authored frame can serve as the final loop checkpoint", () => {
  const input = fixture();
  input.phaseStartFrames.loop = input.lastFrame;
  input.phaseEndFrames.invitation = 2450;
  input.phaseRestFrames.loop = input.lastFrame;
  const timeline = compileHeroTimeline(input, clip);
  const end = sampleHeroTimeline(timeline, 1);
  expect(end.frame).toBe(2500);
  expect(end.phase.id).toBe("loop");
  expect(end.windowProgress).toBe(1);
  expect(Number.isFinite(end.clipSeconds)).toBe(true);
});

test("late Finish callbacks cannot skip the next chapter and scroll demos never auto-depart", () => {
  const timeline = compileHeroTimeline(fixture(), clip);
  const game = timeline.phases.find((phase) => phase.id === "experiences")!;
  expect(getInteractionDepartureTarget(timeline, "experiences", game.end)).toBeNull();
  for (const id of ["activation", "reveal"] as const) {
    const phase = timeline.phases.find((item) => item.id === id)!;
    expect(getInteractionDepartureTarget(timeline, id, phase.preview)).toBeNull();
  }
});

test("playhead sampling clamps outside the clip and rejects non-finite input", () => {
  const timeline = compileHeroTimeline(fixture(), clip);
  expect(sampleHeroTimeline(timeline, -1).frame).toBe(1);
  expect(sampleHeroTimeline(timeline, 2).frame).toBe(2500);
  expect(() => sampleHeroTimeline(timeline, Number.NaN)).toThrow("progress must be finite");
});

test("preflight validates the real GLB with a matching synthetic handoff and rejects pending data in strict mode", async ({}, testInfo) => {
  const buffer = readFileSync(resolve("public/models/mandegar/mandegar_environment.glb"));
  const data = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)).toString("utf8"));
  const animation = data.animations.find((item: { name: string }) => item.name === clip.clipName);
  const duration = Math.max(...animation.samplers.map((sampler: { input: number }) => data.accessors[sampler.input].max[0]));
  const input = fixture();
  const toExportFrame = (frame: number) => 1 + (frame - 1) / 2499 * duration * input.fps;
  input.lastFrame = toExportFrame(input.lastFrame);
  for (const map of [input.phaseStartFrames, input.phaseEndFrames, input.phaseRestFrames, input.cues]) {
    for (const id of Object.keys(map)) (map as Record<string, number>)[id] = toExportFrame((map as Record<string, number>)[id]);
  }
  const file = testInfo.outputPath("synthetic-camera-handoff.json");
  writeFileSync(file, JSON.stringify(input));
  const script = resolve("scripts/check-camera-timing.mjs");
  const report = JSON.parse(execFileSync(process.execPath, [script, "--handoff", file, "--json", "--require-ready"], { encoding: "utf8" }));
  expect(report.status).toBe("valid");
  expect(report.ready).toBe(true);
  expect(report.phases).toHaveLength(11);
  writeFileSync(file, JSON.stringify({ ...input, status: "draft", fps: null }));
  const pending = spawnSync(process.execPath, [script, "--handoff", file, "--json", "--require-ready"], { encoding: "utf8" });
  expect(pending.status).toBe(1);
  expect(JSON.parse(pending.stdout).status).toBe("pending");
});

test("preflight reads actual binary keyframe times when accessor metadata is stale", async ({}, testInfo) => {
  const buffer = readFileSync(resolve("public/models/mandegar/mandegar_environment.glb"));
  const jsonLength = buffer.readUInt32LE(12);
  const data = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString("utf8"));
  const animation = data.animations.find((item: { name: string }) => item.name === clip.clipName);
  const actualEnds = animation.samplers.map((sampler: { input: number }) => {
    const accessor = data.accessors[sampler.input];
    const view = data.bufferViews[accessor.bufferView];
    const offset = 28 + jsonLength + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const last = buffer.readFloatLE(offset + (accessor.count - 1) * (view.byteStride ?? 4));
    accessor.max = [1000];
    return last;
  });
  const json = Buffer.from(JSON.stringify(data));
  const paddedJson = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20);
  json.copy(paddedJson);
  const binaryChunk = buffer.subarray(20 + jsonLength);
  const header = Buffer.alloc(20);
  buffer.copy(header, 0, 0, 20);
  header.writeUInt32LE(20 + paddedJson.length + binaryChunk.length, 8);
  header.writeUInt32LE(paddedJson.length, 12);
  const asset = testInfo.outputPath("stale-metadata.glb");
  const handoff = testInfo.outputPath("pending-camera-handoff.json");
  writeFileSync(asset, Buffer.concat([header, paddedJson, binaryChunk]));
  writeFileSync(handoff, JSON.stringify({ ...fixture(), status: "draft", fps: null }));
  const report = JSON.parse(execFileSync(process.execPath, [
    resolve("scripts/check-camera-timing.mjs"), "--asset", asset, "--handoff", handoff, "--json",
  ], { encoding: "utf8" }));
  expect(report.clip.durationSeconds).toBe(Math.max(...actualEnds));
});
