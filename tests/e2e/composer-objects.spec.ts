import { expect, test } from "@playwright/test";
import * as THREE from "three";
import { createComposerScreenFrame, createComposerTableFrame, getComposerObjectPosition, getComposerRestHeight, projectComposerDrag } from "../../components/experience/composer-object-geometry";
import {
  beginComposerObjectDrag,
  cancelComposerObjectDrag,
  finishComposerObjectDrag,
  getComposerMonitorPoint,
  getComposerObjectState,
  registerComposerObjectActions,
  resetComposerObjects,
  setComposerObjectsInteractive,
  updateComposerObjectPose,
} from "../../components/experience/interactions/composer-object-store";

test.beforeEach(() => {
  resetComposerObjects();
  setComposerObjectsInteractive(true);
});
test.afterEach(() => {
  setComposerObjectsInteractive(false);
  registerComposerObjectActions(null);
});

test("one pointer owns a prop and continuous movement changes its monitor composition before release", () => {
  const before = getComposerMonitorPoint(0);
  expect(beginComposerObjectDrag(0, 7)).toBe(true);
  expect(beginComposerObjectDrag(1, 8)).toBe(false);
  updateComposerObjectPose(0, { x: 0.6, y: 0.5 });
  expect(getComposerMonitorPoint(0).x).toBeGreaterThan(before.x);
  expect(getComposerMonitorPoint(0).y).toBeLessThan(before.y);
  finishComposerObjectDrag(8);
  expect(getComposerObjectState().dragging).toEqual({ index: 0, pointerId: 7 });
  finishComposerObjectDrag(7);
  expect(getComposerObjectState().dragging).toBeNull();
});

test("cancelling an unfinished drag restores the settled arrangement and never activates a choice", () => {
  const activated: number[] = [];
  registerComposerObjectActions((index) => activated.push(index));
  updateComposerObjectPose(1, { x: -0.3, y: 0.4 }, true);
  beginComposerObjectDrag(1, 2);
  updateComposerObjectPose(1, { x: 1, y: 1 });
  cancelComposerObjectDrag();
  expect(getComposerObjectState().poses[1]).toEqual({ x: -0.3, y: 0.4 });
  expect(activated).toEqual([]);
  beginComposerObjectDrag(1, 3);
  updateComposerObjectPose(1, { x: 0.2, y: 0.7 });
  finishComposerObjectDrag(3);
  expect(activated).toEqual([1]);
  setComposerObjectsInteractive(false);
  expect(getComposerObjectState().poses[1]).toEqual({ x: 0.2, y: 0.7 });
});

test("prop positions stay within the booth and an interrupted gesture preserves finite settled values", () => {
  updateComposerObjectPose(2, { x: 500, y: -100 }, true);
  expect(getComposerObjectState().poses[2]).toEqual({ x: 1, y: 0 });
  updateComposerObjectPose(2, { x: Number.NaN, y: 1 });
  expect(getComposerObjectState().poses[2]).toEqual({ x: 1, y: 0 });
  beginComposerObjectDrag(2, 9);
  updateComposerObjectPose(2, { x: -1, y: 1 });
  setComposerObjectsInteractive(false);
  expect(getComposerObjectState().poses[2]).toEqual({ x: 1, y: 0 });
  expect(beginComposerObjectDrag(2, 10)).toBe(false);
});

test("props rest on the authored sloped tabletop and drag across it without moving booth geometry", () => {
  const geometry = new THREE.PlaneGeometry(3, 1.6);
  const uv = geometry.getAttribute("uv");
  for (let index = 0; index < uv.count; index += 1) uv.setY(index, 1 - uv.getY(index));
  const material = new THREE.MeshBasicMaterial();
  const screen = new THREE.Mesh(geometry, material);
  screen.position.set(-4, 1.7, 3);
  screen.rotation.y = 0.4;
  screen.updateMatrixWorld(true);
  const original = screen.matrixWorld.clone();
  const screenFrame = createComposerScreenFrame(screen)!;
  expect(screenFrame.width).toBeCloseTo(3);
  expect(screenFrame.height).toBeCloseTo(1.6);
  const tabletop = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1), material);
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
  const frame = createComposerTableFrame(root, screenFrame)!;
  expect(frame).not.toBeNull();
  expect(frame.normal.dot(normal)).toBeCloseTo(1);
  const cube = new THREE.BoxGeometry(0.18, 0.18, 0.18);
  const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.15, 0.35, 0));
  const clearance = getComposerRestHeight(cube, rotation, 1);
  const base = getComposerObjectPosition(frame, 0, { x: 0, y: 0 }, new THREE.Vector3(), clearance);
  const arranged = getComposerObjectPosition(frame, 0, { x: 1, y: 1 }, new THREE.Vector3(), clearance);
  const movement = arranged.clone().sub(base);
  expect(projectComposerDrag(frame, movement, { x: 0, y: 0 }).x).toBeCloseTo(1);
  expect(projectComposerDrag(frame, movement, { x: 0, y: 0 }).y).toBeCloseTo(1);
  expect(base.clone().sub(frame.anchors[0]).dot(frame.normal)).toBeCloseTo(clearance + 0.003);
  const vertices = cube.getAttribute("position");
  let lowest = Infinity;
  for (let index = 0; index < vertices.count; index += 1) {
    const point = new THREE.Vector3().fromBufferAttribute(vertices, index).applyQuaternion(rotation).applyQuaternion(frame.rotation).add(base);
    lowest = Math.min(lowest, point.sub(frame.center).dot(frame.normal));
  }
  expect(lowest).toBeCloseTo(0.003);
  expect(screen.matrixWorld.equals(original)).toBe(true);
  expect(tabletop.matrixWorld.equals(tableOriginal)).toBe(true);
  cube.dispose();
  tabletop.geometry.dispose();
  geometry.dispose();
  material.dispose();
});
