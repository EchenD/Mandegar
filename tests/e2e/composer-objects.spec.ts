import { expect, test } from "@playwright/test";
import * as THREE from "three";
import { createPuzzleScreenFrame, createPuzzleTableFrame, createPuzzleTileGeometry, getPuzzleWorldPoint, projectPuzzlePoint } from "../../components/experience/composer-puzzle-geometry";

test("nine tile corners fit the authored sloped surface and physical slot projection preserves image directions", () => {
  const screenGeometry = new THREE.PlaneGeometry(3, 1.6);
  const uv = screenGeometry.getAttribute("uv");
  for (let index = 0; index < uv.count; index += 1) uv.setY(index, 1 - uv.getY(index));
  const material = new THREE.MeshBasicMaterial();
  const screen = new THREE.Mesh(screenGeometry, material);
  screen.name = "screen_interactive";
  screen.position.set(-4, 1.7, 3);
  screen.rotation.y = 0.4;
  screen.updateMatrixWorld(true);
  const screenOriginal = screen.matrixWorld.clone();
  const screenFrame = createPuzzleScreenFrame(screen)!;
  expect(screenFrame.width).toBeCloseTo(3);
  expect(screenFrame.height).toBeCloseTo(1.6);
  const tabletop = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.8), material);
  const normal = new THREE.Vector3(0.16, 0.956, 0.245).normalize();
  const right = screenFrame.right.clone().addScaledVector(normal, -screenFrame.right.dot(normal)).normalize();
  const back = normal.clone().cross(right);
  tabletop.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, back, normal));
  tabletop.position.copy(screenFrame.center).addScaledVector(screenFrame.normal, 6).addScaledVector(screenFrame.right, -1.9);
  tabletop.position.y = 0.78;
  const root = new THREE.Group();
  root.add(screen, tabletop);
  root.updateMatrixWorld(true);
  const tableOriginal = tabletop.matrixWorld.clone();
  const frame = createPuzzleTableFrame(root, screenFrame)!;
  expect(frame).not.toBeNull();
  expect(frame.cornersFit).toBe(true);
  expect(frame.normal.dot(normal)).toBeCloseTo(1);
  expect(frame.width / frame.height).toBeCloseTo(1.5);
  expect(frame.width).toBeLessThanOrEqual(1.15);
  const local = new THREE.Vector3();
  for (let slot = 0; slot < 9; slot += 1) {
    const x = (slot % 3 + 0.5) / 3;
    const y = (Math.floor(slot / 3) + 0.5) / 3;
    const point = getPuzzleWorldPoint(frame, x, y);
    expect(projectPuzzlePoint(frame, point).x).toBeCloseTo(x);
    expect(projectPuzzlePoint(frame, point).y).toBeCloseTo(y);
    const tile = createPuzzleTileGeometry(frame.width, frame.height, slot);
    const vertices = tile.getAttribute("position");
    for (let index = 0; index < vertices.count; index += 1) {
      local.fromBufferAttribute(vertices, index).applyQuaternion(frame.rotation).add(point);
      local.applyMatrix4(tabletop.matrixWorld.clone().invert());
      expect(Math.abs(local.x)).toBeLessThan(1.3);
      expect(Math.abs(local.y)).toBeLessThan(0.9);
      expect(local.z).toBeCloseTo(0.015);
    }
    tile.dispose();
  }
  const left = getPuzzleWorldPoint(frame, 1 / 6, 1 / 6);
  const rightPoint = getPuzzleWorldPoint(frame, 5 / 6, 1 / 6);
  const bottom = getPuzzleWorldPoint(frame, 1 / 6, 5 / 6);
  expect(rightPoint.sub(left).dot(frame.right)).toBeGreaterThan(0);
  expect(bottom.sub(left).dot(frame.back)).toBeLessThan(0);
  expect(screen.matrixWorld.equals(screenOriginal)).toBe(true);
  expect(tabletop.matrixWorld.equals(tableOriginal)).toBe(true);
  tabletop.geometry.dispose();
  screenGeometry.dispose();
  material.dispose();
});

test("the tabletop atlas covers each image piece once with the same top-left orientation as the monitor", () => {
  for (let piece = 0; piece < 9; piece += 1) {
    const geometry = createPuzzleTileGeometry(1.2, 0.8, piece);
    const uv = geometry.getAttribute("uv");
    const column = piece % 3;
    const row = Math.floor(piece / 3);
    expect(uv.getX(0)).toBeCloseTo(column / 3);
    expect(uv.getY(0)).toBeCloseTo(1 - row / 3);
    expect(uv.getX(1)).toBeCloseTo((column + 1) / 3);
    expect(uv.getY(2)).toBeCloseTo(1 - (row + 1) / 3);
    geometry.computeBoundingBox();
    const dimensions = geometry.boundingBox!.getSize(new THREE.Vector3());
    expect(dimensions.x).toBeCloseTo(1.2 / 3 - 0.006);
    expect(dimensions.y).toBeCloseTo(0.8 / 3 - 0.006);
    geometry.dispose();
  }
});
