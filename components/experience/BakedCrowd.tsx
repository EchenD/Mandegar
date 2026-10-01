"use client";

/* eslint-disable react-hooks/immutability -- R3F frame callbacks update shader uniforms directly. */

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  bakedSceneContract,
  validateContractMaterials,
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
import { getRevealExtent, getRevealOrigin } from "./baked-reveal-geometry";
import { experienceState } from "./experience-state";
import { assetSlots, sceneTokens } from "./scene-config";
import { CrowdIntelligenceNetwork } from "./CrowdIntelligenceNetwork";
import { interactionRuntime } from "./interactions/interaction-runtime";
import { getVisitorCreation } from "./interactions/visitor-creation";
import { getVisitorPresentation } from "./interactions/visitor-presentation";

type CrowdRuntime = {
  material: THREE.ShaderMaterial;
  root: THREE.Object3D;
  uniforms: BakedMaterialUniforms;
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
  const runtimeRef = useRef<CrowdRuntime | null>(null);

  useEffect(() => {
    validateContractNodes(gltf.scene, [bakedSceneContract.crowd.root], "Crowd GLB");
    validateContractMaterials(
      gltf.scene,
      [bakedSceneContract.materials.exhibition],
      "Crowd GLB",
    );
  }, [gltf.scene]);

  useEffect(() => {
    scene.updateMatrixWorld(true);
    const root = scene.getObjectByName(bakedSceneContract.crowd.root) ?? scene;
    const baked = createBakedSceneMaterial({
      name: "MAT_CROWD_BAKED_RUNTIME",
      quietMap,
      peakMap,
      edgeColor: sceneTokens.bakedScene.material.edgeColor,
    });
    const revealOrigin = getRevealOrigin(root, null);
    baked.uniforms.uRevealOrigin.value.copy(revealOrigin);
    baked.uniforms.uRevealExtent.value = getRevealExtent(root, revealOrigin);
    baked.uniforms.uEdgeStrength.value = sceneTokens.bakedScene.material.edgeStrength;
    const bindings = bindRuntimeMaterial(root, baked.material);
    const runtime = {
      material: baked.material,
      root,
      uniforms: baked.uniforms,
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
  }, [peakMap, quietMap, scene]);

  useFrame(({ clock }) => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    const production = experienceState.stage.production;
    const presence = production.crowdPresence;
    updateCrowdUniforms(runtime.uniforms, presence, production);
    runtime.uniforms.uTime.value = clock.elapsedTime;
    runtime.root.visible = presence > 0.001;
  });

  return (
    <>
      <primitive object={scene} />
      <CrowdIntelligenceNetwork crowd={scene} />
    </>
  );
}

function updateCrowdUniforms(
  uniforms: BakedMaterialUniforms,
  presence: number,
  production: typeof experienceState.stage.production,
) {
  uniforms.uRevealProgress.value = presence;
  uniforms.uPeakMix.value = Math.max(
    (interactionRuntime.activeStation === "touch" ? interactionRuntime.touchElements : getVisitorCreation().composer)[2]
      ? 0.75 * (interactionRuntime.activeStation === "touch" ? interactionRuntime.touchVisibility : getVisitorPresentation(experienceState.progress).composerVisibility)
      : 0,
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
