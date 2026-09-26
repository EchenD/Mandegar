import { expect, test } from "@playwright/test";
import * as THREE from "three";
import {
  interactionAnchorNames,
  validateContractMaterials,
  validateContractNodes,
  validateInteractionAnchors,
} from "../../components/experience/baked-scene-contract";
import {
  bindRuntimeMaterial,
  restoreRuntimeMaterial,
} from "../../components/experience/baked-material-binding";

test.describe("baked scene contract validation", () => {
  test("declares the complete authored interaction anchor contract", () => {
    expect(interactionAnchorNames).toHaveLength(17);
    const origins = interactionAnchorNames.filter((name) => name.includes("beam_origin_"));
    const targets = interactionAnchorNames.filter((name) => name.includes("beam_target_"));
    expect(origins.map((name) => name.slice(-2))).toEqual(["01", "02", "03", "04", "05"]);
    expect(targets.map((name) => name.slice(-2))).toEqual(["01", "02", "03", "04", "05"]);
  });

  test("reports precise development fallbacks when authored anchors are absent", () => {
    const root = new THREE.Group();
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (message) => warnings.push(String(message));
    try {
      expect(validateInteractionAnchors(root)).toEqual(interactionAnchorNames);
      expect(warnings).toHaveLength(interactionAnchorNames.length);
      expect(warnings[0]).toContain("required interaction anchor");
      expect(warnings[0]).toContain("deterministic runtime fallback");
    } finally {
      console.warn = originalWarn;
    }
  });

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
    const canvas = page.locator("[data-experience-root] canvas");
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

  test("hydrates the authored-anchor debug route without contract errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (
        message.type() === "error"
        && /hydration|missing required interaction anchor/i.test(message.text())
      ) {
        errors.push(message.text());
      }
    });

    await page.goto("/en?intro=0&phase=reveal&anchors=1", { waitUntil: "networkidle" });
    await expect(page.locator("[data-anchor-debug]")).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test("updates projected anchors without rerendering the interaction director", async ({ page }) => {
    await page.goto("/en?intro=0&phase=reveal&anchors=1", { waitUntil: "networkidle" });
    const director = page.locator("[data-interaction-director]");
    await expect(director).toHaveAttribute("data-available-station", "stage");
    const result = await director.evaluate((element) => {
      const before = Number((element as HTMLElement).dataset.reactRenderCount);
      const point = (x: number, y: number) => ({ x, y, visible: true, fallback: false });
      const detail = {
        stations: {
          photo: point(101, 201),
          touch: point(102, 202),
          stage: point(321, 222),
          game: point(104, 204),
          draw: point(105, 205),
        },
        photoFlash: point(0, 0),
        photoPhone: point(0, 0),
        beams: Array.from({ length: 5 }, () => ({
          origin: point(0, 0),
          target: point(0, 0),
        })),
      };
      for (let index = 0; index < 12; index += 1) {
        window.dispatchEvent(new CustomEvent("mandegar:interaction-anchors", { detail }));
      }
      const hotspot = element.querySelector<HTMLElement>("[data-interaction-hotspot='stage']");
      const debugPoint = element.querySelector<HTMLElement>("[data-anchor-debug-point='stage']");
      return {
        before,
        after: Number((element as HTMLElement).dataset.reactRenderCount),
        hotspotX: hotspot?.style.getPropertyValue("--hotspot-x"),
        hotspotY: hotspot?.style.getPropertyValue("--hotspot-y"),
        debugLeft: debugPoint?.style.left,
        debugTop: debugPoint?.style.top,
      };
    });

    expect(result.after).toBe(result.before);
    expect(result).toMatchObject({
      hotspotX: "321px",
      hotspotY: "222px",
      debugLeft: "321px",
      debugTop: "222px",
    });
    await page.evaluate(() => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
    await expect(director).toHaveAttribute("data-react-render-count", String(result.before));
  });
});
