"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  bakedSceneContract,
  type BakedExhibitionSectionId,
  type BakedScreenId,
} from "./baked-scene-contract";
import {
  bindRuntimeMaterial,
  restoreRuntimeMaterial,
  type RuntimeMaterialBinding,
} from "./baked-material-binding";
import { getRevealExtent, getRevealOrigin } from "./baked-reveal-geometry";
import { prepareBakedTexture } from "./baked-scene-material";
import { experienceState } from "./experience-state";
import type { SceneProject } from "./MandegarModel";
import { sceneTokens } from "./scene-config";

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
  uniform float uActivation;
  uniform float uHasMedia;
  uniform float uTime;
  uniform float uOffset;
  uniform float uRevealProgress;
  uniform vec3 uRevealOrigin;
  uniform float uRevealExtent;
  uniform float uRevealEdgeWidth;
  uniform float uRevealTurbulence;
  uniform vec3 uEdgeColor;
  uniform float uEdgeStrength;
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

    float activation = smoothstep(0.0, 1.0, uActivation);
    vec3 offColor = vec3(0.0025, 0.002, 0.0018);
    vec3 fallbackColor = mix(
      vec3(0.008, 0.012, 0.02),
      vec3(0.035, 0.15, 0.28),
      smoothstep(0.0, 1.0, vUv.x + vUv.y * 0.28)
    );
    vec3 mediaColor = texture2D(uMedia, vUv).rgb;
    vec3 poweredColor = mix(fallbackColor, mediaColor, uHasMedia);
    float scan = smoothstep(
      0.0,
      0.06,
      1.0 - abs(fract(vUv.y * 2.0 - uTime * 0.08 - uOffset) * 2.0 - 1.0)
    );
    poweredColor += vec3(0.32, 0.78, 1.0) * scan * 0.018;
    float startup = smoothstep(0.0, 0.08, activation)
      * smoothstep(0.0, 0.2, 1.0 - abs(vUv.y - 0.5) / max(0.015, activation));
    vec3 color = mix(offColor, poweredColor, max(startup, activation));
    float edge = 1.0 - smoothstep(
      edgeWidth * 0.25,
      edgeWidth * 1.45,
      abs(revealFront - distanceField - turbulence)
    );
    edge *= smoothstep(0.01, 0.08, uRevealProgress)
      * (1.0 - smoothstep(0.9, 1.0, uRevealProgress));
    color += uEdgeColor * edge * uEdgeStrength;
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

type ScreenRuntime = {
  id: BakedScreenId;
  sectionId: BakedExhibitionSectionId;
  material: THREE.ShaderMaterial;
  media: THREE.Texture;
  video: HTMLVideoElement | null;
  bindings: RuntimeMaterialBinding[];
};

function createFallbackTexture() {
  const data = new Uint8Array([2, 3, 5, 255]);
  const texture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function getActivation(id: BakedScreenId) {
  const production = experienceState.stage.production;
  if (id === "videoWall") return production.videoWallScreen;
  if (id === "interactive") return production.interactiveScreen;
  if (id === "game") return production.gameScreen;
  return production.mainScreen;
}

function getSectionReveal(id: BakedExhibitionSectionId) {
  const production = experienceState.stage.production;
  if (id === "central") return production.centralReveal;
  if (id === "left") return production.leftReveal;
  return production.rightReveal;
}

function getScreenSources(projects: SceneProject[]) {
  return {
    videoWall: sceneTokens.bakedScene.screens.videoWall || projects[0]?.src || "",
    interactive: sceneTokens.bakedScene.screens.interactive || projects[1]?.src || projects[0]?.src || "",
    game: sceneTokens.bakedScene.screens.game || projects[2]?.src || projects[0]?.src || "",
    main: sceneTokens.bakedScene.screens.main || projects[0]?.src || "",
  } satisfies Record<BakedScreenId, string>;
}

export function BakedScreenController({
  root,
  projects,
}: {
  root: THREE.Object3D;
  projects: SceneProject[];
}) {
  const runtimesRef = useRef<Record<BakedScreenId, ScreenRuntime> | null>(null);

  useEffect(() => {
    let active = true;
    root.updateMatrixWorld(true);
    const result = {} as Record<BakedScreenId, ScreenRuntime>;
    (Object.keys(bakedSceneContract.exhibition.screens) as BakedScreenId[]).forEach((id, index) => {
      const media = createFallbackTexture();
      const sectionId = bakedSceneContract.exhibition.screenSections[id];
      const sectionContract = bakedSceneContract.exhibition.sections[sectionId];
      const sectionRoot = root.getObjectByName(sectionContract.root) ?? root;
      const revealOrigin = getRevealOrigin(
        sectionRoot,
        root.getObjectByName(sectionContract.revealAnchor),
      );
      const material = new THREE.ShaderMaterial({
        name: `MAT_SCREEN_${id.toUpperCase()}`,
        uniforms: {
          uMedia: { value: media },
          uActivation: { value: 0 },
          uHasMedia: { value: 0 },
          uTime: { value: 0 },
          uOffset: { value: index * 0.23 },
          uRevealProgress: { value: 0 },
          uRevealOrigin: { value: revealOrigin },
          uRevealExtent: { value: getRevealExtent(sectionRoot, revealOrigin) },
          uRevealEdgeWidth: { value: 0.42 },
          uRevealTurbulence: { value: 0.4 },
          uEdgeColor: {
            value: new THREE.Color(sceneTokens.bakedScene.material.edgeColor),
          },
          uEdgeStrength: { value: sceneTokens.bakedScene.material.edgeStrength },
        },
        vertexShader,
        fragmentShader,
        toneMapped: false,
        depthTest: true,
        depthWrite: true,
      });
      const object = root.getObjectByName(bakedSceneContract.exhibition.screens[id]);
      result[id] = {
        id,
        sectionId,
        material,
        media,
        video: null,
        bindings: object ? bindRuntimeMaterial(object, material) : [],
      };
    });
    runtimesRef.current = result;

    const sources = getScreenSources(projects);
    const loader = new THREE.TextureLoader();
    (Object.keys(result) as BakedScreenId[]).forEach((id) => {
      const source = sources[id];
      if (!source) return;
      const isVideo = /\.(mp4|webm|ogv)(\?.*)?$/i.test(source);
      if (isVideo) {
        const video = document.createElement("video");
        video.src = source;
        video.crossOrigin = "anonymous";
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.preload = "metadata";
        const texture = prepareBakedTexture(new THREE.VideoTexture(video));
        texture.generateMipmaps = false;
        texture.minFilter = THREE.LinearFilter;
        result[id].media.dispose();
        result[id].media = texture;
        result[id].video = video;
        result[id].material.uniforms.uMedia.value = texture;
        result[id].material.uniforms.uHasMedia.value = 1;
        return;
      }
      loader.load(
        source,
        (texture) => {
          if (!active) {
            texture.dispose();
            return;
          }
          prepareBakedTexture(texture);
          result[id].media.dispose();
          result[id].media = texture;
          result[id].material.uniforms.uMedia.value = texture;
          result[id].material.uniforms.uHasMedia.value = 1;
        },
        undefined,
        () => {
          if (active && process.env.NODE_ENV !== "production") {
            console.warn(`[Mandegar] Screen media could not be loaded: ${source}`);
          }
        },
      );
    });

    return () => {
      active = false;
      if (runtimesRef.current === result) {
        runtimesRef.current = null;
      }

      (Object.values(result) as ScreenRuntime[]).forEach((runtime) => {
        if (runtime.video) {
          runtime.video.pause();
          runtime.video.removeAttribute("src");
          runtime.video.load();
        }
        restoreRuntimeMaterial(runtime.bindings, runtime.material);
        runtime.media.dispose();
        runtime.material.dispose();
      });
    };
  }, [projects, root]);

  useFrame(({ clock }) => {
    const runtimes = runtimesRef.current;
    if (!runtimes) {
      return;
    }

    (Object.values(runtimes) as ScreenRuntime[]).forEach((runtime) => {
      const activation = getActivation(runtime.id);
      const production = experienceState.stage.production;
      runtime.material.uniforms.uActivation.value = activation;
      runtime.material.uniforms.uTime.value = clock.elapsedTime;
      runtime.material.uniforms.uRevealProgress.value = getSectionReveal(runtime.sectionId);
      runtime.material.uniforms.uRevealEdgeWidth.value = production.revealEdgeWidth;
      runtime.material.uniforms.uRevealTurbulence.value = production.revealTurbulence;
      if (!runtime.video) return;
      if (activation > 0.04 && runtime.video.paused) {
        void runtime.video.play().catch(() => undefined);
      } else if (activation <= 0.01 && !runtime.video.paused) {
        runtime.video.pause();
      }
    });
  });

  return null;
}
