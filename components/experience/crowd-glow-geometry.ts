import * as THREE from "three";

export type CrowdGlowGeometryBinding = {
  mesh: THREE.Mesh;
  source: THREE.BufferGeometry;
  owned: THREE.BufferGeometry;
};

/** Smooth only the glow across atlas seams; preserve all authored attributes and topology. */
export function createCrowdGlowGeometry(source: THREE.BufferGeometry) {
  const geometry = source.clone();
  const position = source.getAttribute("position");
  const authoredNormal = source.getAttribute("normal");
  if (!position || position.itemSize < 3) return geometry;
  const sums = new Map<string, THREE.Vector3>();
  const keys: string[] = [];
  for (let index = 0; index < position.count; index += 1) {
    const key = `${position.getX(index)},${position.getY(index)},${position.getZ(index)}`;
    keys.push(key);
    if (!sums.has(key)) sums.set(key, new THREE.Vector3());
  }
  const first = new THREE.Vector3();
  const second = new THREE.Vector3();
  const third = new THREE.Vector3();
  const edge = new THREE.Vector3();
  const areaNormal = new THREE.Vector3();
  const indexCount = source.index?.count ?? position.count;
  for (let triangle = 0; triangle + 2 < indexCount; triangle += 3) {
    const a = source.index?.getX(triangle) ?? triangle;
    const b = source.index?.getX(triangle + 1) ?? triangle + 1;
    const c = source.index?.getX(triangle + 2) ?? triangle + 2;
    first.fromBufferAttribute(position, a);
    second.fromBufferAttribute(position, b);
    third.fromBufferAttribute(position, c);
    edge.subVectors(second, first);
    areaNormal.subVectors(third, first).crossVectors(edge, areaNormal);
    if (!Number.isFinite(areaNormal.lengthSq()) || areaNormal.lengthSq() < 1e-20) continue;
    sums.get(keys[a])?.add(areaNormal);
    sums.get(keys[b])?.add(areaNormal);
    sums.get(keys[c])?.add(areaNormal);
  }
  const values = new Float32Array(position.count * 3);
  const normal = new THREE.Vector3();
  for (let index = 0; index < position.count; index += 1) {
    normal.copy(sums.get(keys[index])!);
    if (normal.lengthSq() < 1e-20 && authoredNormal) normal.fromBufferAttribute(authoredNormal, index);
    if (!Number.isFinite(normal.lengthSq()) || normal.lengthSq() < 1e-20) normal.set(0, 1, 0);
    normal.normalize().toArray(values, index * 3);
  }
  geometry.setAttribute("glowNormal", new THREE.BufferAttribute(values, 3));
  return geometry;
}

export function bindCrowdGlowGeometry(root: THREE.Object3D) {
  const bindings: CrowdGlowGeometryBinding[] = [];
  const geometries = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || !object.geometry.getAttribute("position")) return;
    const source = object.geometry;
    const owned = geometries.get(source) ?? createCrowdGlowGeometry(source);
    geometries.set(source, owned);
    bindings.push({ mesh: object, source, owned });
    object.geometry = owned;
  });
  return bindings;
}

/** Restore only geometry still owned by this runtime; never dispose source assets. */
export function restoreCrowdGlowGeometry(bindings: readonly CrowdGlowGeometryBinding[]) {
  const owned = new Set<THREE.BufferGeometry>();
  bindings.forEach((binding) => {
    if (binding.mesh.geometry === binding.owned) binding.mesh.geometry = binding.source;
    owned.add(binding.owned);
  });
  owned.forEach((geometry) => geometry.dispose());
}
