import * as THREE from "three";

export function getRevealOrigin(
  root: THREE.Object3D,
  anchor: THREE.Object3D | null | undefined,
  target = new THREE.Vector3(),
) {
  if (anchor) {
    return anchor.getWorldPosition(target);
  }

  return new THREE.Box3().setFromObject(root).getCenter(target);
}

export function getRevealExtent(root: THREE.Object3D, origin: THREE.Vector3) {
  const bounds = new THREE.Box3().setFromObject(root);
  if (bounds.isEmpty()) return 1;
  return [
    new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.min.z),
    new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.max.z),
    new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.min.z),
    new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.max.z),
    new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.min.z),
    new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.max.z),
    new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.min.z),
    new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.max.z),
  ].reduce((maximum, corner) => Math.max(maximum, corner.distanceTo(origin)), 1);
}
