import { expect, test } from "@playwright/test";
import { publicAssetPath } from "../../lib/public-asset-path";

test.describe("public asset paths", () => {
  test("keeps root-relative asset URLs in normal application builds", () => {
    expect(publicAssetPath("/models/mandegar/mandegar_hero.glb")).toBe(
      "/models/mandegar/mandegar_hero.glb",
    );
  });

  test("does not modify remote or relative asset URLs", () => {
    expect(publicAssetPath("https://cdn.example.com/model.glb")).toBe(
      "https://cdn.example.com/model.glb",
    );
    expect(publicAssetPath("models/model.glb")).toBe("models/model.glb");
  });
});
