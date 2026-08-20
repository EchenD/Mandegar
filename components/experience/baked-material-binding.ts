import * as THREE from "three";

export type RuntimeMaterialBinding = {
  mesh: THREE.Mesh;
  material: THREE.Material | THREE.Material[];
  castShadow: boolean;
  receiveShadow: boolean;
};

export function bindRuntimeMaterial(
  root: THREE.Object3D,
  material: THREE.Material,
  excludedObjects: ReadonlySet<THREE.Object3D> = new Set<THREE.Object3D>(),
): RuntimeMaterialBinding[] {
  const bindings: RuntimeMaterialBinding[] = [];

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || excludedObjects.has(child)) {
      return;
    }

    bindings.push({
      mesh: child,
      material: child.material,
      castShadow: child.castShadow,
      receiveShadow: child.receiveShadow,
    });
    child.material = material;
    child.castShadow = false;
    child.receiveShadow = false;
  });

  return bindings;
}

export function restoreRuntimeMaterial(
  bindings: RuntimeMaterialBinding[],
  ownedMaterial: THREE.Material,
) {
  bindings.forEach((binding) => {
    if (binding.mesh.material !== ownedMaterial) {
      return;
    }

    binding.mesh.material = binding.material;
    binding.mesh.castShadow = binding.castShadow;
    binding.mesh.receiveShadow = binding.receiveShadow;
  });
}
