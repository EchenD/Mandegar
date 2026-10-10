"use client";

import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Component, Suspense, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode, type RefObject } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Locale } from "@/lib/i18n";
import { publicAssetPath } from "@/lib/public-asset-path";
import { getServicesColorReveal, getServicesMotionState, SERVICE_NODE_NAMES } from "./services-score";

export type ServicesSceneBridge = {
  progress: number;
  ready: boolean;
  active?: boolean;
  pointerX?: number;
  pointerY?: number;
  invalidate?: () => void;
  onReady?: (ready: boolean) => void;
  onError?: () => void;
};

type Props = {
  bridge: MutableRefObject<ServicesSceneBridge>;
  mobile: boolean;
  locale?: Locale;
};

// A new bake must replace the earlier asset in the loader's URL-based cache.
const modelPath = publicAssetPath("/models/services/mandegar-services.glb?v=studio-2");
const cameraTargetY = .85;
const cameraRadius = Math.hypot(7, 6.3 - cameraTargetY, 7);
const cameraElevation = Math.asin((6.3 - cameraTargetY) / cameraRadius);
const compactLandscapeQuery = "(max-width: 1000px) and (max-height: 500px) and (orientation: landscape)";

/** Begin the same cached load used by the canvas during the opening experience. */
export function preloadServicesScene() {
  if (typeof window !== "undefined") useLoader.preload(GLTFLoader, modelPath);
}

class ServicesSceneBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function ServicesWorld({ bridge, mobile, host, onUnlit }: Props & { host: RefObject<HTMLDivElement | null>; onUnlit: (unlit: boolean) => void }) {
  const source = useLoader(GLTFLoader, modelPath);
  const root = useRef<THREE.Group>(null);
  const placement = useRef<THREE.Group>(null);
  const { camera, gl, invalidate, scene, size } = useThree();
  const [compactLandscape, setCompactLandscape] = useState(() => typeof window !== "undefined" && window.matchMedia(compactLandscapeQuery).matches);
  const compactViewport = size.height <= 500 && (mobile || compactLandscape);
  const animation = useRef({ elapsed: 0, pointerX: 0, pointerY: 0 });
  const lifecycle = useRef({ warmed: false, warming: false, frame: 0, progress: 0, rotation: 0, breathScale: 1, pointerX: 0, pointerY: 0 });
  const contactShadow = useMemo(() => {
    const pixels = new Uint8Array(64 * 64 * 4);
    for (let y = 0; y < 64; y += 1) {
      for (let x = 0; x < 64; x += 1) {
        const radius = Math.hypot((x - 31.5) / 31.5, (y - 31.5) / 31.5);
        const alpha = Math.exp(-2.6 * radius * radius) * THREE.MathUtils.smoothstep(1 - radius, 0, .3);
        const offset = (y * 64 + x) * 4;
        pixels[offset] = 255;
        pixels[offset + 1] = 255;
        pixels[offset + 2] = 255;
        pixels[offset + 3] = Math.round(alpha * 255);
      }
    }
    const texture = new THREE.DataTexture(pixels, 64, 64);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    const geometry = new THREE.PlaneGeometry(6.8, 6);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      color: "#16191d",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -.015;
    return { mesh, geometry, material, texture };
  }, []);
  const asset = useMemo(() => {
    const scene = source.scene.clone(true);
    const platform = scene.getObjectByName("ServicesPlatform");
    const kits = SERVICE_NODE_NAMES.map((name) => scene.getObjectByName(name));
    if (!platform || kits.some((kit) => !kit)) throw new Error("The services model is missing its required platform or service groups.");

    const clippingPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.245);
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    const colorReveal = { value: 0 };
    const ink = { value: new THREE.Color("#11161c") };
    kits.forEach((kit, index) => {
      kit!.rotation.y = -index * Math.PI / 2;
    });
    const groundShadows = kits.map((kit, index) => {
      const object = kit!.getObjectByName(`${SERVICE_NODE_NAMES[index]}_GroundShadow`);
      return object ? { object, materials: [] as Array<{ material: THREE.Material; opacity: number }> } : null;
    });
    // Preserve the shadow's counterrotation, but keep its deck height independent
    // from the room's vertical assembly and the clipping applied to its props.
    scene.updateMatrixWorld(true);
    groundShadows.forEach((shadow) => { if (shadow) platform.attach(shadow.object); });
    const inside = (object: THREE.Object3D, ancestor: THREE.Object3D) => {
      let current: THREE.Object3D | null = object;
      while (current) {
        if (current === ancestor) return true;
        current = current.parent;
      }
      return false;
    };
    let unlit = true;
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = false;
      object.receiveShadow = false;
      const shadow = groundShadows.find((item) => item && inside(object, item.object));
      const inKit = kits.some((kit) => inside(object, kit!));
      const cloneMaterial = (sourceMaterial: THREE.Material) => {
        const material = sourceMaterial.clone();
        const baked = sourceMaterial instanceof THREE.MeshBasicMaterial;
        unlit = unlit && baked;
        if (baked) {
          material.toneMapped = false;
          if (!shadow) {
            material.onBeforeCompile = (shader) => {
              shader.uniforms.uServicesColorReveal = colorReveal;
              shader.uniforms.uServicesInk = ink;
              shader.fragmentShader = `uniform float uServicesColorReveal;\nuniform vec3 uServicesInk;\n${shader.fragmentShader}`
                .replace("#include <map_fragment>", "#include <map_fragment>\ndiffuseColor.rgb = mix(uServicesInk, diffuseColor.rgb, uServicesColorReveal);");
            };
            material.customProgramCacheKey = () => "services-baked-ink-reveal-v1";
          }
        }
        const map = (sourceMaterial as THREE.MeshBasicMaterial).map;
        if (map) textures.add(map);
        material.clippingPlanes = inKit && !shadow ? [clippingPlane] : [];
        material.clipShadows = false;
        if (shadow) {
          material.transparent = true;
          material.alphaTest = 0;
          material.depthWrite = false;
          material.forceSinglePass = true;
          material.polygonOffset = true;
          material.polygonOffsetFactor = -1;
          material.polygonOffsetUnits = -1;
          shadow.materials.push({ material, opacity: material.opacity });
        }
        materials.add(material);
        return material;
      };
      object.material = Array.isArray(object.material)
        ? object.material.map(cloneMaterial)
        : cloneMaterial(object.material);
    });
    const details = kits.map((kit, index) => {
      const object = kit!.getObjectByName(`${SERVICE_NODE_NAMES[index]}_Details`);
      return object ? { object, y: object.position.y } : null;
    });
    return { scene, kits: kits as THREE.Object3D[], details, groundShadows, materials, textures, unlit, colorReveal, clippingPlane };
  }, [source.scene]);

  useEffect(() => {
    const viewport = window.matchMedia(compactLandscapeQuery);
    const sync = () => setCompactLandscape(viewport.matches);
    sync();
    viewport.addEventListener("change", sync);
    return () => viewport.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    onUnlit(asset.unlit);
    host.current?.setAttribute("data-services-material-unlit", String(asset.unlit));
    host.current?.setAttribute("data-services-textures", String(asset.textures.size));
    host.current?.setAttribute("data-services-ground-shadows", String(asset.groundShadows.filter(Boolean).length));
  }, [asset, host, onUnlit]);

  useEffect(() => {
    const sceneBridge = bridge.current;
    Object.assign(sceneBridge, { invalidate });
    const orthographic = camera as THREE.OrthographicCamera;
    orthographic.position.set(7, 6.3, 7);
    orthographic.lookAt(0, cameraTargetY, 0);
    Object.assign(orthographic, {
      zoom: compactViewport
        ? Math.min(size.width * .09, size.height * .05)
        : mobile
          ? Math.min(size.width * .115, size.height * .066)
          : Math.min(size.width * .065, size.height * .082),
    });
    orthographic.updateProjectionMatrix();
    invalidate();
    return () => {
      if (sceneBridge.invalidate === invalidate) Object.assign(sceneBridge, { invalidate: undefined });
    };
  }, [bridge, camera, compactViewport, invalidate, mobile, size.height, size.width]);

  useEffect(() => {
    let disposed = false;
    let generation = 0;
    const state = lifecycle.current;
    const setReady = (ready: boolean) => {
      Object.assign(bridge.current, { ready });
      host.current?.setAttribute("data-services-ready", String(ready));
      if (ready) {
        host.current?.setAttribute("data-services-preparation", "ready");
        host.current?.setAttribute("data-services-ready-at", performance.now().toFixed(1));
      }
      bridge.current.onReady?.(ready);
    };
    const warm = async () => {
      const warmGeneration = ++generation;
      state.warmed = false;
      state.warming = true;
      host.current?.setAttribute("data-services-preparation", "shaders");
      host.current?.setAttribute("data-services-warm-started-at", performance.now().toFixed(1));
      setReady(false);
      try {
        // Batch shader preparation, then upload every kit's geometry away from
        // the visible canvas. Hidden groups otherwise wait until their first turn.
        await gl.compileAsync(scene, camera);
        if (disposed || warmGeneration !== generation || gl.getContext().isContextLost()) return;
        host.current?.setAttribute("data-services-preparation", "upload");
        const target = new THREE.WebGLRenderTarget(8, 8, { depthBuffer: true, stencilBuffer: false });
        target.texture.colorSpace = THREE.SRGBColorSpace;
        const previousTarget = gl.getRenderTarget();
        const previousRootVisible = root.current!.visible;
        const previousRootScale = root.current!.scale.clone();
        const previousRootRotation = root.current!.rotation.clone();
        const previousPlacement = placement.current!.position.clone();
        const previousKits = asset.kits.map((kit) => ({ visible: kit.visible, y: kit.position.y }));
        const previousShadows = asset.groundShadows.map((shadow) => shadow ? {
          visible: shadow.object.visible,
          opacity: shadow.materials.map(({ material }) => material.opacity),
        } : null);
        try {
          root.current!.visible = true;
          root.current!.scale.setScalar(1);
          root.current!.rotation.set(0, 0, 0);
          placement.current!.position.set(0, 0, 0);
          asset.clippingPlane.setComponents(0, 1, 0, -.245);
          asset.kits.forEach((kit) => {
            kit.visible = true;
            kit.position.y = 0;
          });
          asset.groundShadows.forEach((shadow) => {
            if (!shadow) return;
            shadow.object.visible = true;
            shadow.materials.forEach(({ material, opacity }) => { material.opacity = opacity; });
          });
          gl.setRenderTarget(target);
          gl.render(scene, camera);
        } finally {
          gl.setRenderTarget(previousTarget);
          root.current!.visible = previousRootVisible;
          root.current!.scale.copy(previousRootScale);
          root.current!.rotation.copy(previousRootRotation);
          placement.current!.position.copy(previousPlacement);
          asset.kits.forEach((kit, index) => {
            kit.visible = previousKits[index].visible;
            kit.position.y = previousKits[index].y;
          });
          asset.groundShadows.forEach((shadow, index) => {
            const previous = previousShadows[index];
            if (!shadow || !previous) return;
            shadow.object.visible = previous.visible;
            shadow.materials.forEach(({ material }, materialIndex) => { material.opacity = previous.opacity[materialIndex]; });
          });
          target.dispose();
        }
        // The warm draw includes the renderer's local-clipping shader variants.
        await gl.compileAsync(scene, camera);
        if (disposed || warmGeneration !== generation || gl.getContext().isContextLost()) return;
        state.warmed = true;
        state.warming = false;
        host.current?.setAttribute("data-services-warmed-at", performance.now().toFixed(1));
        invalidate();
      } catch {
        if (disposed || warmGeneration !== generation) return;
        state.warming = false;
        host.current?.setAttribute("data-services-preparation", "failed");
        setReady(false);
        bridge.current.onError?.();
      }
    };
    const previousAfterRender = scene.onAfterRender;
    const afterRender: typeof scene.onAfterRender = (...args) => {
      previousAfterRender.apply(scene, args);
      if (!state.warmed || state.warming || disposed) return;
      state.frame += 1;
      host.current?.setAttribute("data-services-render-progress", state.progress.toFixed(5));
      host.current?.setAttribute("data-services-rotation", state.rotation.toFixed(5));
      host.current?.setAttribute("data-services-frame", String(state.frame));
      host.current?.setAttribute("data-services-breath-scale", state.breathScale.toFixed(6));
      host.current?.setAttribute("data-services-camera-pointer-x", state.pointerX.toFixed(5));
      host.current?.setAttribute("data-services-camera-pointer-y", state.pointerY.toFixed(5));
      host.current?.setAttribute("data-services-color-reveal", asset.colorReveal.value.toFixed(5));
      if (!bridge.current.ready || host.current?.getAttribute("data-services-ready") !== "true") setReady(true);
    };
    Object.assign(scene, { onAfterRender: afterRender });
    const visibility = () => invalidate();
    const lost = (event: Event) => {
      event.preventDefault();
      generation += 1;
      state.warmed = false;
      state.warming = false;
      host.current?.setAttribute("data-services-preparation", "context-lost");
      setReady(false);
      host.current?.setAttribute("data-services-active", "false");
    };
    const restored = () => { void warm(); };
    document.addEventListener("visibilitychange", visibility);
    gl.domElement.addEventListener("webglcontextlost", lost);
    gl.domElement.addEventListener("webglcontextrestored", restored);
    void warm();
    return () => {
      disposed = true;
      generation += 1;
      state.warmed = false;
      state.warming = false;
      if (scene.onAfterRender === afterRender) Object.assign(scene, { onAfterRender: previousAfterRender });
      document.removeEventListener("visibilitychange", visibility);
      gl.domElement.removeEventListener("webglcontextlost", lost);
      gl.domElement.removeEventListener("webglcontextrestored", restored);
    };
  }, [asset, bridge, camera, gl, host, invalidate, scene]);

  useEffect(() => () => {
    asset.materials.forEach((material) => material.dispose());
    contactShadow.texture.dispose();
    contactShadow.material.dispose();
    contactShadow.geometry.dispose();
  }, [asset, contactShadow]);

  useFrame((_, delta) => {
    if (!root.current || !placement.current) return;
    const state = lifecycle.current;
    const progress = bridge.current.progress;
    const motion = getServicesMotionState(bridge.current.progress);
    const colorReveal = getServicesColorReveal(motion);
    Object.assign(asset.colorReveal, { value: colorReveal });
    const settled = motion.entry * (1 - motion.exit);
    const active = (bridge.current.active ?? (progress > .001 && progress < .999))
      && document.visibilityState === "visible" && state.warmed;
    const step = Math.min(delta, .05);
    if (active) animation.current.elapsed += step;
    const lift = Math.max(...motion.kitLift);
    const ambientWeight = settled * settled * lift ** 4;
    const phase = animation.current.elapsed * Math.PI / 3;
    const breathe = Math.sin(phase) * ambientWeight;
    const y = cameraTargetY * (1 - settled) + (compactViewport ? -.8 : mobile ? 0 : 1) * settled + breathe * .015;
    const scale = motion.scale * (1 + breathe * .004);
    const damping = 1 - Math.exp(-step * 4.5);
    const pointerX = mobile ? 0 : THREE.MathUtils.clamp(bridge.current.pointerX ?? 0, -1, 1);
    const pointerY = mobile ? 0 : THREE.MathUtils.clamp(bridge.current.pointerY ?? 0, -1, 1);
    animation.current.pointerX += (pointerX - animation.current.pointerX) * damping;
    animation.current.pointerY += (pointerY - animation.current.pointerY) * damping;
    const azimuth = Math.PI / 4 + animation.current.pointerX * .026 * ambientWeight;
    const elevation = cameraElevation + animation.current.pointerY * .018 * ambientWeight;
    const horizontal = cameraRadius * Math.cos(elevation);
    camera.position.set(horizontal * Math.sin(azimuth), cameraTargetY + cameraRadius * Math.sin(elevation), horizontal * Math.cos(azimuth));
    camera.lookAt(0, cameraTargetY, 0);
    placement.current.position.set(0, y, 0);
    root.current.rotation.y = motion.rootRotation;
    root.current.scale.setScalar(scale);
    root.current.visible = state.warmed && progress > .001 && progress < .999;
    Object.assign(contactShadow.material, { opacity: .1 * settled * settled * colorReveal });
    asset.clippingPlane.setComponents(0, 1, 0, -(.245 * scale + y));
    asset.kits.forEach((kit, index) => {
      const lift = motion.kitLift[index];
      kit.visible = lift > .001;
      kit.position.y = -3.6 * (1 - lift);
      const detail = asset.details[index];
      if (detail) detail.object.position.y = detail.y - .25 * (1 - THREE.MathUtils.smoothstep(lift, .15, 1));
      const shadow = asset.groundShadows[index];
      if (shadow) {
        const presence = THREE.MathUtils.smoothstep(lift, .15, .95) * colorReveal;
        shadow.object.visible = presence > .001;
        shadow.materials.forEach(({ material, opacity }) => { material.opacity = opacity * presence; });
      }
    });
    state.progress = progress;
    state.rotation = motion.rootRotation;
    state.breathScale = 1 + breathe * .004;
    state.pointerX = animation.current.pointerX * ambientWeight;
    state.pointerY = animation.current.pointerY * ambientWeight;
    host.current?.setAttribute("data-services-active", String(active));
    if (active) invalidate();
  });

  return (
    <group ref={placement}>
      <group ref={root} visible={false}>
        <primitive object={contactShadow.mesh} dispose={null} />
        <primitive object={asset.scene} dispose={null} />
      </group>
    </group>
  );
}

export function ServicesSceneCanvas(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [unlit, setUnlit] = useState(false);
  useEffect(() => {
    const sceneBridge = props.bridge.current;
    Object.assign(sceneBridge, { ready: false });
    host.current?.setAttribute("data-services-ready", "false");
    sceneBridge.onReady?.(false);
    sceneBridge.invalidate?.();
    return () => {
      Object.assign(sceneBridge, { ready: false });
      sceneBridge.onReady?.(false);
    };
  }, [props.bridge]);
  const fail = () => {
    Object.assign(props.bridge.current, { ready: false });
    host.current?.setAttribute("data-services-ready", "false");
    props.bridge.current.onReady?.(false);
    host.current?.setAttribute("data-services-preparation", "failed");
    props.bridge.current.onError?.();
  };
  return (
    <div ref={host} data-services-scene data-services-renderer="webgl" data-services-ready="false" data-services-preparation="loading" style={{ position: "absolute", inset: 0 }}>
      <ServicesSceneBoundary onError={fail}>
        <Canvas
          aria-hidden="true"
          orthographic
          camera={{ position: [7, 6.3, 7], near: .1, far: 60, zoom: 65 }}
          dpr={props.mobile ? [1, 1.25] : [1, 1.35]}
          frameloop="demand"
          gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
          onCreated={({ gl }) => {
            gl.localClippingEnabled = true;
            gl.setClearColor(0x000000, 0);
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.05;
          }}
        >
          {!unlit ? <>
            <ambientLight intensity={1.5} />
            <directionalLight position={[4, 7, 5]} intensity={2.3} color="#fff4e2" />
            <directionalLight position={[-4, 3, -3]} intensity={1.3} color="#a8c7ff" />
          </> : null}
          <Suspense fallback={null}>
            <ServicesWorld {...props} host={host} onUnlit={setUnlit} />
          </Suspense>
        </Canvas>
      </ServicesSceneBoundary>
    </div>
  );
}
