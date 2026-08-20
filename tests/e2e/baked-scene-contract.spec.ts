import { expect, test } from "@playwright/test";
import * as THREE from "three";
import {
  validateContractMaterials,
  validateContractNodes,
} from "../../components/experience/baked-scene-contract";
import {
  bindRuntimeMaterial,
  restoreRuntimeMaterial,
} from "../../components/experience/baked-material-binding";

test.describe("baked scene contract validation", () => {
  test("accepts required source materials without warning", () => {
    const root = new THREE.Group();
    const material = new THREE.MeshBasicMaterial();
    material.name = "MAT_TEST_BAKED";
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (message) => warnings.push(String(message));

    try {
      expect(validateContractMaterials(root, [material.name], "Valid GLB")).toEqual([]);
      expect(warnings).toEqual([]);
    } finally {
      console.warn = originalWarn;
      root.traverse((object) => {
        if (object instanceof THREE.Mesh) object.geometry.dispose();
      });
      material.dispose();
    }
  });

  test("reports one warning for repeated validation of the same missing nodes", () => {
    const root = new THREE.Group();
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (message) => warnings.push(String(message));

    try {
      expect(validateContractNodes(root, ["missing_node"], "Repeated test GLB"))
        .toEqual(["missing_node"]);
      expect(validateContractNodes(root, ["missing_node"], "Repeated test GLB"))
        .toEqual(["missing_node"]);
      expect(warnings).toEqual([
        "[Mandegar] Repeated test GLB is missing required nodes: missing_node",
      ]);
    } finally {
      console.warn = originalWarn;
    }
  });

  test("restores only materials owned by the active runtime", () => {
    const sourceMaterial = new THREE.MeshBasicMaterial();
    const runtimeMaterial = new THREE.MeshBasicMaterial();
    const newerMaterial = new THREE.MeshBasicMaterial();
    const geometry = new THREE.BoxGeometry();
    const mesh = new THREE.Mesh(geometry, sourceMaterial);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const root = new THREE.Group();
    root.add(mesh);

    try {
      const bindings = bindRuntimeMaterial(root, runtimeMaterial);
      expect(mesh.material).toBe(runtimeMaterial);
      expect(mesh.castShadow).toBe(false);
      expect(mesh.receiveShadow).toBe(false);

      mesh.material = newerMaterial;
      restoreRuntimeMaterial(bindings, runtimeMaterial);
      expect(mesh.material).toBe(newerMaterial);

      mesh.material = runtimeMaterial;
      restoreRuntimeMaterial(bindings, runtimeMaterial);
      expect(mesh.material).toBe(sourceMaterial);
      expect(mesh.castShadow).toBe(true);
      expect(mesh.receiveShadow).toBe(true);
    } finally {
      geometry.dispose();
      sourceMaterial.dispose();
      runtimeMaterial.dispose();
      newerMaterial.dispose();
    }
  });

  test("renders the environment shell at the arrival frame", async ({ page }) => {
    await page.goto("/fa?intro=0&phase=arrival", { waitUntil: "networkidle" });
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();
    await page.waitForTimeout(800);

    const png = await canvas.screenshot();
    const averageBrightness = await page.evaluate(async (source) => {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Canvas screenshot could not be decoded"));
        image.src = source;
      });
      const sample = document.createElement("canvas");
      sample.width = 72;
      sample.height = 45;
      const context = sample.getContext("2d");
      if (!context) return 0;
      context.drawImage(image, 0, 0, sample.width, sample.height);
      const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
      let brightness = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        brightness += pixels[index] + pixels[index + 1] + pixels[index + 2];
      }
      return brightness / (pixels.length / 4) / 3;
    }, `data:image/png;base64,${png.toString("base64")}`);

    expect(averageBrightness).toBeGreaterThan(55);
  });

  test("does not report mutated material names or duplicate asset warnings", async ({ page }) => {
    const warnings: string[] = [];
    const shaderErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "warning" && message.text().startsWith("[Mandegar]")) {
        warnings.push(message.text());
      }
      if (
        message.type() === "error"
        && /WebGLProgram|shader error|VALIDATE_STATUS/i.test(message.text())
      ) {
        shaderErrors.push(message.text());
      }
    });

    await page.goto("/fa?intro=0&phase=intelligence", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    expect(warnings.filter((message) => message.includes("missing required source materials")))
      .toEqual([]);
    expect(warnings).toEqual([...new Set(warnings)]);
    expect(shaderErrors).toEqual([]);
  });
});
