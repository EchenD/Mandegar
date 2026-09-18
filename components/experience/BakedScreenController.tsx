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
import type { SceneProject } from "./experience-types";
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
  uniform float uHover;
  uniform float uHoverBrightness;
  uniform float uHasMedia;
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

    float activation = smoothstep(0.0, 1.0, uActivation);
    vec3 offColor = vec3(0.032, 0.026, 0.022);
    vec3 fallbackColor = mix(
      vec3(0.008, 0.012, 0.02),
      vec3(0.035, 0.15, 0.28),
      smoothstep(0.0, 1.0, vUv.x + vUv.y * 0.28)
    );
    vec3 mediaColor = texture2D(uMedia, vUv).rgb;
    vec3 poweredColor = mix(fallbackColor, mediaColor, uHasMedia);
    vec3 color = mix(offColor, poweredColor, activation);
    vec3 hoverColor = color * (1.0 + uHoverBrightness)
      + vec3(uHoverBrightness * 0.045);
    color = mix(color, hoverColor, smoothstep(0.0, 1.0, uHover));
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
  hoverLabel: THREE.Sprite;
  hoverLabelMaterial: THREE.SpriteMaterial;
  hoverLabelTexture: THREE.CanvasTexture;
};

function createFallbackTexture() {
  const data = new Uint8Array([2, 3, 5, 255]);
  const texture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createHoverLabelTexture(color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = color;
    context.font = "700 62px Arial, sans-serif";
    context.letterSpacing = "10px";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(sceneTokens.bakedScene.screenHover.label, 486, 116);
    context.globalAlpha = 0.72;
    context.fillRect(286, 184, 400, 3);
    context.beginPath();
    context.moveTo(713, 184);
    context.lineTo(685, 170);
    context.lineTo(685, 198);
    context.closePath();
    context.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function createHoverLabel(
  root: THREE.Object3D,
  object: THREE.Object3D | null | undefined,
  id: BakedScreenId,
) {
  const darkMediaScreens = sceneTokens.bakedScene.screenHover.darkMediaScreens as readonly BakedScreenId[];
  const color = darkMediaScreens.includes(id)
    ? sceneTokens.bakedScene.screenHover.lightText
    : sceneTokens.bakedScene.screenHover.darkText;
  const texture = createHoverLabelTexture(color);
  const material = new THREE.SpriteMaterial({
    map: texture,
    opacity: 0,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.name = `fxLabel_screen_${id}`;
  sprite.visible = false;
  sprite.renderOrder = 100;
  sprite.frustumCulled = false;
  sprite.raycast = () => {};

  if (object) {
    root.updateMatrixWorld(true);
    object.updateWorldMatrix(true, false);
    const bounds = new THREE.Box3().setFromObject(object);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const width = THREE.MathUtils.clamp(Math.max(size.x, size.z) * 0.34, 0.82, 2.8);
    root.worldToLocal(center);
    sprite.position.copy(center);
    sprite.scale.set(width, width * 0.25, 1);
  }
  root.add(sprite);
  return { material, sprite, texture };
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
    (Object.keys(bakedSceneContract.exhibition.screens) as BakedScreenId[]).forEach((id) => {
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
          uHover: { value: 0 },
          uHoverBrightness: { value: sceneTokens.bakedScene.screenHover.brightness },
          uHasMedia: { value: 0 },
          uTime: { value: 0 },
          uRevealProgress: { value: 0 },
          uRevealOrigin: { value: revealOrigin },
          uRevealExtent: { value: getRevealExtent(sectionRoot, revealOrigin) },
          uRevealEdgeWidth: { value: 0.42 },
          uRevealTurbulence: { value: 0.4 },
        },
        vertexShader,
        fragmentShader,
        toneMapped: false,
        depthTest: true,
        depthWrite: true,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      const object = root.getObjectByName(bakedSceneContract.exhibition.screens[id]);
      const hoverLabel = createHoverLabel(root, object, id);
      result[id] = {
        id,
        sectionId,
        material,
        media,
        video: null,
        bindings: object ? bindRuntimeMaterial(object, material) : [],
        hoverLabel: hoverLabel.sprite,
        hoverLabelMaterial: hoverLabel.material,
        hoverLabelTexture: hoverLabel.texture,
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
        root.remove(runtime.hoverLabel);
        runtime.hoverLabelTexture.dispose();
        runtime.hoverLabelMaterial.dispose();
        runtime.media.dispose();
        runtime.material.dispose();
      });
    };
  }, [projects, root]);

  useFrame(({ clock }, delta) => {
    const runtimes = runtimesRef.current;
    if (!runtimes) {
      return;
    }

    (Object.values(runtimes) as ScreenRuntime[]).forEach((runtime) => {
      const activation = getActivation(runtime.id);
      const production = experienceState.stage.production;
      const hoverTarget = experienceState.focusScreen === runtime.id && activation > 0.08 ? 1 : 0;
      const hoverBlend = 1 - Math.exp(-delta * (hoverTarget > runtime.material.uniforms.uHover.value ? 11 : 7));
      const hover = THREE.MathUtils.lerp(
        runtime.material.uniforms.uHover.value,
        hoverTarget,
        hoverBlend,
      );
      runtime.material.uniforms.uActivation.value = activation;
      runtime.material.uniforms.uHover.value = hover;
      runtime.material.uniforms.uTime.value = clock.elapsedTime;
      runtime.material.uniforms.uRevealProgress.value = getSectionReveal(runtime.sectionId);
      runtime.material.uniforms.uRevealEdgeWidth.value = production.revealEdgeWidth;
      runtime.material.uniforms.uRevealTurbulence.value = production.revealTurbulence;
      runtime.hoverLabelMaterial.opacity = hover;
      runtime.hoverLabel.visible = hover > 0.002;
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
