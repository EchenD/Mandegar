import { expect, test } from "@playwright/test";
import { narrativeScore } from "../../components/experience/narrative-score";
import {
  applyCreativeStagePresetSnapshot,
  getCameraLoopSampleProgress,
  getCreativeStagePresetSnapshot,
  getStageFrame,
  getStagePreset,
  resetCreativeStageTuning,
  setCreativeStageTuning,
  stagePresets,
  validateStagePresets,
} from "../../components/experience/stage-presets";

test.describe("creative stage presets", () => {
  test("define one valid renderer preset for every narrative stage", () => {
    expect(validateStagePresets()).toBe(true);
    expect(Object.keys(stagePresets)).toHaveLength(9);
    expect(narrativeScore.map((stage) => getStagePreset(stage.id).id)).toEqual(
      narrativeScore.map((stage) => stage.id),
    );
  });

  test("give the authored focus stages distinct spatial information", () => {
    expect(stagePresets.arrival.spatialInfo.mode).toBe("hidden");
    expect(stagePresets.discovery.spatialInfo.mode).toBe("assembly");
    expect(stagePresets.activation.spatialInfo.mode).toBe("activation");
    expect(stagePresets.experiences.spatialInfo.mode).toBe("zones");
    expect(stagePresets.proof.spatialInfo.mode).toBe("projects");
    expect(stagePresets.intelligence.spatialInfo.mode).toBe("metrics");
    expect(stagePresets.invitation.spatialInfo.mode).toBe("invitation");
  });

  test("builds silence, guidance and coordinated energy through stages one to three", () => {
    const opening = [
      stagePresets.arrival,
      stagePresets.discovery,
      stagePresets.activation,
    ];
    expect(opening.map((stage) => stage.camera.pointer)).toEqual([0.08, 0.24, 0.48]);
    expect(opening.map((stage) => stage.particles.presence)).toEqual([0.18, 0.38, 0.62]);
    expect(opening.map((stage) => stage.particles.signal)).toEqual([0, 0.12, 0.44]);
    expect(opening.map((stage) => stage.lighting.energy)).toEqual([0.14, 0.32, 0.58]);
    expect(opening.map((stage) => stage.lighting.contrast)).toEqual([0.12, 0.28, 0.5]);
  });

  test("interpolates renderer controls automatically between authored previews", () => {
    const midpoint = (narrativeScore[1].preview + narrativeScore[2].preview) / 2;
    const frame = getStageFrame(midpoint);

    expect(frame.current.id).toBe("discovery");
    expect(frame.next.id).toBe("activation");
    expect(frame.mix).toBeCloseTo(0.5, 5);
    expect(frame.lightEnergy).toBeCloseTo(
      (stagePresets.discovery.lighting.energy + stagePresets.activation.lighting.energy) / 2,
      5,
    );
  });

  test("applies, exports and resets non-destructive creative overrides", () => {
    setCreativeStageTuning("discovery", "particleSignal", 0.73);
    setCreativeStageTuning("discovery", "lightEnergy", 2);

    expect(getStagePreset("discovery").particles.signal).toBe(0.73);
    expect(getStagePreset("discovery").lighting.energy).toBe(1);
    expect(stagePresets.discovery.particles.signal).toBe(0.12);
    expect(getCreativeStagePresetSnapshot().stages.discovery?.particleSignal).toBe(0.73);

    resetCreativeStageTuning();
    expect(getStagePreset("discovery").particles.signal).toBe(0.12);
    expect(applyCreativeStagePresetSnapshot({
      version: 1,
      stages: { discovery: { particleSignal: 0.41 } },
    })).toBe(true);
    expect(getStagePreset("discovery").particles.signal).toBe(0.41);
    resetCreativeStageTuning();
  });

  test("matches procedural and authored camera channels across the loop seam", () => {
    const arrival = getStageFrame(0.0005);
    const loopEnd = getStageFrame(0.9995);
    const loopRest = getStageFrame(narrativeScore[8].preview);

    expect(loopEnd.cameraLife).toBeCloseTo(arrival.cameraLife, 8);
    expect(loopEnd.cameraPointer).toBeCloseTo(arrival.cameraPointer, 8);
    expect(loopRest.cameraLife).toBe(stagePresets.loop.camera.life);
    expect(loopRest.cameraPointer).toBe(stagePresets.loop.camera.pointer);
    expect(getCameraLoopSampleProgress(0.0005)).toBe(0);
    expect(getCameraLoopSampleProgress(0.9995)).toBe(1);
  });
});
