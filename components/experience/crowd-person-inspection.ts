import * as THREE from "three";
import { bindRuntimeMaterial, type RuntimeMaterialBinding } from "./baked-material-binding";
import type { BakedMaterialUniforms } from "./baked-scene-material";
import type { IntelligencePersonPoint } from "./intelligence-inspector-store";

export type CrowdPersonRuntime = {
  id: string;
  object: THREE.Object3D;
  material: THREE.ShaderMaterial;
  focus: { value: number };
  bindings: RuntimeMaterialBinding[];
  point: THREE.Vector3;
};

export function getCrowdPersonId(object: THREE.Object3D) {
  let ancestor: THREE.Object3D | null = object;
  while (ancestor) {
    if (/^Human_\d+$/.test(ancestor.name)) return ancestor.name;
    ancestor = ancestor.parent;
  }
  return null;
}

export function isVisibleOpaqueMesh(object: THREE.Object3D): object is THREE.Mesh {
  if (!(object instanceof THREE.Mesh)) return false;
  for (let ancestor: THREE.Object3D | null = object; ancestor; ancestor = ancestor.parent) {
    if (!ancestor.visible) return false;
  }
  const materials = Array.isArray(object.material) ? object.material : [object.material];
  return materials.some((material) => material.visible && !material.transparent && material.depthWrite && material.opacity > 0.98);
}

function getOpaqueMeshes(world: THREE.Scene) {
  const meshes: THREE.Mesh[] = [];
  world.traverse((object) => { if (isVisibleOpaqueMesh(object)) meshes.push(object); });
  return meshes;
}

export function getCrowdPersonAtRay(world: THREE.Scene, ray: THREE.Ray, raycaster: THREE.Raycaster) {
  raycaster.ray.copy(ray);
  const hit = raycaster.intersectObjects(getOpaqueMeshes(world), false)[0];
  return hit ? getCrowdPersonId(hit.object) : null;
}

/** A visible edge hit can anchor the annotation when the figure's torso leaves the viewport. */
export function getCrowdReadoutPoint(torso: THREE.Vector3, camera: THREE.Camera, pointerHit?: THREE.Vector3, projected = new THREE.Vector3()) {
  const inside = (point: THREE.Vector3) => {
    projected.copy(point).project(camera);
    return Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1 && projected.z >= -1 && projected.z <= 1;
  };
  if (inside(torso)) return torso;
  return pointerHit && inside(pointerHit) ? pointerHit : null;
}

/** A hidden torso alone does not make an exposed head or shoulder ineligible. */
export function isCrowdPersonOccluded(person: THREE.Object3D, world: THREE.Scene, camera: THREE.Camera, raycaster: THREE.Raycaster, pointerHit?: THREE.Vector3) {
  const ownMeshes: THREE.Mesh[] = [];
  person.traverse((object) => { if (isVisibleOpaqueMesh(object)) ownMeshes.push(object); });
  if (ownMeshes.length === 0) return false;
  const bounds = new THREE.Box3().setFromObject(person);
  const projected = new THREE.Vector3();
  const screenBounds = new THREE.Box2();
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        projected.set(x, y, z).project(camera);
        screenBounds.expandByPoint(new THREE.Vector2(projected.x, projected.y));
      }
    }
  }
  const opaque = getOpaqueMeshes(world);
  const ndc = new THREE.Vector2();
  let validRays = 0;
  const isVisibleAtRay = () => {
    if (Math.abs(ndc.x) > 1 || Math.abs(ndc.y) > 1) return false;
    raycaster.setFromCamera(ndc, camera);
    // Bounds may include empty space around a pose: only actual silhouette hits count.
    const ownHit = raycaster.intersectObjects(ownMeshes, false)[0];
    if (!ownHit) return false;
    validRays += 1;
    const worldHit = raycaster.intersectObjects(opaque, false)[0];
    return !worldHit || worldHit.distance >= ownHit.distance - 0.001;
  };
  if (pointerHit) {
    projected.copy(pointerHit).project(camera);
    ndc.set(projected.x, projected.y);
    if (isVisibleAtRay()) return false;
  }
  for (const [horizontal, vertical] of [[0.5, 0.13], [0.28, 0.3], [0.72, 0.3], [0.5, 0.46], [0.5, 0.68]]) {
    ndc.set(
      THREE.MathUtils.lerp(screenBounds.min.x, screenBounds.max.x, horizontal),
      THREE.MathUtils.lerp(screenBounds.max.y, screenBounds.min.y, vertical),
    );
    if (isVisibleAtRay()) return false;
  }
  // No valid silhouette ray is inconclusive, rather than proof that the person is hidden.
  return validRays > 0;
}

export function createCrowdPeople(root: THREE.Object3D, material: THREE.ShaderMaterial, uniforms: BakedMaterialUniforms) {
  const people: CrowdPersonRuntime[] = [];
  root.traverse((object) => {
    if (!/^Human_\d+$/.test(object.name)) return;
    const bounds = new THREE.Box3().setFromObject(object);
    if (bounds.isEmpty()) return;
    const point = bounds.getCenter(new THREE.Vector3());
    point.y = bounds.min.y + (bounds.max.y - bounds.min.y) * 0.62;
    const focus = { value: 0 };
    const personMaterial = material.clone();
    personMaterial.name = `${material.name}_${object.name}`;
    // Share the original textures and narrative uniforms; only focus differs per person.
    personMaterial.uniforms = { ...uniforms, uPersonFocus: focus };
    people.push({ id: object.name, object, material: personMaterial, focus, bindings: bindRuntimeMaterial(object, personMaterial), point });
  });
  return people.sort((first, second) => Number(first.id.slice(6)) - Number(second.id.slice(6)));
}

export function projectVisibleCrowdPeople(
  people: readonly CrowdPersonRuntime[],
  world: THREE.Scene,
  camera: THREE.Camera,
  element: HTMLCanvasElement,
  raycaster: THREE.Raycaster,
) {
  const opaque = getOpaqueMeshes(world);
  const rect = element.getBoundingClientRect();
  const projected = new THREE.Vector3();
  const ndc = new THREE.Vector2();
  return people.flatMap<IntelligencePersonPoint>((person) => {
    projected.copy(person.point).project(camera);
    const x = rect.left + (projected.x * 0.5 + 0.5) * rect.width;
    const y = rect.top + (-projected.y * 0.5 + 0.5) * rect.height;
    if (projected.z < -1 || projected.z > 1 || x < 24 || x > rect.right - 24 || y < 90 || y > rect.bottom - 160) return [];
    ndc.set(projected.x, projected.y);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(opaque, false)[0];
    if (!hit || getCrowdPersonId(hit.object) !== person.id) return [];
    return [{ id: person.id, x: Math.round(x), y: Math.round(y) }];
  });
}
