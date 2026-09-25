import { expect, test } from "@playwright/test";
import { narrativeScore } from "../../components/experience/narrative-score";
import { bakedSceneContract } from "../../components/experience/baked-scene-contract";
import { sceneTokens } from "../../components/experience/scene-config";
import { interactionRegistry } from "../../components/experience/interactions/interaction-registry";
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
  const preview = (id: (typeof narrativeScore)[number]["id"]) => (
    narrativeScore.find((stage) => stage.id === id)!.preview
  );
  const between = (
    from: (typeof narrativeScore)[number]["id"],
    to: (typeof narrativeScore)[number]["id"],
    mix: number,
  ) => preview(from) + (preview(to) - preview(from)) * mix;

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
    expect(Object.keys(stagePresets)).toHaveLength(11);
    expect(narrativeScore.map((stage) => getStagePreset(stage.id).id)).toEqual(
      narrativeScore.map((stage) => stage.id),
    );
  });

  test("give the authored focus stages distinct spatial information", () => {
    expect(stagePresets.arrival.spatialInfo.mode).toBe("hidden");
    expect(stagePresets.discovery.spatialInfo.mode).toBe("assembly");
    expect(stagePresets.activation.spatialInfo.mode).toBe("activation");
    expect(stagePresets.engagement.spatialInfo.mode).toBe("activation");
    expect(stagePresets.experiences.spatialInfo.mode).toBe("zones");
    expect(stagePresets.connection.spatialInfo.mode).toBe("zones");
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
      [1, 1, 1],
      [1, 1, 1],
    ]);
  });

  test("reveals all exhibition sections early with a short stagger", () => {
    const beforeReveal = getStageFrame(between("arrival", "discovery", 0.28)).production;
    expect(beforeReveal.centralReveal).toBe(0);
    expect(beforeReveal.leftReveal).toBe(0);
    expect(beforeReveal.rightReveal).toBe(0);

    const stagger = getStageFrame(between("arrival", "discovery", 0.44)).production;
    expect(stagger.centralReveal).toBeGreaterThan(stagger.leftReveal);
    expect(stagger.leftReveal).toBeGreaterThan(stagger.rightReveal);

    const settled = getStageFrame(between("arrival", "discovery", 0.76)).production;
    expect(settled.centralReveal).toBe(1);
    expect(settled.leftReveal).toBe(1);
    expect(settled.rightReveal).toBe(1);
  });

  test("authors reveal, peak media, crowd, and intelligence as separate channels", () => {
    expect(stagePresets.reveal.production.rightReveal).toBe(1);
    expect(stagePresets.discovery.production.crowdPresence).toBe(1);
    expect(stagePresets.discovery.production.environmentPeak).toBe(0);
    expect(stagePresets.activation.production.environmentPeak).toBe(1);
    expect(stagePresets.activation.production.interactiveScreen).toBe(1);
    expect(stagePresets.reveal.production.videoWallScreen).toBe(1);
    expect(stagePresets.experiences.production.gameScreen).toBe(1);
    expect(stagePresets.experiences.production.mainScreen).toBe(1);
    expect(stagePresets.proof.production.videoWallScreen).toBe(1);
    expect(stagePresets.proof.production.mainScreen).toBe(1);
    expect(stagePresets.proof.production.crowdPresence).toBe(1);
    expect(stagePresets.intelligence.production.crowdPresence).toBe(1);
    expect(stagePresets.intelligence.production.dataFlow).toBe(1);
  });

  test("reveals the crowd before the staggered texture transition", () => {
    const crowdSettled = getStageFrame(between("arrival", "discovery", 0.96)).production;
    expect(crowdSettled.crowdPresence).toBe(1);
    expect(crowdSettled.environmentPeak).toBe(0);
    expect(crowdSettled.centralPeak).toBe(0);
    expect(crowdSettled.leftPeak).toBe(0);
    expect(crowdSettled.rightPeak).toBe(0);

    const textureWake = getStageFrame(between("discovery", "activation", 0.185)).production;
    expect(textureWake.environmentPeak).toBeGreaterThan(textureWake.centralPeak);
    expect(textureWake.centralPeak).toBeGreaterThan(textureWake.leftPeak);
    expect(textureWake.leftPeak).toBeGreaterThan(textureWake.rightPeak);
    expect(textureWake.mainScreen).toBe(0);

    const textureSettled = getStageFrame(between("discovery", "activation", 0.41)).production;
    expect(textureSettled.environmentPeak).toBe(1);
    expect(textureSettled.centralPeak).toBe(1);
    expect(textureSettled.leftPeak).toBe(1);
    expect(textureSettled.rightPeak).toBe(1);
  });

  test("assigns one deliberate interaction to each revised narrative phase", () => {
    expect(Object.values(interactionRegistry).map(({ phase }) => phase)).toEqual([
      "activation",
      "engagement",
      "reveal",
      "experiences",
      "connection",
    ]);
  });

  test("preserves monitor state while the two inserted stages hold the story", () => {
    const stageThree = getStageFrame(preview("activation")).production;
    expect(stageThree.interactiveScreen).toBe(1);
    expect(stageThree.videoWallScreen).toBe(0);
    expect(stageThree.gameScreen).toBe(0);
    expect(stageThree.mainScreen).toBe(0);

    const insertedEngagement = getStageFrame(preview("engagement")).production;
    expect(insertedEngagement.interactiveScreen).toBe(1);
    expect(insertedEngagement.videoWallScreen).toBe(0);
    expect(insertedEngagement.gameScreen).toBe(0);
    expect(insertedEngagement.mainScreen).toBe(0);

    const reveal = getStageFrame(preview("reveal")).production;
    expect(reveal.interactiveScreen).toBe(1);
    expect(reveal.videoWallScreen).toBe(1);
    expect(reveal.gameScreen).toBe(0);
    expect(reveal.mainScreen).toBe(0);

    const experiences = getStageFrame(preview("experiences")).production;
    expect(experiences.interactiveScreen).toBe(1);
    expect(experiences.videoWallScreen).toBe(1);
    expect(experiences.gameScreen).toBe(1);
    expect(experiences.mainScreen).toBe(1);

    const insertedConnection = getStageFrame(preview("connection")).production;
    expect(insertedConnection.interactiveScreen).toBe(1);
    expect(insertedConnection.videoWallScreen).toBe(1);
    expect(insertedConnection.gameScreen).toBe(1);
    expect(insertedConnection.mainScreen).toBe(1);
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

  test("holds the final loop composition through the page handoff", () => {
    const loopEnd = getStageFrame(0.9995);
    const loopRest = getStageFrame(narrativeScore.at(-1)!.preview);

    expect(loopEnd.cameraLife).toBeCloseTo(loopRest.cameraLife, 8);
    expect(loopEnd.cameraPointer).toBeCloseTo(loopRest.cameraPointer, 8);
    expect(loopEnd.production.centralReveal).toBeCloseTo(loopRest.production.centralReveal, 8);
    expect(loopEnd.production.leftReveal).toBeCloseTo(loopRest.production.leftReveal, 8);
    expect(loopEnd.production.rightReveal).toBeCloseTo(loopRest.production.rightReveal, 8);
    expect(loopEnd.production.crowdPresence).toBeCloseTo(loopRest.production.crowdPresence, 8);
    expect(loopEnd.production.dataFlow).toBeCloseTo(loopRest.production.dataFlow, 8);
    expect(loopRest.cameraLife).toBe(stagePresets.loop.camera.life);
    expect(loopRest.cameraPointer).toBe(stagePresets.loop.camera.pointer);
    expect(getCameraLoopSampleProgress(0)).toBe(0);
    expect(getCameraLoopSampleProgress(1)).toBe(1);
    expect(getCameraLoopSampleProgress(preview("engagement"))).toBeCloseTo(0.37, 8);
    expect(getCameraLoopSampleProgress(preview("connection"))).toBeCloseTo(0.625, 8);
  });
});
