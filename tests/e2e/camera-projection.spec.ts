import { expect, test } from "@playwright/test";
import * as THREE from "three";
import { syncPerspectiveCameraProjection } from "../../components/experience/CameraRig";
import { waitForStation } from "./hero-interaction-helpers";

test.describe("authored camera projection", () => {
  test("copies the authored clipping range into the active camera", () => {
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 60);

    expect(syncPerspectiveCameraProjection(camera, {
      fov: 31.4,
      near: 0.1,
      far: 10_000,
    })).toBe(true);
    expect(camera.fov).toBe(31.4);
    expect(camera.near).toBe(0.1);
    expect(camera.far).toBe(10_000);
  });

  test("does not rebuild an unchanged projection matrix", () => {
    const camera = new THREE.PerspectiveCamera(31.4, 1, 0.1, 10_000);

    expect(syncPerspectiveCameraProjection(camera, {
      fov: 31.4,
      near: 0.1,
      far: 10_000,
    })).toBe(false);
  });
});

test("composer stays steady during pointer movement and restores motion after exit", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/en?intro=0&phase=engagement", { waitUntil: "domcontentloaded" });
  const director = await waitForStation(page, "touch");
  await expect(page.locator("[data-composer-canvas]")).toHaveAttribute("data-transition-progress", "1.000");

  const sampleAnchor = () => page.evaluate(() => new Promise<Array<{ x: number; y: number }>>((resolve) => {
    const points: Array<{ x: number; y: number }> = [];
    const onAnchors = (event: Event) => {
      const frame = (event as CustomEvent<{ stations: { touch: { x: number; y: number } } }>).detail;
      points.push({ x: frame.stations.touch.x, y: frame.stations.touch.y });
      if (points.length === 12) {
        window.removeEventListener("mandegar:interaction-anchors", onAnchors);
        resolve(points);
      }
    };
    window.addEventListener("mandegar:interaction-anchors", onAnchors);
  }));
  const viewport = page.viewportSize()!;
  await page.mouse.move(20, viewport.height / 2);
  const left = await sampleAnchor();
  await page.mouse.move(viewport.width - 20, viewport.height / 2);
  const right = await sampleAnchor();
  const origin = left.at(-1)!;
  const drift = Math.max(...right.map((point) => Math.hypot(point.x - origin.x, point.y - origin.y)));
  expect(drift).toBeLessThan(0.5);

  await page.keyboard.press("Escape");
  await expect(director).toHaveAttribute("data-active-station", "none");
  const restored = await sampleAnchor();
  await page.mouse.move(20, viewport.height / 2);
  const moved = await sampleAnchor();
  const restoredOrigin = restored.at(-1)!;
  const movement = Math.max(...moved.map((point) => Math.hypot(point.x - restoredOrigin.x, point.y - restoredOrigin.y)));
  expect(movement).toBeGreaterThan(1);
});
