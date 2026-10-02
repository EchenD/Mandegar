import * as THREE from "three";


export type PuzzleScreenFrame = {
  center: THREE.Vector3;
  right: THREE.Vector3;
  up: THREE.Vector3;
  normal: THREE.Vector3;
  width: number;
  height: number;
  rotation: THREE.Quaternion;
};

export type PuzzleTableFrame = {
  center: THREE.Vector3;
  right: THREE.Vector3;
  back: THREE.Vector3;
  normal: THREE.Vector3;
  width: number;
  height: number;
  cornersFit: boolean;
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

export function createPuzzleScreenFrame(screen: THREE.Object3D): PuzzleScreenFrame | null {
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

export function createPuzzleTableFrame(root: THREE.Object3D, screen: PuzzleScreenFrame): PuzzleTableFrame | null {
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
  const triangles: THREE.Triangle[] = [];
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
    triangles.push(new THREE.Triangle(a.clone(), b.clone(), c.clone()));
    [a, b, c].forEach((vertex) => {
      if (!vertices.some((prior) => prior.distanceToSquared(vertex) < 1e-6)) vertices.push(vertex.clone());
    });
  }
  if (vertices.length < 3) return null;
  const center = vertices.reduce((sum, vertex) => sum.add(vertex), new THREE.Vector3()).multiplyScalar(1 / vertices.length);
  const right = screen.right.clone().addScaledVector(normal, -screen.right.dot(normal)).normalize();
  const back = normal.clone().cross(right).normalize();
  const bounds = vertices.map((vertex) => {
    const relative = vertex.clone().sub(center);
    return { x: relative.dot(right), y: relative.dot(back) };
  });
  const minX = Math.min(...bounds.map((point) => point.x));
  const maxX = Math.max(...bounds.map((point) => point.x));
  const minY = Math.min(...bounds.map((point) => point.y));
  const maxY = Math.max(...bounds.map((point) => point.y));
  const testPoint = new THREE.Vector3();
  const fits = (x: number, y: number, width: number) => {
    // Check edges as well as corners against the actual top triangles. A bounding
    // box alone would allow a board to bridge a cutout in an authored counter.
    for (const dx of [-0.5, 0, 0.5]) {
      for (const dy of [-0.5, 0, 0.5]) {
        testPoint.copy(center).addScaledVector(right, x + dx * (width + 0.04))
          .addScaledVector(back, y + dy * (width / 1.5 + 0.04));
        if (!triangles.some((triangle) => triangle.containsPoint(testPoint))) return false;
      }
    }
    return true;
  };
  const maximum = Math.min(maxX - minX - 0.04, (maxY - minY - 0.04) * 1.5, 1.15);
  // Choose the largest safe 3:2 rectangle; prefer the counter center when tied.
  const candidates: Array<{ x: number; y: number }> = [];
  for (let row = 0; row <= 8; row += 1) {
    for (let column = 0; column <= 12; column += 1) {
      candidates.push({ x: minX + (maxX - minX) * column / 12, y: minY + (maxY - minY) * row / 8 });
    }
  }
  candidates.sort((first, second) => Math.hypot(first.x, first.y) - Math.hypot(second.x, second.y));
  for (let width = maximum; width >= 0.3; width -= 0.02) {
    const candidate = candidates.find((point) => fits(point.x, point.y, width));
    if (!candidate) continue;
    center.addScaledVector(right, candidate.x).addScaledVector(back, candidate.y);
    return {
      center, right, back, normal: normal.clone(), width, height: width / 1.5, cornersFit: true,
      rotation: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, back, normal)),
    };
  }
  return null;
}

export function getPuzzleWorldPoint(frame: PuzzleTableFrame, x: number, y: number, target = new THREE.Vector3(), lift = 0.015) {
  return target.copy(frame.center).addScaledVector(frame.right, (x - 0.5) * frame.width)
    .addScaledVector(frame.back, (0.5 - y) * frame.height).addScaledVector(frame.normal, lift);
}

export function projectPuzzlePoint(frame: PuzzleTableFrame, point: THREE.Vector3) {
  const relative = point.clone().sub(frame.center);
  return { x: 0.5 + relative.dot(frame.right) / frame.width, y: 0.5 - relative.dot(frame.back) / frame.height };
}

/** Plane UVs sample the same top-left image piece as the canvas monitor. */
export function createPuzzleTileGeometry(width: number, height: number, piece: number, gap = 0.006) {
  const geometry = new THREE.PlaneGeometry(width / 3 - gap, height / 3 - gap);
  const uv = geometry.getAttribute("uv");
  const column = piece % 3;
  const row = Math.floor(piece / 3);
  for (let index = 0; index < uv.count; index += 1) {
    uv.setXY(index, (column + uv.getX(index)) / 3, (2 - row + uv.getY(index)) / 3);
  }
  return geometry;
}
