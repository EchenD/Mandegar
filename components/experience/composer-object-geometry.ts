import * as THREE from "three";
import type { ComposerObjectPose } from "./interactions/composer-object-store";

export type ComposerScreenFrame = {
  center: THREE.Vector3;
  right: THREE.Vector3;
  up: THREE.Vector3;
  normal: THREE.Vector3;
  width: number;
  height: number;
  rotation: THREE.Quaternion;
};

export type ComposerTableFrame = {
  center: THREE.Vector3;
  right: THREE.Vector3;
  back: THREE.Vector3;
  normal: THREE.Vector3;
  anchors: THREE.Vector3[];
  rotation: THREE.Quaternion;
};

function pointAtUv(root: THREE.Object3D, u: number, v: number): THREE.Vector3 | null {
  let result: THREE.Vector3 | null = null;
  root.updateWorldMatrix(true, true);
  root.traverse((object) => {
    if (result || !(object instanceof THREE.Mesh)) return;
    const positions = object.geometry.getAttribute("position");
    const uv = object.geometry.getAttribute("uv");
    if (!positions || !uv) return;
    const index = object.geometry.index;
    const count = index?.count ?? positions.count;
    for (let offset = 0; offset + 2 < count; offset += 3) {
      const a = index ? index.getX(offset) : offset;
      const b = index ? index.getX(offset + 1) : offset + 1;
      const c = index ? index.getX(offset + 2) : offset + 2;
      const denominator = (uv.getY(b) - uv.getY(c)) * (uv.getX(a) - uv.getX(c))
        + (uv.getX(c) - uv.getX(b)) * (uv.getY(a) - uv.getY(c));
      if (Math.abs(denominator) < 1e-8) continue;
      const wa = ((uv.getY(b) - uv.getY(c)) * (u - uv.getX(c)) + (uv.getX(c) - uv.getX(b)) * (v - uv.getY(c))) / denominator;
      const wb = ((uv.getY(c) - uv.getY(a)) * (u - uv.getX(c)) + (uv.getX(a) - uv.getX(c)) * (v - uv.getY(c))) / denominator;
      const wc = 1 - wa - wb;
      if (Math.min(wa, wb, wc) < -1e-4) continue;
      result = new THREE.Vector3(
        positions.getX(a) * wa + positions.getX(b) * wb + positions.getX(c) * wc,
        positions.getY(a) * wa + positions.getY(b) * wb + positions.getY(c) * wc,
        positions.getZ(a) * wa + positions.getZ(b) * wb + positions.getZ(c) * wc,
      ).applyMatrix4(object.matrixWorld);
      return;
    }
  });
  return result;
}

export function createComposerScreenFrame(screen: THREE.Object3D): ComposerScreenFrame | null {
  const center = pointAtUv(screen, 0.5, 0.5);
  const rightPoint = pointAtUv(screen, 0.6, 0.5);
  const downPoint = pointAtUv(screen, 0.5, 0.6);
  if (!center || !rightPoint || !downPoint) return null;
  const right = rightPoint.sub(center).multiplyScalar(10);
  const up = downPoint.sub(center).multiplyScalar(-10);
  const width = right.length();
  const height = up.length();
  if (width < 0.001 || height < 0.001) return null;
  right.normalize();
  up.normalize();
  const normal = right.clone().cross(up).normalize();
  return { center, right, up, normal, width, height, rotation: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, normal)) };
}

export function createComposerTableFrame(root: THREE.Object3D, screen: ComposerScreenFrame): ComposerTableFrame | null {
  root.updateWorldMatrix(true, true);
  const meshes: THREE.Mesh[] = [];
  root.traverse((object) => {
    if (object instanceof THREE.Mesh && !object.name.startsWith("screen") && !object.name.startsWith("composer_")) meshes.push(object);
  });
  const ray = new THREE.Raycaster();
  const origin = new THREE.Vector3();
  const normal = new THREE.Vector3();
  let surface: THREE.Intersection<THREE.Object3D> | undefined;
  // The authored Touch counter has a sloped top. Search the booth, excluding its floor and signage.
  for (let front = 2; front <= 7 && !surface; front += 0.5) {
    for (let lateral = -2.5; lateral <= 1.5 && !surface; lateral += 0.5) {
      origin.copy(screen.center).addScaledVector(screen.normal, front).addScaledVector(screen.right, lateral);
      origin.y = screen.center.y + 3;
      ray.set(origin, new THREE.Vector3(0, -1, 0));
      surface = ray.intersectObjects(meshes, false).find((hit) => {
        if (!hit.face || hit.point.y < 0.45 || hit.point.y > 1.3) return false;
        normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
        return normal.y > 0.85;
      });
    }
  }
  if (!surface?.face || !(surface.object instanceof THREE.Mesh)) return null;
  normal.copy(surface.face.normal).transformDirection(surface.object.matrixWorld);
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, surface.point);
  const positions = surface.object.geometry.getAttribute("position");
  const indices = surface.object.geometry.index;
  const count = indices?.count ?? positions.count;
  const vertices: THREE.Vector3[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const faceNormal = new THREE.Vector3();
  for (let offset = 0; offset + 2 < count; offset += 3) {
    a.fromBufferAttribute(positions, indices ? indices.getX(offset) : offset).applyMatrix4(surface.object.matrixWorld);
    b.fromBufferAttribute(positions, indices ? indices.getX(offset + 1) : offset + 1).applyMatrix4(surface.object.matrixWorld);
    c.fromBufferAttribute(positions, indices ? indices.getX(offset + 2) : offset + 2).applyMatrix4(surface.object.matrixWorld);
    new THREE.Triangle(a, b, c).getNormal(faceNormal);
    if (faceNormal.dot(normal) < 0.999 || Math.max(Math.abs(plane.distanceToPoint(a)), Math.abs(plane.distanceToPoint(b)), Math.abs(plane.distanceToPoint(c))) > 0.002) continue;
    [a, b, c].forEach((vertex) => {
      if (!vertices.some((prior) => prior.distanceToSquared(vertex) < 1e-6)) vertices.push(vertex.clone());
    });
  }
  if (vertices.length < 3) return null;
  const center = vertices.reduce((sum, vertex) => sum.add(vertex), new THREE.Vector3()).multiplyScalar(1 / vertices.length);
  const right = screen.right.clone().addScaledVector(normal, -screen.right.dot(normal)).normalize();
  const back = normal.clone().cross(right).normalize();
  const front = back.clone().negate();
  // An open triangle on the counter keeps each form clear of the authored foreground people.
  const offsets = [[-0.325, -0.105], [0.275, 0.095], [0.425, -0.205]];
  const anchors = offsets.map(([horizontal, depth]) => {
    origin.copy(center).addScaledVector(right, horizontal).addScaledVector(back, depth);
    origin.y += 2;
    ray.set(origin, new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObject(surface!.object, false).find((candidate) => Math.abs(plane.distanceToPoint(candidate.point)) < 0.002);
    return hit?.point.clone() ?? plane.projectPoint(origin, new THREE.Vector3());
  });
  return { center, right, back, normal: normal.clone(), anchors, rotation: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, normal, front)) };
}

export function getComposerObjectPosition(frame: ComposerTableFrame, index: number, pose: ComposerObjectPose, target = new THREE.Vector3(), clearance = 0.1) {
  return target.copy(frame.anchors[index])
    .addScaledVector(frame.right, pose.x * 0.055)
    .addScaledVector(frame.back, pose.y * 0.075)
    .addScaledVector(frame.normal, clearance + 0.003);
}

export function getComposerRestHeight(geometry: THREE.BufferGeometry, rotation: THREE.Quaternion, scale: number) {
  const vertices = geometry.getAttribute("position");
  const point = new THREE.Vector3();
  let lowest = 0;
  for (let index = 0; index < vertices.count; index += 1) {
    point.fromBufferAttribute(vertices, index).applyQuaternion(rotation).multiplyScalar(scale);
    lowest = Math.min(lowest, point.y);
  }
  return -lowest;
}

export function projectComposerDrag(frame: ComposerTableFrame, movement: THREE.Vector3, initial: ComposerObjectPose): ComposerObjectPose {
  return {
    x: Math.max(-1, Math.min(1, initial.x + movement.dot(frame.right) / 0.055)),
    y: Math.max(0, Math.min(1, initial.y + movement.dot(frame.back) / 0.075)),
  };
}

export function createComposerRibbonGeometry() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([
    -0.19, -0.1, 0, -0.02, -0.1, 0.09, -0.19, 0.1, 0,
    -0.02, -0.1, 0.09, -0.02, 0.1, 0.09, -0.19, 0.1, 0,
    -0.02, -0.1, 0.09, 0.19, -0.1, -0.04, -0.02, 0.1, 0.09,
    0.19, -0.1, -0.04, 0.19, 0.1, -0.04, -0.02, 0.1, 0.09,
  ], 3));
  geometry.computeVertexNormals();
  return geometry;
}
