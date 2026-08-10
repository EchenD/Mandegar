import { expect, test } from "@playwright/test";
import { narrativeScore } from "../../components/experience/narrative-score";
import { getStageFrame, getStagePreset, stagePresets, validateStagePresets } from "../../components/experience/stage-presets";

test.describe("creative stage presets", () => {
  test("define one valid renderer preset for every narrative stage", () => {
    expect(validateStagePresets()).toBe(true);
    expect(Object.keys(stagePresets)).toHaveLength(9);
    expect(narrativeScore.map((stage) => getStagePreset(stage.id).id)).toEqual(
      narrativeScore.map((stage) => stage.id),
    );
  });

  test("give the authored focus stages distinct spatial information", () => {
    expect(stagePresets.experiences.spatialInfo.mode).toBe("zones");
    expect(stagePresets.proof.spatialInfo.mode).toBe("projects");
    expect(stagePresets.intelligence.spatialInfo.mode).toBe("metrics");
    expect(stagePresets.invitation.spatialInfo.mode).toBe("invitation");
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
});
