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
      full: {
        environmentQuiet: publicAssetPath(contractTextures.environmentQuiet.desktop.runtime),
        environmentPeak: publicAssetPath(contractTextures.environmentPeak.desktop.runtime),
        exhibitionQuiet: publicAssetPath(contractTextures.exhibitionQuiet.desktop.runtime),
        exhibitionPeak: publicAssetPath(contractTextures.exhibitionPeak.desktop.runtime),
      },
      adaptive: {
        environmentQuiet: publicAssetPath(contractTextures.environmentQuiet.mobile.runtime),
        environmentPeak: publicAssetPath(contractTextures.environmentPeak.mobile.runtime),
        exhibitionQuiet: publicAssetPath(contractTextures.exhibitionQuiet.mobile.runtime),
        exhibitionPeak: publicAssetPath(contractTextures.exhibitionPeak.mobile.runtime),
      },
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

  test("checks in every desktop and mobile texture variant", () => {
    Object.entries(bakedSceneContract.textures).forEach(([id, texture]) => {
      Object.entries({ desktop: texture.desktop, mobile: texture.mobile }).forEach(
        ([variant, assets]) => {
          expect(assets.runtime, `${id} ${variant} must use WebP at runtime`).toMatch(/\.webp$/i);
          expect(assets.ktx2, `${id} ${variant} must retain its KTX2 fallback`).toMatch(/\.ktx2$/i);
          [assets.runtime, assets.ktx2].forEach((assetPath) => {
            expect(
              existsSync(resolvePublicAsset(assetPath)),
              `${id} ${variant} texture is missing: ${assetPath}`,
            ).toBe(true);
          });
        },
      );
    });
    expect(existsSync(resolvePublicAsset("/basis/basis_transcoder.js"))).toBe(true);
    expect(existsSync(resolvePublicAsset("/basis/basis_transcoder.wasm"))).toBe(true);
  });

  test("loads only the WebP tier selected for the viewport", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "hardwareConcurrency", { configurable: true, get: () => 8 });
      Object.defineProperty(navigator, "deviceMemory", { configurable: true, get: () => 8 });
    });
    const requestedAssets: string[] = [];
    page.on("response", (response) => {
      const pathname = new URL(response.url()).pathname;
      if (
        pathname.startsWith("/textures/mandegar/baked/")
        || pathname.endsWith("/basis_transcoder.wasm")
      ) requestedAssets.push(pathname);
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/en?intro=0&phase=reveal", { waitUntil: "networkidle" });
    await expect(page.locator("[data-experience-canvas='true']")).toBeVisible();
    expect(requestedAssets.filter((asset) => asset.endsWith(".webp")).sort()).toEqual([
      "/textures/mandegar/baked/env_peak.webp",
      "/textures/mandegar/baked/env_quiet.webp",
      "/textures/mandegar/baked/exhibit_peak.webp",
      "/textures/mandegar/baked/exhibit_quiet.webp",
    ]);
    expect(requestedAssets.some((asset) => asset.endsWith(".ktx2"))).toBe(false);
    expect(requestedAssets.some((asset) => asset.endsWith("/basis_transcoder.wasm"))).toBe(false);

    requestedAssets.length = 0;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator("[data-experience-canvas='true']")).toBeVisible();
    expect(requestedAssets.filter((asset) => asset.endsWith(".webp")).sort()).toEqual([
      "/textures/mandegar/baked/mobile/env_peak.webp",
      "/textures/mandegar/baked/mobile/env_quiet.webp",
      "/textures/mandegar/baked/mobile/exhibit_peak.webp",
      "/textures/mandegar/baked/mobile/exhibit_quiet.webp",
    ]);
    expect(requestedAssets.some((asset) => asset.endsWith(".ktx2"))).toBe(false);
    expect(requestedAssets.some((asset) => asset.endsWith("/basis_transcoder.wasm"))).toBe(false);
  });
});
