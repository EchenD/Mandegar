"use client";

/* eslint-disable react-hooks/immutability -- R3F frame callbacks update shader uniforms directly. */

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  bakedSceneContract,
  validateContractNodes,
} from "./baked-scene-contract";
import {
  createBakedSceneMaterial,
  type BakedMaterialUniforms,
} from "./baked-scene-material";
import {
  bindRuntimeMaterial,
  restoreRuntimeMaterial,
  type RuntimeMaterialBinding,
} from "./baked-material-binding";
import { experienceState } from "./experience-state";
import { assetSlots, sceneTokens } from "./scene-config";
import { CrowdIntelligenceNetwork } from "./CrowdIntelligenceNetwork";

type CrowdRuntime = {
  mode: "baked" | "fallback";
  material: THREE.ShaderMaterial | THREE.MeshBasicMaterial;
  root: THREE.Object3D;
  uniforms?: BakedMaterialUniforms;
  bindings: RuntimeMaterialBinding[];
};

function BakedCrowdAsset({
  quietMap,
  peakMap,
}: {
  quietMap: THREE.Texture;
  peakMap: THREE.Texture;
}) {
  const gltf = useLoader(GLTFLoader, assetSlots.crowd);
  const scene = useMemo(() => {
    const clone = cloneSkeleton(gltf.scene);
    clone.visible = false;
    return clone;
  }, [gltf.scene]);
  const requiredNodes = useMemo(() => [
    bakedSceneContract.crowd.root,
    ...bakedSceneContract.crowd.groups,
  ], []);
  const usesCrowdFallback = useMemo(
    () => requiredNodes.some((name) => !gltf.scene.getObjectByName(name)),
    [gltf.scene, requiredNodes],
  );
  const runtimeRef = useRef<CrowdRuntime | null>(null);

  useEffect(() => {
    validateContractNodes(gltf.scene, requiredNodes, "Crowd GLB");
  }, [gltf.scene, requiredNodes]);

  useEffect(() => {
    scene.updateMatrixWorld(true);
    const root = scene.getObjectByName(bakedSceneContract.crowd.root) ?? scene;
    const baked = usesCrowdFallback
      ? null
      : createBakedSceneMaterial({
        name: "MAT_CROWD_BAKED_RUNTIME",
        quietMap,
        peakMap,
        edgeColor: sceneTokens.bakedScene.material.edgeColor,
      });
    const material = baked?.material ?? new THREE.MeshBasicMaterial({
      name: "MAT_CROWD_FALLBACK_RUNTIME",
      color: sceneTokens.bakedScene.crowdFallbackColor,
      opacity: 0,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
    });
    const bindings = bindRuntimeMaterial(root, material);
    if (baked) {
      const bounds = new THREE.Box3().setFromObject(root);
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      baked.uniforms.uRevealOrigin.value.copy(center);
      baked.uniforms.uRevealExtent.value = Math.max(0.001, size.length() * 0.58);
    }
    const runtime = {
      mode: baked ? "baked" : "fallback",
      material,
      root,
      uniforms: baked?.uniforms,
      bindings,
    } satisfies CrowdRuntime;
    runtime.root.visible = experienceState.stage.production.crowdPresence > 0.001;
    runtimeRef.current = runtime;
    scene.visible = true;

    return () => {
      if (runtimeRef.current === runtime) {
        runtimeRef.current = null;
      }
      scene.visible = false;
      restoreRuntimeMaterial(runtime.bindings, runtime.material);
      runtime.material.dispose();
    };
  }, [peakMap, quietMap, scene, usesCrowdFallback]);

  useFrame(({ clock }) => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    const production = experienceState.stage.production;
    if (runtime.mode === "baked" && runtime.uniforms) {
      updateCrowdUniforms(runtime.uniforms, production.crowdPresence, production);
      runtime.uniforms.uTime.value = clock.elapsedTime;
    } else if (runtime.material instanceof THREE.MeshBasicMaterial) {
      runtime.material.opacity = smoothstep(production.crowdPresence);
      runtime.material.depthWrite = production.crowdPresence > 0.98;
    }
    runtime.root.visible = production.crowdPresence > 0.001;
  });

  return (
    <>
      <primitive object={scene} />
      <CrowdIntelligenceNetwork crowd={scene} />
    </>
  );
}

function smoothstep(value: number) {
  const safe = THREE.MathUtils.clamp(value, 0, 1);
  return safe * safe * (3 - 2 * safe);
}

function updateCrowdUniforms(
  uniforms: BakedMaterialUniforms,
  presence: number,
  production: typeof experienceState.stage.production,
) {
  uniforms.uRevealProgress.value = presence;
  uniforms.uPeakMix.value = Math.max(
    production.centralPeak,
    production.leftPeak,
    production.rightPeak,
  );
  uniforms.uEdgeWidth.value = production.revealEdgeWidth;
  uniforms.uTurbulence.value = production.revealTurbulence;
}

export function DeferredBakedCrowd({
  quietMap,
  peakMap,
}: {
  quietMap: THREE.Texture;
  peakMap: THREE.Texture;
}) {
  const [shouldLoad, setShouldLoad] = useState(false);
  useFrame(() => {
    if (
      !shouldLoad
      && (
        experienceState.progress >= sceneTokens.bakedScene.crowdPreloadProgress
        || experienceState.stage.production.crowdPresence > 0.001
      )
    ) {
      setShouldLoad(true);
    }
  });
  if (!shouldLoad) return null;
  return (
    <Suspense fallback={null}>
      <BakedCrowdAsset quietMap={quietMap} peakMap={peakMap} />
    </Suspense>
  );
}
