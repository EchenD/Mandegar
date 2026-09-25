"use client";

import { Canvas } from "@react-three/fiber";
import {
  Component,
  Suspense,
  type ErrorInfo,
  type ReactNode,
  useEffect,
  useState,
} from "react";
import * as THREE from "three";
import { BakedMandegarScene } from "./BakedMandegarScene";
import { CameraRig } from "./CameraRig";
import { experienceState } from "./experience-state";
import type { SceneProject } from "./experience-types";
import { assetSlots, qualityProfiles, sceneTokens, type SceneQuality } from "./scene-config";

type RuntimeState = "pending" | "fallback" | SceneQuality;
type ExperienceCanvasProps = {
  className?: string;
  enabledByCms?: boolean;
  projects?: SceneProject[];
  onRuntimeReady?: (runtime: RuntimeState) => void;
  onFirstFrame?: () => void;
};

function ExhibitionWorld({
  quality,
  projects,
  onFirstFrame,
}: {
  quality: SceneQuality;
  projects: SceneProject[];
  onFirstFrame?: () => void;
}) {
  return (
    <>
      <color attach="background" args={[sceneTokens.bakedScene.background]} />
      <Suspense fallback={null}>
        <CameraRig source={assetSlots.environment} />
        <BakedMandegarScene quality={quality} projects={projects} onFirstFrame={onFirstFrame} />
      </Suspense>
    </>
  );
}

class CanvasErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Mandegar exhibition canvas fallback", error, info.componentStack);
    }
  }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

function CanvasFallback({ className }: { className?: string }) {
  return <div className={className} data-webgl="fallback" aria-hidden="true" />;
}

export function ExperienceCanvas({
  className,
  enabledByCms = true,
  projects = [],
  onRuntimeReady,
  onFirstFrame,
}: ExperienceCanvasProps) {
  const [runtime, setRuntime] = useState<RuntimeState>("pending");
  const [pageVisible, setPageVisible] = useState(true);
  const [sceneVisible, setSceneVisible] = useState(true);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const saveData = Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
      const supportsWebGL = Boolean(
        document.createElement("canvas").getContext("webgl2")
        || document.createElement("canvas").getContext("webgl"),
      );
      const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 8;
      const adaptive = window.matchMedia("(max-width: 760px)").matches
        || (navigator.hardwareConcurrency || 8) <= 4
        || deviceMemory <= 4;
      const nextRuntime: RuntimeState = enabledByCms && !reduced && !saveData && supportsWebGL
        ? (adaptive ? "adaptive" : "full")
        : "fallback";
      experienceState.quality = nextRuntime === "full" ? "full" : "adaptive";
      setRuntime(nextRuntime);
      onRuntimeReady?.(nextRuntime);
      if (nextRuntime === "fallback") window.requestAnimationFrame(() => onFirstFrame?.());
    });
    const onVisibilityChange = () => setPageVisible(document.visibilityState === "visible");
    const onPointerMove = (event: PointerEvent) => {
      const canvas = document.querySelector<HTMLCanvasElement>("[data-experience-canvas='true']");
      const bounds = canvas?.getBoundingClientRect();
      const width = Math.max(bounds?.width ?? window.innerWidth, 1);
      const height = Math.max(bounds?.height ?? window.innerHeight, 1);
      experienceState.pointerX = THREE.MathUtils.clamp(((event.clientX - (bounds?.left ?? 0)) / width) * 2 - 1, -1, 1);
      experienceState.pointerY = THREE.MathUtils.clamp(1 - ((event.clientY - (bounds?.top ?? 0)) / height) * 2, -1, 1);
      experienceState.pointerPresent = event.pointerType !== "touch";
    };
    const resetPointer = () => {
      experienceState.pointerX = 0;
      experienceState.pointerY = 0;
      experienceState.pointerPresent = false;
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("blur", resetPointer);
    document.documentElement.addEventListener("pointerleave", resetPointer);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("blur", resetPointer);
      document.documentElement.removeEventListener("pointerleave", resetPointer);
      experienceState.progress = 0;
      experienceState.pointerX = 0;
      experienceState.pointerY = 0;
      experienceState.pointerPresent = false;
      experienceState.pointerPulse = 0;
      experienceState.assemblyProgress = 0;
      experienceState.focusDistance = 18;
      document.body.style.cursor = "";
    };
  }, [enabledByCms, onFirstFrame, onRuntimeReady]);

  useEffect(() => {
    if (runtime === "pending" || runtime === "fallback") return;
    let observer: IntersectionObserver | undefined;
    const frame = requestAnimationFrame(() => {
      const canvas = document.querySelector<HTMLCanvasElement>("[data-experience-canvas='true']");
      if (!canvas) return;
      observer = new IntersectionObserver(([entry]) => setSceneVisible(entry.isIntersecting), { rootMargin: "100px 0px" });
      observer.observe(canvas);
    });
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [runtime]);

  if (runtime === "pending" || runtime === "fallback") return <CanvasFallback className={className} />;
  const profile = qualityProfiles[runtime];
  return (
    <CanvasErrorBoundary fallback={<CanvasFallback className={className} />}>
      <Canvas
        className={className}
        data-experience-canvas="true"
        data-particle-system="transition-boundary"
        data-interaction-system="station-director"
        data-color-mode="baked-srgb"
        data-postprocessing="none"
        data-scene-pipeline={sceneTokens.rendering.pipeline}
        aria-hidden="true"
        dpr={[profile.dpr[0], profile.dpr[1]]}
        frameloop={pageVisible && sceneVisible ? "always" : "never"}
        camera={{ position: [0, 4, 27], fov: 48, near: 0.1, far: 60 }}
        shadows={false}
        gl={{ alpha: false, antialias: profile.antialias, powerPreference: runtime === "full" ? "high-performance" : "low-power" }}
        onPointerDown={() => { experienceState.pointerPulse = 1; }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.NoToneMapping;
          gl.toneMappingExposure = 1;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <ExhibitionWorld quality={runtime} projects={projects} onFirstFrame={onFirstFrame} />
      </Canvas>
    </CanvasErrorBoundary>
  );
}
