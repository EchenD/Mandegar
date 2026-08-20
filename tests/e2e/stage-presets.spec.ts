import { expect, test } from "@playwright/test";
import { narrativeScore } from "../../components/experience/narrative-score";
import { bakedSceneContract } from "../../components/experience/baked-scene-contract";
import { sceneTokens } from "../../components/experience/scene-config";
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
  test("keeps the modular asset naming contract stable", () => {
    expect(bakedSceneContract.environment.section).toBe("env_shell");
    expect(Object.values(bakedSceneContract.exhibition.sections).map((section) => section.root))
      .toEqual(["section_central", "section_left", "section_right"]);
    expect(Object.values(bakedSceneContract.exhibition.screens)).toEqual([
      "screen_video_wall_21x9",
      "screen_interactive_16x9",
      "screen_game_16x9",
      "screen_main_16x9",
    ]);
  });

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
    expect(opening.map((stage) => [
      stage.production.centralReveal,
      stage.production.leftReveal,
      stage.production.rightReveal,
    ])).toEqual([
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
    ]);
  });

  test("authors reveal, peak media, crowd, and intelligence as separate channels", () => {
    expect(stagePresets.reveal.production.rightReveal).toBe(1);
    expect(stagePresets.reveal.production.environmentPeak).toBe(0);
    expect(stagePresets.experiences.production.interactiveScreen).toBe(1);
    expect(stagePresets.proof.production.videoWallScreen).toBe(1);
    expect(stagePresets.proof.production.mainScreen).toBe(1);
    expect(stagePresets.proof.production.crowdPresence).toBe(1);
    expect(stagePresets.intelligence.production.crowdPresence).toBe(1);
    expect(stagePresets.intelligence.production.dataFlow).toBe(1);
  });

  test("holds the complete quiet architecture before staggered activation", () => {
    const quietHold = getStageFrame(0.485).production;
    expect(quietHold.centralPeak).toBe(0);
    expect(quietHold.environmentPeak).toBe(0);
    expect(quietHold.leftPeak).toBe(0);
    expect(quietHold.rightPeak).toBe(0);
    expect(quietHold.mainScreen).toBe(0);

    const environmentWake = getStageFrame(0.5).production;
    expect(environmentWake.environmentPeak).toBeGreaterThan(0);
    expect(environmentWake.centralPeak).toBe(0);
    expect(environmentWake.leftPeak).toBe(0);
    expect(environmentWake.rightPeak).toBe(0);
    expect(environmentWake.mainScreen).toBe(0);
  });

  test("settles product HUDs at their named review checkpoints", () => {
    const checkpoints = {
      central: narrativeScore.find((stage) => stage.id === "discovery")!.preview,
      left: narrativeScore.find((stage) => stage.id === "activation")!.preview,
      right: narrativeScore.find((stage) => stage.id === "reveal")!.preview,
      intelligence: narrativeScore.find((stage) => stage.id === "intelligence")!.preview,
    } as const;
    Object.entries(checkpoints).forEach(([id, preview]) => {
      const range = sceneTokens.bakedScene.hudMoments[
        id as keyof typeof sceneTokens.bakedScene.hudMoments
      ];
      expect(range[0]).toBeLessThan(preview);
      expect(range[1]).toBeGreaterThan(preview);
    });
  });

  test("stages media and the human peak in authored order", () => {
    const architectureWake = getStageFrame(0.52).production;
    expect(architectureWake.environmentPeak).toBe(1);
    expect(architectureWake.centralPeak).toBeCloseTo(0, 8);
    expect(architectureWake.leftPeak).toBeCloseTo(0, 8);
    expect(architectureWake.rightPeak).toBeCloseTo(0, 8);
    expect(architectureWake.videoWallScreen).toBe(0);

    const centralWake = getStageFrame(0.535).production;
    expect(centralWake.environmentPeak).toBe(1);
    expect(centralWake.centralPeak).toBeGreaterThan(centralWake.leftPeak);
    expect(centralWake.leftPeak).toBe(0);

    const rightWake = getStageFrame(0.565).production;
    expect(rightWake.leftPeak).toBeGreaterThan(rightWake.rightPeak);

    const mediaWake = getStageFrame(0.574).production;
    expect(mediaWake.videoWallScreen).toBeGreaterThan(mediaWake.interactiveScreen);
    expect(mediaWake.interactiveScreen).toBeGreaterThan(mediaWake.gameScreen);
    expect(mediaWake.mainScreen).toBe(0);

    expect(getStageFrame(0.63).production.crowdPresence).toBe(0);
    expect(getStageFrame(0.67).production.crowdPresence).toBeGreaterThan(0);
    expect(getStageFrame(0.7).production.crowdPresence).toBe(1);
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
    expect(loopEnd.production.centralReveal).toBeCloseTo(arrival.production.centralReveal, 8);
    expect(loopEnd.production.leftReveal).toBeCloseTo(arrival.production.leftReveal, 8);
    expect(loopEnd.production.rightReveal).toBeCloseTo(arrival.production.rightReveal, 8);
    expect(loopEnd.production.crowdPresence).toBeCloseTo(arrival.production.crowdPresence, 8);
    expect(loopEnd.production.dataFlow).toBeCloseTo(arrival.production.dataFlow, 8);
    expect(loopRest.cameraLife).toBe(stagePresets.loop.camera.life);
    expect(loopRest.cameraPointer).toBe(stagePresets.loop.camera.pointer);
    expect(getCameraLoopSampleProgress(0.0005)).toBe(0);
    expect(getCameraLoopSampleProgress(0.9995)).toBe(1);
  });
});
