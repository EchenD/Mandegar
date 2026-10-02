"use client";

/* eslint-disable react-hooks/immutability -- R3F frame callbacks update shader uniforms directly. */

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useLoader, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { Locale } from "@/lib/i18n";
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
  restoreRuntimeMaterial,
} from "./baked-material-binding";
import { getRevealExtent, getRevealOrigin } from "./baked-reveal-geometry";
import { experienceState } from "./experience-state";
import { assetSlots, sceneTokens } from "./scene-config";
import { CrowdIntelligenceNetwork } from "./CrowdIntelligenceNetwork";
import { CrowdPersonReadout } from "./CrowdPersonReadout";
import { interactionRuntime } from "./interactions/interaction-runtime";
import { getVisitorCreation } from "./interactions/visitor-creation";
import { getVisitorPresentation } from "./interactions/visitor-presentation";
import {
  createCrowdPeople,
  getCrowdPersonAtRay,
  getCrowdPersonId,
  getCrowdReadoutPoint,
  isCrowdPersonOccluded,
  projectVisibleCrowdPeople,
  type CrowdPersonRuntime,
} from "./crowd-person-inspection";
import {
  getFocusedIntelligencePerson,
  clearIntelligenceSelection,
  getIntelligenceSnapshot,
  hoverIntelligencePerson,
  pinIntelligencePerson,
  subscribeIntelligenceInspector,
  updateIntelligencePeople,
} from "./intelligence-inspector-store";

type CrowdRuntime = {
  material: THREE.ShaderMaterial;
  root: THREE.Object3D;
  uniforms: BakedMaterialUniforms;
  people: CrowdPersonRuntime[];
  nextProjection: number;
  ownsCursor: boolean;
  pointerHits: Map<string, THREE.Vector3>;
};

function canInspectPeople() {
  return experienceState.sequence === "loop"
    && experienceState.narrative.phase === "intelligence"
    && experienceState.stage.production.crowdPresence > 0.01
    && interactionRuntime.activeStation === null
    && !document.hidden;
}

function BakedCrowdAsset({
  quietMap,
  peakMap,
  locale,
}: {
  quietMap: THREE.Texture;
  peakMap: THREE.Texture;
  locale: Locale;
}) {
  const gltf = useLoader(GLTFLoader, assetSlots.crowd);
  const { camera, gl, scene: world } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const personProjection = useMemo(() => new THREE.Vector3(), []);
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
      crowdFalloff: true,
    });
    if (process.env.NODE_ENV !== "production") {
      const variant = new URLSearchParams(window.location.search).get("crowdFalloff");
      if (variant === "off") baked.uniforms.uCrowdFalloffStrength.value = 0;
      else if (variant === "strong") baked.uniforms.uCrowdFalloffStrength.value = 0.8;
      else if (variant === "soft") baked.uniforms.uCrowdFalloffStrength.value = 0.32;
    }
    const revealOrigin = getRevealOrigin(root, null);
    baked.uniforms.uRevealOrigin.value.copy(revealOrigin);
    baked.uniforms.uRevealExtent.value = getRevealExtent(root, revealOrigin);
    baked.uniforms.uEdgeStrength.value = sceneTokens.bakedScene.material.edgeStrength;
    const people = createCrowdPeople(root, baked.material, baked.uniforms);
    const runtime = {
      material: baked.material,
      root,
      uniforms: baked.uniforms,
      people,
      nextProjection: 0,
      ownsCursor: false,
      pointerHits: new Map<string, THREE.Vector3>(),
    } satisfies CrowdRuntime;
    runtime.root.visible = experienceState.stage.production.crowdPresence > 0.001;
    runtimeRef.current = runtime;
    scene.visible = true;
    const releaseFocus = () => {
      clearIntelligenceSelection();
      runtime.people.forEach((person) => { person.focus.value = 0; });
      if (runtime.ownsCursor) document.body.style.cursor = "";
      runtime.ownsCursor = false;
      runtime.pointerHits.clear();
    };
    const releaseWhenHidden = () => { if (document.hidden) releaseFocus(); };
    const unsubscribe = subscribeIntelligenceInspector(() => {
      if (!getIntelligenceSnapshot().available) releaseFocus();
    });
    window.addEventListener("blur", releaseFocus);
    document.addEventListener("visibilitychange", releaseWhenHidden);

    return () => {
      unsubscribe();
      window.removeEventListener("blur", releaseFocus);
      document.removeEventListener("visibilitychange", releaseWhenHidden);
      if (runtimeRef.current === runtime) {
        runtimeRef.current = null;
      }
      scene.visible = false;
      updateIntelligencePeople(null);
      if (runtime.ownsCursor) document.body.style.cursor = "";
      runtime.people.forEach((person) => {
        restoreRuntimeMaterial(person.bindings, person.material);
        person.material.dispose();
      });
      runtime.material.dispose();
    };
  }, [peakMap, quietMap, scene]);

  useFrame(({ clock }, delta) => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    const production = experienceState.stage.production;
    const presence = production.crowdPresence;
    updateCrowdUniforms(runtime.uniforms, presence, production);
    runtime.uniforms.uTime.value = clock.elapsedTime;
    runtime.root.visible = presence > 0.001;
    const inspecting = canInspectPeople();
    const projecting = inspecting && clock.elapsedTime >= runtime.nextProjection;
    if (projecting) {
      updateIntelligencePeople(projectVisibleCrowdPeople(runtime.people, world, camera, gl.domElement, raycaster));
      runtime.nextProjection = clock.elapsedTime + 0.4;
    } else if (!inspecting) {
      updateIntelligencePeople(null);
      runtime.nextProjection = 0;
      if (runtime.ownsCursor && !interactionRuntime.activeStation) document.body.style.cursor = "";
      runtime.ownsCursor = false;
      runtime.pointerHits.clear();
    }
    let focused = inspecting ? getFocusedIntelligencePerson() : null;
    if (focused) {
      const selected = runtime.people.find((person) => person.id === focused);
      let visible = Boolean(selected);
      for (let ancestor: THREE.Object3D | null = selected?.object ?? null; ancestor; ancestor = ancestor.parent) {
        if (!ancestor.visible) visible = false;
      }
      if (selected) {
        const pointerHit = runtime.pointerHits.get(selected.id);
        visible = visible && Boolean(getCrowdReadoutPoint(selected.point, camera, pointerHit, personProjection));
        if (visible && projecting) visible = !isCrowdPersonOccluded(
          selected.object, world, camera, raycaster, pointerHit,
        );
      }
      if (!visible) {
        clearIntelligenceSelection();
        if (runtime.ownsCursor) document.body.style.cursor = "";
        runtime.ownsCursor = false;
        runtime.pointerHits.delete(focused);
        focused = null;
      }
    }
    runtime.people.forEach((person) => {
      person.focus.value = inspecting
        ? THREE.MathUtils.damp(person.focus.value, person.id === focused ? 1 : 0, 20, delta)
        : 0;
    });
  });

  const personFromHit = (event: ThreeEvent<PointerEvent> | ThreeEvent<MouseEvent>) => {
    if (!canInspectPeople()) return null;
    const id = getCrowdPersonAtRay(world, event.ray, raycaster);
    return id && id === getCrowdPersonId(event.object) ? id : null;
  };
  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    const id = personFromHit(event);
    if (!id || event.pointerType === "touch") return;
    event.stopPropagation();
    hoverIntelligencePerson(id);
    document.body.style.cursor = "pointer";
    if (runtimeRef.current) {
      runtimeRef.current.ownsCursor = true;
      const point = runtimeRef.current.pointerHits.get(id) ?? new THREE.Vector3();
      point.copy(event.point);
      runtimeRef.current.pointerHits.set(id, point);
    }
  };
  const handlePointerOut = (event: ThreeEvent<PointerEvent>) => {
    const id = getCrowdPersonId(event.object);
    if (id && getIntelligenceSnapshot().hovered === id) hoverIntelligencePerson(null);
    if (runtimeRef.current?.ownsCursor) {
      document.body.style.cursor = "";
      runtimeRef.current.ownsCursor = false;
    }
  };
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    const id = personFromHit(event);
    if (!id) return;
    event.stopPropagation();
    if (runtimeRef.current) {
      const point = runtimeRef.current.pointerHits.get(id) ?? new THREE.Vector3();
      point.copy(event.point);
      runtimeRef.current.pointerHits.set(id, point);
    }
    pinIntelligencePerson(id);
  };

  return (
    <>
      <primitive object={scene} onPointerMove={handlePointerMove} onPointerOut={handlePointerOut} onClick={handleClick} />
      <CrowdIntelligenceNetwork crowd={scene} />
      <CrowdPersonReadout
        locale={locale}
        getPeople={() => runtimeRef.current?.people ?? []}
        getPointerHit={(id) => runtimeRef.current?.pointerHits.get(id)}
      />
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
  locale,
}: {
  quietMap: THREE.Texture;
  peakMap: THREE.Texture;
  locale: Locale;
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
      <BakedCrowdAsset quietMap={quietMap} peakMap={peakMap} locale={locale} />
    </Suspense>
  );
}
