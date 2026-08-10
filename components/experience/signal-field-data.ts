import * as THREE from "three";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import { sceneTokens } from "./scene-config";

export type SignalFieldData = {
  geometry: THREE.BufferGeometry;
  focus: THREE.Vector3;
};

type SurfaceParticleBinding = {
  mesh: THREE.Mesh;
  sampler: MeshSurfaceSampler;
  bounds: THREE.Box3;
  normalMatrix: THREE.Matrix3;
  wake: number;
  color: THREE.Color;
  cumulativeWeight: number;
};

type SignalRoute = {
  from: THREE.Vector3;
  control: THREE.Vector3;
  to: THREE.Vector3;
};

function seededNoise(value: number) {
  const raw = Math.sin(value * 12.9898 + 78.233) * 43758.5453;
  return raw - Math.floor(raw);
}

function getObjectCenter(scene: THREE.Object3D, name: string, target = new THREE.Vector3()) {
  const object = scene.getObjectByName(name);
  if (!object) return null;
  if (object instanceof THREE.Mesh) {
    const bounds = new THREE.Box3().setFromObject(object);
    if (!bounds.isEmpty()) return bounds.getCenter(target);
  }
  return object.getWorldPosition(target);
}

function getNamedMesh(scene: THREE.Object3D, name: string) {
  const object = scene.getObjectByName(name);
  if (object instanceof THREE.Mesh) return object;
  let mesh: THREE.Mesh | null = null;
  object?.traverse((child) => {
    if (!mesh && child instanceof THREE.Mesh) mesh = child;
  });
  return mesh;
}

function makeSurfaceSampler(mesh: THREE.Mesh, salt: number) {
  const sampler = new MeshSurfaceSampler(mesh);
  let sampleIndex = 0;
  (sampler as unknown as {
    setRandomGenerator: (generator: () => number) => MeshSurfaceSampler;
  }).setRandomGenerator(() => seededNoise((sampleIndex += 1) * 9.731 + salt));
  sampler.build();
  return sampler;
}

function getSurfaceParticleBindings(sourceScene: THREE.Object3D) {
  let cumulativeWeight = 0;
  return sceneTokens.particles.surfaceNodes.flatMap<SurfaceParticleBinding>((definition, index) => {
    const mesh = getNamedMesh(sourceScene, definition.name);
    if (!mesh) return [];
    cumulativeWeight += definition.weight;
    return [{
      mesh,
      sampler: makeSurfaceSampler(mesh, 7.17 + index * 13.1),
      bounds: new THREE.Box3().setFromObject(mesh),
      normalMatrix: new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld),
      wake: definition.wake,
      color: new THREE.Color(definition.color).multiplyScalar(sceneTokens.particles.luminance.active),
      cumulativeWeight,
    }];
  });
}

function getSignalRoutes(sourceScene: THREE.Object3D, knownHaloCenter?: THREE.Vector3) {
  sourceScene.updateMatrixWorld(true);
  const sceneBounds = new THREE.Box3().setFromObject(sourceScene);
  const sceneCenter = sceneBounds.getCenter(new THREE.Vector3());
  const haloCenter = knownHaloCenter
    ?? getObjectCenter(sourceScene, sceneTokens.particles.modelNodes.haloMesh)
    ?? getObjectCenter(sourceScene, sceneTokens.particles.modelNodes.haloAnchor)
    ?? new THREE.Vector3(0, sceneCenter.y, 0);
  const getRoutePoint = (name: string) => name === sceneTokens.particles.modelNodes.haloMesh
    ? haloCenter.clone()
    : getObjectCenter(sourceScene, name);
  const routes = sceneTokens.particles.modelNodes.signalRoutes.flatMap<SignalRoute>((names) => {
    const from = getRoutePoint(names[0]);
    const to = getRoutePoint(names[1]);
    if (!from || !to) return [];
    const control = from.clone().lerp(to, 0.5);
    const horizontalDistance = Math.hypot(to.x - from.x, to.z - from.z);
    control.y += Math.min(0.72, 0.16 + horizontalDistance * 0.08);
    control.z = THREE.MathUtils.lerp(control.z, sceneCenter.z, 0.08);
    return [{ from, control, to }];
  });
  if (routes.length === 0) {
    const left = new THREE.Vector3(sceneBounds.min.x, sceneCenter.y, sceneCenter.z);
    const right = new THREE.Vector3(sceneBounds.max.x, sceneCenter.y, sceneCenter.z);
    routes.push(
      { from: left, control: left.clone().lerp(haloCenter, 0.5).add(new THREE.Vector3(0, 0.3, 0)), to: haloCenter.clone() },
      { from: haloCenter.clone(), control: haloCenter.clone().lerp(right, 0.5).add(new THREE.Vector3(0, 0.3, 0)), to: right },
    );
  }
  return routes;
}

export function createSignalFieldData(count: number, sourceScene: THREE.Object3D): SignalFieldData {
  sourceScene.updateMatrixWorld(true);
  const sceneBounds = new THREE.Box3().setFromObject(sourceScene);
  const sceneCenter = sceneBounds.getCenter(new THREE.Vector3());
  const sceneSize = sceneBounds.getSize(new THREE.Vector3());
  const floorObject = sourceScene.getObjectByName(sceneTokens.particles.modelNodes.floor);
  const floorBounds = floorObject ? new THREE.Box3().setFromObject(floorObject) : sceneBounds;
  const floorY = floorBounds.isEmpty() ? sceneBounds.min.y : floorBounds.max.y;
  const haloMeshObject = sourceScene.getObjectByName(sceneTokens.particles.modelNodes.haloMesh);
  const haloMesh = haloMeshObject instanceof THREE.Mesh ? haloMeshObject : null;
  const haloCenter = haloMesh
    ? new THREE.Box3().setFromObject(haloMesh).getCenter(new THREE.Vector3())
    : getObjectCenter(sourceScene, sceneTokens.particles.modelNodes.haloAnchor) ?? new THREE.Vector3(0, sceneCenter.y, 0);
  const focus = getObjectCenter(sourceScene, sceneTokens.particles.modelNodes.focusAnchor) ?? sceneCenter.clone();
  const signalRoutes = getSignalRoutes(sourceScene, haloCenter);
  const surfaceBindings = getSurfaceParticleBindings(sourceScene);
  const surfaceWeight = surfaceBindings.at(-1)?.cumulativeWeight ?? 0;
  const layerWeight = sceneTokens.particles.layers.atmosphere
    + sceneTokens.particles.layers.surface
    + sceneTokens.particles.layers.signal;
  const atmosphereCount = Math.floor(count * sceneTokens.particles.layers.atmosphere / layerWeight);
  const surfaceCount = Math.floor(count * sceneTokens.particles.layers.surface / layerWeight);
  const surfaceEnd = Math.min(count, atmosphereCount + surfaceCount);

  const ambient = new Float32Array(count * 3);
  const surfaceTargets = new Float32Array(count * 3);
  const pathFrom = new Float32Array(count * 3);
  const pathControl = new Float32Array(count * 3);
  const pathTo = new Float32Array(count * 3);
  const ring = new Float32Array(count * 3);
  const energyColors = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const layers = new Float32Array(count);
  const wakes = new Float32Array(count);
  const pointScales = new Float32Array(count);
  const quiet = new THREE.Color(sceneTokens.particles.quietColor).multiplyScalar(sceneTokens.particles.luminance.quiet);
  const palette = sceneTokens.particles.palette.map((color) => (
    new THREE.Color(color).multiplyScalar(sceneTokens.particles.luminance.active)
  ));
  const ringSampler = haloMesh ? makeSurfaceSampler(haloMesh, 3.17) : null;
  const ringSample = new THREE.Vector3();
  const surfaceSample = new THREE.Vector3();
  const surfaceNormal = new THREE.Vector3();
  const surfaceSize = new THREE.Vector3();
  const fallbackRadius = Math.max(sceneSize.x, sceneSize.z) * 0.2;

  for (let index = 0; index < count; index += 1) {
    const offset = index * 3;
    const seedA = seededNoise(index * 3.17 + 1.3);
    const seedB = seededNoise(index * 7.91 + 4.7);
    const seedC = seededNoise(index * 13.37 + 9.2);
    seeds[index] = seededNoise(index * 17.17 + 5.9);
    const distribution = index % 20;
    if (distribution < 5) {
      ambient[offset] = sceneCenter.x + (seedA * 2 - 1) * sceneSize.x * 0.5;
      ambient[offset + 1] = floorY + 0.035 + Math.pow(seedB, 2.4) * 0.32;
      ambient[offset + 2] = sceneCenter.z + (seedC * 2 - 1) * sceneSize.z * 0.52;
    } else if (distribution < 12) {
      ambient[offset] = sceneCenter.x + (seedA * 2 - 1) * sceneSize.x * 0.46;
      ambient[offset + 1] = floorY + 0.18 + Math.pow(seedB, 1.25) * sceneSize.y * 0.78;
      ambient[offset + 2] = sceneCenter.z + (seedC * 2 - 1) * sceneSize.z * 0.46;
    } else if (distribution < 17) {
      ambient[offset] = sceneCenter.x + (seedA * 2 - 1) * sceneSize.x * 0.51;
      ambient[offset + 1] = floorY + 0.3 + seedB * sceneSize.y * 0.88;
      ambient[offset + 2] = sceneBounds.min.z + sceneSize.z * (0.015 + seedC * 0.045);
    } else {
      ambient[offset] = distribution % 2 === 0
        ? THREE.MathUtils.lerp(sceneBounds.min.x, sceneCenter.x, seedA * 0.18)
        : THREE.MathUtils.lerp(sceneBounds.max.x, sceneCenter.x, seedA * 0.18);
      ambient[offset + 1] = floorY + 0.25 + seedB * sceneSize.y * 0.82;
      ambient[offset + 2] = sceneCenter.z + (seedC * 2 - 1) * sceneSize.z * 0.45;
    }

    surfaceTargets.set(ambient.subarray(offset, offset + 3), offset);
    pathFrom.set(ambient.subarray(offset, offset + 3), offset);
    pathControl.set(ambient.subarray(offset, offset + 3), offset);
    pathTo.set(ambient.subarray(offset, offset + 3), offset);
    ring.set(ambient.subarray(offset, offset + 3), offset);

    let layer = index < atmosphereCount ? 0 : index < surfaceEnd ? 1 : 2;
    if (layer === 1 && surfaceWeight > 0) {
      const selection = seededNoise((index - atmosphereCount) * 5.17 + 1.9) * surfaceWeight;
      const binding = surfaceBindings.find((candidate) => selection <= candidate.cumulativeWeight) ?? surfaceBindings.at(-1);
      if (binding) {
        binding.sampler.sample(surfaceSample, surfaceNormal);
        surfaceSample.applyMatrix4(binding.mesh.matrixWorld);
        surfaceNormal.applyMatrix3(binding.normalMatrix).normalize();
        surfaceSample.addScaledVector(surfaceNormal, sceneTokens.particles.motion.surfaceOffset);
        surfaceSample.toArray(surfaceTargets, offset);
        const height = Math.max(0.001, binding.bounds.getSize(surfaceSize).y);
        const verticalOrder = THREE.MathUtils.clamp((surfaceSample.y - binding.bounds.min.y) / height, 0, 1);
        wakes[index] = binding.wake + verticalOrder * 0.035;
        binding.color.toArray(energyColors, offset);
      }
      pointScales[index] = 0.75 + seedB * 0.45;
    } else if (layer === 2) {
      const signalIndex = index - surfaceEnd;
      const route = signalRoutes[signalIndex % signalRoutes.length];
      route.from.toArray(pathFrom, offset);
      route.control.toArray(pathControl, offset);
      route.to.toArray(pathTo, offset);
      if (ringSampler && haloMesh) {
        ringSampler.sample(ringSample);
        ringSample.applyMatrix4(haloMesh.matrixWorld).toArray(ring, offset);
      } else {
        const angle = signalIndex * 2.399963;
        ring[offset] = haloCenter.x + Math.cos(angle) * fallbackRadius;
        ring[offset + 1] = haloCenter.y + (seedB - 0.5) * 0.16;
        ring[offset + 2] = haloCenter.z + Math.sin(angle) * fallbackRadius;
      }
      const signalColor = palette[(signalIndex + 1) % palette.length];
      signalColor.toArray(energyColors, offset);
      pointScales[index] = 0.8 + seedB * 0.5;
    } else {
      layer = 0;
      const dustColor = palette[index % palette.length];
      dustColor.toArray(energyColors, offset);
      pointScales[index] = 0.55 + seedB * 0.7;
    }
    layers[index] = layer;
    const energy = palette[index % palette.length];
    if (energyColors[offset] === 0 && energyColors[offset + 1] === 0 && energyColors[offset + 2] === 0) {
      energy.toArray(energyColors, offset);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(ambient, 3));
  geometry.setAttribute("aSurface", new THREE.BufferAttribute(surfaceTargets, 3));
  geometry.setAttribute("aPathFrom", new THREE.BufferAttribute(pathFrom, 3));
  geometry.setAttribute("aPathControl", new THREE.BufferAttribute(pathControl, 3));
  geometry.setAttribute("aPathTo", new THREE.BufferAttribute(pathTo, 3));
  geometry.setAttribute("aRing", new THREE.BufferAttribute(ring, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute("aLayer", new THREE.BufferAttribute(layers, 1));
  geometry.setAttribute("aWake", new THREE.BufferAttribute(wakes, 1));
  geometry.setAttribute("aPointScale", new THREE.BufferAttribute(pointScales, 1));
  geometry.setAttribute("aEnergyColor", new THREE.BufferAttribute(energyColors, 3));
  const quietColors = new Float32Array(count * 3);
  for (let index = 0; index < quietColors.length; index += 3) {
    quietColors[index] = quiet.r;
    quietColors[index + 1] = quiet.g;
    quietColors[index + 2] = quiet.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(quietColors, 3));
  geometry.computeBoundingSphere();
  return { geometry, focus };
}
