"use client";

import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";

export type PartnerFinaleBridge = {
  progress: number;
  ready: boolean;
  invalidate?: () => void;
  onReady?: () => void;
};

export type PartnerFinaleMedia = {
  src: string;
  label: string;
  kind?: "image" | "video" | "video-placeholder";
  poster?: string;
};

type MosaicSlot = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type PlaneLayout = {
  index: number;
  center: boolean;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  media: PartnerFinaleMedia | null;
  video: boolean;
};

const cameraFov = 54;
const centralPlaneZ = 4;
const mosaicCameraZ = 72;
const logoGateZ = 88;
const finalCameraZ = 112;
const logoAspect = 1800 / 1030;

const desktopRowWeights = [
  [12, 15, 13, 18, 13, 15, 14],
  [15, 12, 16, 14, 15, 13, 15],
  [13, 14, 15, 16, 15, 14, 13],
  [14, 16, 12, 15, 14, 16, 13],
  [16, 12, 15, 14, 16, 13, 14],
];
const desktopRowHeights = [.18, .21, .22, .21, .18];

const desktopSlots: MosaicSlot[] = desktopRowWeights.flatMap((weights, row) => {
  const total = weights.reduce((sum, value) => sum + value, 0);
  let x = 0;
  const y = desktopRowHeights.slice(0, row).reduce((sum, value) => sum + value, 0);
  return weights.map((weight) => {
    const width = weight / total;
    const slot = { x, y, width, height: desktopRowHeights[row] };
    x += width;
    return slot;
  });
});

const mobileSlots: MosaicSlot[] = Array.from({ length: 15 }, (_, index) => ({
  x: (index % 3) / 3,
  y: Math.floor(index / 3) / 5,
  width: 1 / 3,
  height: 1 / 5,
}));

const mediaVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const mediaFragmentShader = `
  uniform sampler2D uMap;
  uniform float uImageAspect;
  uniform float uPlaneAspect;
  varying vec2 vUv;
  void main() {
    vec2 coverUv = vUv;
    if (uImageAspect > uPlaneAspect) {
      float sampleWidth = uPlaneAspect / uImageAspect;
      coverUv.x = (coverUv.x - 0.5) * sampleWidth + 0.5;
    } else {
      float sampleHeight = uImageAspect / uPlaneAspect;
      coverUv.y = (coverUv.y - 0.5) * sampleHeight + 0.5;
    }
    gl_FragColor = texture2D(uMap, coverUv);
  }
`;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(value: number) {
  const safe = clamp01(value);
  return safe * safe * (3 - 2 * safe);
}

function isVideoMedia(media: PartnerFinaleMedia) {
  return media.kind === "video" || /\.(mp4|webm|mov)(?:$|\?)/i.test(media.src);
}

function visibleFrame(distance: number, aspect: number) {
  const height = 2 * Math.tan(THREE.MathUtils.degToRad(cameraFov * .5)) * distance;
  return { width: height * aspect, height };
}

function getCameraZ(progress: number) {
  if (progress <= .12) return THREE.MathUtils.lerp(0, 5, smoothstep(progress / .12));
  if (progress <= .74) return THREE.MathUtils.lerp(5, mosaicCameraZ, smoothstep((progress - .12) / .62));
  if (progress <= .97) {
    return THREE.MathUtils.lerp(mosaicCameraZ, finalCameraZ, smoothstep((progress - .74) / .23));
  }
  return finalCameraZ;
}

function placePlane(group: THREE.Group, layout: PlaneLayout) {
  group.position.set(layout.x, layout.y, layout.z);
  group.rotation.set(0, 0, 0);
  group.scale.set(layout.width, layout.height, 1);
  return layout.width / Math.max(.001, layout.height);
}

function ImagePlane({
  layout,
  planeGeometry,
  bridge,
}: {
  layout: PlaneLayout;
  planeGeometry: THREE.PlaneGeometry;
  bridge: MutableRefObject<PartnerFinaleBridge>;
}) {
  const group = useRef<THREE.Group>(null);
  const material = useRef<THREE.ShaderMaterial>(null);
  const invalidate = useThree((state) => state.invalidate);
  const sourceTexture = useLoader(THREE.TextureLoader, layout.media!.src);
  const texture = useMemo(() => {
    const clone = sourceTexture.clone();
    clone.colorSpace = THREE.SRGBColorSpace;
    clone.generateMipmaps = true;
    clone.minFilter = THREE.LinearMipmapLinearFilter;
    clone.magFilter = THREE.LinearFilter;
    clone.needsUpdate = true;
    return clone;
  }, [sourceTexture]);
  const image = sourceTexture.image as { width?: number; height?: number } | undefined;
  const uniforms = useMemo(() => ({
    uMap: { value: texture },
    uImageAspect: { value: (image?.width || 1) / Math.max(1, image?.height || 1) },
    uPlaneAspect: { value: layout.width / layout.height },
  }), [image?.height, image?.width, layout.height, layout.width, texture]);

  useEffect(() => {
    invalidate();
    const readyFrame = layout.center ? requestAnimationFrame(() => {
      if (bridge.current.ready) return;
      bridge.current.ready = true;
      bridge.current.onReady?.();
    }) : 0;
    return () => {
      if (readyFrame) cancelAnimationFrame(readyFrame);
      texture.dispose();
    };
  }, [bridge, invalidate, layout.center, texture]);

  useFrame(() => {
    if (!group.current || !material.current) return;
    const progress = clamp01(bridge.current.progress);
    group.current.visible = progress > 0;
    material.current.uniforms.uPlaneAspect.value = placePlane(group.current, layout);
  });

  return (
    <group ref={group} visible={false}>
      <mesh geometry={planeGeometry}>
        <shaderMaterial
          ref={material}
          toneMapped={false}
          uniforms={uniforms}
          vertexShader={mediaVertexShader}
          fragmentShader={mediaFragmentShader}
        />
      </mesh>
    </group>
  );
}

function VideoPlane({
  layout,
  planeGeometry,
  bridge,
}: {
  layout: PlaneLayout;
  planeGeometry: THREE.PlaneGeometry;
  bridge: MutableRefObject<PartnerFinaleBridge>;
}) {
  const group = useRef<THREE.Group>(null);
  const material = useRef<THREE.ShaderMaterial>(null);
  const invalidate = useThree((state) => state.invalidate);
  const playing = useRef(false);
  const ready = useRef(false);
  const frameHandle = useRef<number | null>(null);
  const fallbackFrame = useRef<number | null>(null);
  const startPlayback = useRef<() => void>(() => undefined);
  const stopPlayback = useRef<() => void>(() => undefined);
  const media = useMemo(() => {
    const video = document.createElement("video");
    video.src = layout.media!.src;
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";
    if (layout.media?.poster) video.poster = layout.media.poster;
    const texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return { video, texture };
  }, [layout.media]);
  const uniforms = useMemo(() => ({
    uMap: { value: media.texture },
    uImageAspect: { value: 16 / 9 },
    uPlaneAspect: { value: layout.width / layout.height },
  }), [layout.height, layout.width, media.texture]);

  useEffect(() => {
    const video = media.video;
    const configure = () => {
      if (material.current) {
        material.current.uniforms.uImageAspect.value = video.videoWidth / Math.max(1, video.videoHeight);
      }
      invalidate();
    };
    const markReady = () => {
      ready.current = true;
      invalidate();
    };
    video.addEventListener("loadedmetadata", configure);
    video.addEventListener("loadeddata", markReady);
    configure();
    if (video.readyState >= 2) markReady();

    return () => {
      video.removeEventListener("loadedmetadata", configure);
      video.removeEventListener("loadeddata", markReady);
      video.pause();
      video.removeAttribute("src");
      video.load();
      media.texture.dispose();
    };
  }, [invalidate, media]);

  useEffect(() => {
    const video = media.video;
    const requestNextFrame = () => {
      if (!playing.current) return;
      if ("requestVideoFrameCallback" in video) {
        frameHandle.current = video.requestVideoFrameCallback(() => {
          invalidate();
          requestNextFrame();
        });
      } else {
        fallbackFrame.current = requestAnimationFrame(() => {
          invalidate();
          requestNextFrame();
        });
      }
    };
    const start = () => {
      if (playing.current) return;
      playing.current = true;
      void video.play().then(requestNextFrame).catch(() => {
        playing.current = false;
      });
    };
    const stop = () => {
      if (!playing.current) return;
      playing.current = false;
      video.pause();
      if (frameHandle.current !== null && "cancelVideoFrameCallback" in video) {
        video.cancelVideoFrameCallback(frameHandle.current);
        frameHandle.current = null;
      }
      if (fallbackFrame.current !== null) {
        cancelAnimationFrame(fallbackFrame.current);
        fallbackFrame.current = null;
      }
    };
    startPlayback.current = start;
    stopPlayback.current = stop;

    const syncPlayback = () => {
      const active = bridge.current.progress > .08
        && bridge.current.progress < .98
        && document.visibilityState === "visible";
      if (active) start();
      else stop();
    };
    syncPlayback();
    const visibility = () => {
      syncPlayback();
      invalidate();
    };
    document.addEventListener("visibilitychange", visibility);

    return () => {
      document.removeEventListener("visibilitychange", visibility);
      stop();
      startPlayback.current = () => undefined;
      stopPlayback.current = () => undefined;
    };
  }, [bridge, invalidate, media.video]);

  useFrame(() => {
    if (group.current && material.current) {
      const progress = clamp01(bridge.current.progress);
      group.current.visible = ready.current && progress > 0;
      material.current.uniforms.uPlaneAspect.value = placePlane(group.current, layout);
    }
    const active = bridge.current.progress > .08
      && bridge.current.progress < .98
      && document.visibilityState === "visible";
    if (active) startPlayback.current();
    else stopPlayback.current();
  });

  return (
    <group ref={group} visible={false}>
      <mesh geometry={planeGeometry}>
        <shaderMaterial
          ref={material}
          toneMapped={false}
          uniforms={uniforms}
          vertexShader={mediaVertexShader}
          fragmentShader={mediaFragmentShader}
        />
      </mesh>
    </group>
  );
}

function LogoGate({
  logoSrc,
  mobile,
  aspect,
  bridge,
}: {
  logoSrc: string;
  mobile: boolean;
  aspect: number;
  bridge: MutableRefObject<PartnerFinaleBridge>;
}) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const sourceTexture = useLoader(THREE.TextureLoader, logoSrc);
  const maskTexture = useMemo(() => {
    const image = sourceTexture.image as HTMLImageElement;
    const sourceWidth = image.naturalWidth || image.width || 900;
    const sourceHeight = image.naturalHeight || image.height || 515;
    const width = Math.min(900, sourceWidth);
    const height = Math.max(1, Math.round(width * sourceHeight / sourceWidth));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return sourceTexture;

    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height);
    for (let offset = 0; offset < pixels.data.length; offset += 4) {
      pixels.data[offset] = 255;
      pixels.data[offset + 1] = 255;
      pixels.data[offset + 2] = 255;
    }
    context.putImageData(pixels, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.NoColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }, [sourceTexture]);
  const finalDistance = finalCameraZ - logoGateZ;
  const frame = visibleFrame(finalDistance, aspect);
  const cover = 1.22;
  const targetLogoWidth = mobile ? .42 : .24;
  const logoWidth = targetLogoWidth / cover;
  const logoHeight = targetLogoWidth * aspect / logoAspect / cover;
  const uniforms = useMemo(() => ({
    uMask: { value: maskTexture },
    uMaskScale: { value: new THREE.Vector2(logoWidth, logoHeight) },
    uBackground: { value: new THREE.Color("#f5f4ef") },
    uAccent: { value: new THREE.Color("#0a3ca9") },
    uFill: { value: 0 },
  }), [logoHeight, logoWidth, maskTexture]);

  useEffect(() => () => {
    if (maskTexture !== sourceTexture) maskTexture.dispose();
  }, [maskTexture, sourceTexture]);

  useFrame(() => {
    if (!material.current) return;
    material.current.uniforms.uFill.value = smoothstep((bridge.current.progress - .94) / .055);
  });

  return (
    <mesh
      position={[0, 0, logoGateZ]}
      scale={[frame.width * cover, frame.height * cover, 1]}
      renderOrder={1000}
    >
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={material}
        transparent
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
        uniforms={uniforms}
        vertexShader={mediaVertexShader}
        fragmentShader={`
          uniform sampler2D uMask;
          uniform vec2 uMaskScale;
          uniform vec3 uBackground;
          uniform vec3 uAccent;
          uniform float uFill;
          varying vec2 vUv;
          void main() {
            vec2 maskUv = (vUv - 0.5) / uMaskScale + 0.5;
            float mark = 0.0;
            if (maskUv.x >= 0.0 && maskUv.x <= 1.0 && maskUv.y >= 0.0 && maskUv.y <= 1.0) {
              mark = texture2D(uMask, maskUv).a;
            }
            float edge = max(fwidth(mark) * 1.35, 0.018);
            float opening = smoothstep(0.5 - edge, 0.5 + edge, mark);
            float backgroundAlpha = 1.0 - opening;
            float logoAlpha = opening * uFill;
            float alpha = backgroundAlpha + logoAlpha;
            vec3 color = (
              uBackground * backgroundAlpha
              + uAccent * logoAlpha
            ) / max(alpha, 0.001);
            gl_FragColor = vec4(color, alpha);
          }
        `}
      />
    </mesh>
  );
}

function PartnerFinaleWorld({
  bridge,
  media,
  logoSrc,
  mobile,
}: {
  bridge: MutableRefObject<PartnerFinaleBridge>;
  media: PartnerFinaleMedia[];
  logoSrc: string;
  mobile: boolean;
}) {
  const { camera, invalidate, size } = useThree();
  const planeGeometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const layouts = useMemo(() => {
    const slots = mobile ? mobileSlots : desktopSlots;
    const centerIndex = mobile ? 7 : 17;
    const aspect = size.width / Math.max(1, size.height);
    // The planes never travel through one another. They occupy fixed depth lanes,
    // sized so their projections resolve into a full mosaic at the logo gate.
    const overscan = 1.006;
    const images = media.filter((item) => !isVideoMedia(item)).slice(0, mobile ? 5 : 8);
    const video = mobile ? undefined : media.find(isVideoMedia);
    const fallbackMedia = images.length ? images : media;
    const videoSlot = Math.min(slots.length - 1, centerIndex + 1);

    return slots.map((slot, index) => {
      const center = index === centerIndex;
      const normalizedX = slot.x + slot.width * .5 - .5;
      const normalizedY = .5 - slot.y - slot.height * .5;
      const radialDistance = Math.min(1, Math.hypot(normalizedX * 1.65, normalizedY * 1.65));
      const lane = Math.max(1, Math.min(6, Math.ceil(radialDistance * 6)));
      const z = center
        ? centralPlaneZ
        : 12 + lane * (mobile ? 6.5 : 7.5) + ((index % 3) - 1) * .3;
      const projectedFrame = visibleFrame(logoGateZ - z, aspect);
      const width = projectedFrame.width * slot.width * overscan;
      const height = projectedFrame.height * slot.height * overscan;
      const mediaItem = center
        ? fallbackMedia[0] || null
        : index === videoSlot && video
          ? video
          : fallbackMedia.length
            ? fallbackMedia[(index * 5 + (video ? 0 : 2)) % fallbackMedia.length]
            : null;

      return {
        index,
        center,
        x: normalizedX * projectedFrame.width * overscan,
        y: normalizedY * projectedFrame.height * overscan,
        z,
        width,
        height,
        media: mediaItem,
        video: Boolean(mediaItem && isVideoMedia(mediaItem)),
      } satisfies PlaneLayout;
    });
  }, [media, mobile, size.height, size.width]);
  const renderLayouts = useMemo(
    () => [...layouts].sort((left, right) => Number(right.center) - Number(left.center)),
    [layouts],
  );

  /* eslint-disable react-hooks/immutability -- R3F demand rendering exposes its invalidator through this external animation bridge. */
  useEffect(() => {
    const bridgeState = bridge.current;
    bridgeState.invalidate = invalidate;
    invalidate();
    return () => {
      if (bridgeState.invalidate === invalidate) bridgeState.invalidate = undefined;
      planeGeometry.dispose();
    };
  }, [bridge, invalidate, planeGeometry]);
  /* eslint-enable react-hooks/immutability */

  useFrame(() => {
    const progress = clamp01(bridge.current.progress);
    const spatialProgress = clamp01((progress - .12) / .7);
    const parallaxEnvelope = Math.sin(spatialProgress * Math.PI);
    const cameraX = parallaxEnvelope * Math.sin(spatialProgress * Math.PI * 1.1) * (mobile ? .2 : .58);
    const cameraY = parallaxEnvelope * Math.sin(spatialProgress * Math.PI * 2) * (mobile ? .1 : .26);
    camera.position.set(cameraX, cameraY, getCameraZ(progress));
    camera.rotation.set(0, 0, 0);
    camera.updateMatrixWorld();
  });

  return (
    <>
      {renderLayouts.map((layout) => layout.media ? (
        <Suspense key={`${layout.video ? "video" : "image"}-${layout.index}-${layout.media.src}`} fallback={null}>
          {layout.video ? (
            <VideoPlane
              layout={layout}
              planeGeometry={planeGeometry}
              bridge={bridge}
            />
          ) : (
            <ImagePlane
              layout={layout}
              planeGeometry={planeGeometry}
              bridge={bridge}
            />
          )}
        </Suspense>
      ) : null)}
      <Suspense fallback={null}>
        <LogoGate
          logoSrc={logoSrc}
          mobile={mobile}
          aspect={size.width / Math.max(1, size.height)}
          bridge={bridge}
        />
      </Suspense>
    </>
  );
}

export function PartnerFinaleCanvas({
  className,
  bridge,
  media,
  logoSrc,
  mobile,
}: {
  className?: string;
  bridge: MutableRefObject<PartnerFinaleBridge>;
  media: PartnerFinaleMedia[];
  logoSrc: string;
  mobile: boolean;
}) {
  return (
    <Canvas
      className={className}
      data-partner-canvas
      aria-hidden="true"
      dpr={mobile ? 1 : [1, 1.35] as [number, number]}
      frameloop="demand"
      camera={{ position: [0, 0, 0], fov: cameraFov, near: .08, far: 220 }}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMapping = THREE.NoToneMapping;
      }}
    >
      <PartnerFinaleWorld bridge={bridge} media={media} logoSrc={logoSrc} mobile={mobile} />
    </Canvas>
  );
}
