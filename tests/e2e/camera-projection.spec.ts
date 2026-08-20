import { expect, test } from "@playwright/test";
import * as THREE from "three";
import { syncPerspectiveCameraProjection } from "../../components/experience/CameraRig";

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
