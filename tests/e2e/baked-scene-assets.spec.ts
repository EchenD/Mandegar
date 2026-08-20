import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { bakedSceneContract } from "../../components/experience/baked-scene-contract";
import { assetSlots, sceneTokens } from "../../components/experience/scene-config";
import { publicAssetPath } from "../../lib/public-asset-path";

function resolvePublicAsset(assetPath: string) {
  return path.join(process.cwd(), "public", assetPath.replace(/^\/+/, ""));
}

test.describe("baked scene assets", () => {
  test("matches the WebGL background to the initial loader", () => {
    const stylesheet = readFileSync(
      path.join(process.cwd(), "components", "experience", "MandegarExperience.module.css"),
      "utf8",
    );
    const loaderBackground = stylesheet
      .match(/\.loader\s*\{[\s\S]*?background:\s*(#[0-9a-f]{6})/i)?.[1];

    expect(loaderBackground).toBeDefined();
    expect(sceneTokens.bakedScene.background).toBe(loaderBackground);
  });

  test("keeps configured runtime textures aligned with the asset contract", () => {
    const contractTextures = bakedSceneContract.textures;

    expect(assetSlots.bakedTextures).toEqual({
      environmentQuiet: publicAssetPath(contractTextures.environmentQuiet.runtime),
      environmentPeak: publicAssetPath(contractTextures.environmentPeak.runtime),
      exhibitionQuiet: publicAssetPath(contractTextures.exhibitionQuiet.runtime),
      exhibitionPeak: publicAssetPath(contractTextures.exhibitionPeak.runtime),
    });
  });

  test("assigns every screen to its authored reveal section", () => {
    expect(bakedSceneContract.exhibition.screenSections).toEqual({
      videoWall: "central",
      interactive: "left",
      game: "right",
      main: "right",
    });
    expect(Object.keys(bakedSceneContract.exhibition.screenSections).sort()).toEqual(
      Object.keys(bakedSceneContract.exhibition.screens).sort(),
    );
  });

  test("checks in every runtime texture and lossless master", () => {
    Object.entries(bakedSceneContract.textures).forEach(([id, texture]) => {
      expect(
        existsSync(resolvePublicAsset(texture.runtime)),
        `${id} runtime texture is missing: ${texture.runtime}`,
      ).toBe(true);
      expect(
        existsSync(resolvePublicAsset(texture.lossless)),
        `${id} lossless texture is missing: ${texture.lossless}`,
      ).toBe(true);
    });
  });
});
