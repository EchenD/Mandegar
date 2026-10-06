"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { bakedSceneContract, type BakedExhibitionSectionId, type BakedScreenId } from "./baked-scene-contract";
import { getRevealExtent, getRevealOrigin } from "./baked-reveal-geometry";
import { prepareBakedTexture } from "./baked-scene-material";
import { getVisitorCreation } from "./interactions/visitor-creation";
import { experienceState } from "./experience-state";
import { heroTimeline } from "./hero-timeline-config";
import { interactionRuntime } from "./interactions/interaction-runtime";

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uMedia;
  uniform sampler2D uBaseMedia;
  uniform float uContentOpacity;
  uniform float uMediaBlend;
  uniform float uTime;
  uniform float uRevealProgress;
  uniform vec3 uRevealOrigin;
  uniform float uRevealExtent;
  uniform float uRevealEdgeWidth;
  uniform float uRevealTurbulence;
  varying vec2 vUv;
  varying vec3 vWorldPosition;

  float hash12(vec2 value) {
    vec3 point = fract(vec3(value.xyx) * 0.1031);
    point += dot(point, point.yzx + 33.33);
    return fract((point.x + point.y) * point.z);
  }

  float revealNoise(vec3 point) {
    vec3 samplePoint = point * 1.37;
    float first = sin(samplePoint.x + sin(samplePoint.z * 1.7 + uTime * 0.31));
    float second = sin(samplePoint.y * 1.43 - uTime * 0.22 + samplePoint.x * 0.63);
    float third = sin(samplePoint.z * 2.11 + samplePoint.y * 0.71 + uTime * 0.17);
    return (first + second + third) / 3.0;
  }

  void main() {
    float safeExtent = max(0.001, uRevealExtent);
    float distanceField = length(vWorldPosition - uRevealOrigin) / safeExtent;
    float turbulence = revealNoise(vWorldPosition / safeExtent * 7.0)
      * mix(0.012, 0.11, uRevealTurbulence);
    float revealFront = clamp(uRevealProgress, 0.0, 1.0) * 1.16;
    float edgeWidth = mix(0.012, 0.09, uRevealEdgeWidth);
    float revealMask = smoothstep(
      distanceField + turbulence - edgeWidth,
      distanceField + turbulence + edgeWidth,
      revealFront
    );
    revealMask *= smoothstep(0.001, 0.035, uRevealProgress);
    if (hash12(gl_FragCoord.xy) > revealMask) discard;

    vec3 color = mix(texture2D(uBaseMedia, vUv).rgb, texture2D(uMedia, vUv).rgb, uMediaBlend);
    gl_FragColor = vec4(color, uContentOpacity);
    #include <colorspace_fragment>
  }
`;


type ScreenRuntime = {
  id: BakedScreenId;
  sectionId: BakedExhibitionSectionId;
  screen: THREE.Object3D;
  material: THREE.ShaderMaterial;
  overlays: THREE.Mesh[];
  liveTexture: THREE.CanvasTexture | null;
  liveCanvas: HTMLCanvasElement | null;
  liveRevision: number;
  handoffTexture: THREE.CanvasTexture | null;
  handoffStartedAt: number;
  introducedAt: number | null;
};

const screenPhases = {
  interactive: "engagement",
  game: "experiences",
  main: "connection",
  videoWall: "reveal",
} as const;

function canIntroduce(runtime: ScreenRuntime) {
  const phase = heroTimeline.phases.find((item) => item.id === screenPhases[runtime.id])!;
  return experienceState.progress >= phase.start && experienceState.progress <= phase.end;
}

function canvasTexture(canvas: HTMLCanvasElement) {
  const texture = prepareBakedTexture(new THREE.CanvasTexture(canvas)) as THREE.CanvasTexture;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

function getSectionReveal(id: BakedExhibitionSectionId) {
  const production = experienceState.stage.production;
  return id === "central" ? production.centralReveal
    : id === "left" ? production.leftReveal : production.rightReveal;
}

/** An overlay preserves the GLB material underneath, including during first arrival. */
export function BakedScreenController({ root }: { root: THREE.Object3D }) {
  const runtimesRef = useRef<ScreenRuntime[]>([]);
  const reducedRef = useRef(false);

  useEffect(() => {
    root.updateMatrixWorld(true);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => { reducedRef.current = motion.matches; };
    updateMotion();
    motion.addEventListener("change", updateMotion);
    const fallback = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    fallback.needsUpdate = true;
    const result: ScreenRuntime[] = [];
    (Object.keys(bakedSceneContract.exhibition.screens) as BakedScreenId[]).forEach((id) => {
      const screen = root.getObjectByName(bakedSceneContract.exhibition.screens[id]);
      if (!screen) return;
      const sectionId = bakedSceneContract.exhibition.screenSections[id];
      const contract = bakedSceneContract.exhibition.sections[sectionId];
      const sectionRoot = root.getObjectByName(contract.root) ?? root;
      const origin = getRevealOrigin(sectionRoot, root.getObjectByName(contract.revealAnchor));
      const material = new THREE.ShaderMaterial({
        name: `MAT_SCREEN_${id.toUpperCase()}`,
        uniforms: {
          uMedia: { value: fallback },
          uBaseMedia: { value: fallback },
          uMediaBlend: { value: 1 },
          uContentOpacity: { value: 0 },
          uTime: { value: 0 },
          uRevealProgress: { value: 0 },
          uRevealOrigin: { value: origin },
          uRevealExtent: { value: getRevealExtent(sectionRoot, origin) },
          uRevealEdgeWidth: { value: 0.42 },
          uRevealTurbulence: { value: 0.4 },
        },
        vertexShader,
        fragmentShader,
        toneMapped: false,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      result.push({
        id, sectionId, screen, material, overlays: [],
        liveTexture: null, liveCanvas: null, liveRevision: 0,
        handoffTexture: null, handoffStartedAt: 0, introducedAt: null,
      });
    });
    runtimesRef.current = result;
    return () => {
      motion.removeEventListener("change", updateMotion);
      runtimesRef.current = [];
      result.forEach((runtime) => {
        runtime.overlays.forEach((mesh) => mesh.removeFromParent());
        runtime.liveTexture?.dispose();
        runtime.handoffTexture?.dispose();
        runtime.material.dispose();
      });
      fallback.dispose();
    };
  }, [root]);

  useFrame(({ clock }) => {
    const now = clock.elapsedTime;
    const production = experienceState.stage.production;
    runtimesRef.current.forEach((runtime) => {
      const savedWall = runtime.id === "main" ? getVisitorCreation().drawingWall : null;
      const ambient = runtime.id === "game" ? interactionRuntime.ambientGameSurface : null;
      const entry = interactionRuntime.monitorEntries[runtime.id]
        ?? ambient ?? (savedWall ? { canvas: savedWall, revision: 0 } : null);
      // A registered canvas can exist before its phase (the scroll stage does).
      // It must not replace the authored idle material until actual arrival.
      const ready = entry && (runtime.introducedAt !== null || canIntroduce(runtime))
        && (runtime.id !== "videoWall" || runtime.introducedAt !== null || ("blend" in entry ? entry.blend ?? 1 : 1) > 0.001);
      if (ready && entry.canvas !== runtime.liveCanvas) {
        // Snapshot the outgoing surface. Its owner may continue painting or
        // unmount during the crossfade; the transition still has a stable source.
        runtime.handoffTexture?.dispose();
        runtime.handoffTexture = null;
        if (runtime.liveCanvas) {
          const snapshot = document.createElement("canvas");
          snapshot.width = runtime.liveCanvas.width;
          snapshot.height = runtime.liveCanvas.height;
          snapshot.getContext("2d")?.drawImage(runtime.liveCanvas, 0, 0);
          runtime.handoffTexture = canvasTexture(snapshot);
        }
        runtime.liveTexture?.dispose();
        runtime.liveCanvas = entry.canvas;
        runtime.liveRevision = entry.revision;
        runtime.liveTexture = canvasTexture(entry.canvas);
        runtime.handoffStartedAt = now;
        runtime.material.uniforms.uMedia.value = runtime.liveTexture;
        runtime.material.uniforms.uBaseMedia.value = runtime.handoffTexture ?? runtime.liveTexture;
        if (runtime.introducedAt === null) {
          runtime.introducedAt = now;
          const originals: THREE.Mesh[] = [];
          runtime.screen.traverse((object) => { if (object instanceof THREE.Mesh) originals.push(object); });
          originals.forEach((original) => {
            const overlay = new THREE.Mesh(original.geometry, runtime.material);
            overlay.name = `fxScreen_dynamic_${runtime.id}`;
            overlay.raycast = () => {};
            original.add(overlay);
            runtime.overlays.push(overlay);
          });
        }
      }
      if (ready && entry.canvas === runtime.liveCanvas && runtime.liveTexture
        && entry.revision !== runtime.liveRevision) {
        runtime.liveRevision = entry.revision;
        runtime.liveTexture.needsUpdate = true;
      }
      // Unregistering a producer deliberately leaves its last painted surface
      // on the monitor. Only scene disposal releases that retained texture.
      const fade = reducedRef.current ? 1 : Math.min(1, Math.max(0, (now - (runtime.introducedAt ?? now)) / 0.7));
      const handoff = reducedRef.current ? 1 : Math.min(1, (now - runtime.handoffStartedAt) / 0.6);
      runtime.material.uniforms.uContentOpacity.value = fade * fade * (3 - 2 * fade);
      runtime.material.uniforms.uMediaBlend.value = handoff * handoff * (3 - 2 * handoff);
      runtime.material.uniforms.uTime.value = now;
      runtime.material.uniforms.uRevealProgress.value = getSectionReveal(runtime.sectionId);
      runtime.material.uniforms.uRevealEdgeWidth.value = production.revealEdgeWidth;
      runtime.material.uniforms.uRevealTurbulence.value = production.revealTurbulence;
      if (runtime.handoffTexture && handoff >= 1) {
        runtime.material.uniforms.uBaseMedia.value = runtime.liveTexture;
        runtime.handoffTexture.dispose();
        runtime.handoffTexture = null;
      }
    });
  });

  return null;
}
