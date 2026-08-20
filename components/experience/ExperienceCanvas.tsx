"use client";

import { Canvas } from "@react-three/fiber";
import { Component, Suspense, type CSSProperties, type ErrorInfo, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { AudienceSystem } from "./AudienceSystem";
import { BakedMandegarScene } from "./BakedMandegarScene";
import {
  narrativeCueRanges as activationSequence,
  rangeProgress as phaseProgress,
} from "./narrative-score";
import { CameraRig } from "./CameraRig";
import { ExperiencePostProcessing } from "./ExperiencePostProcessing";
import { MandegarModel, type SceneProject } from "./MandegarModel";
import { SignalField } from "./SignalField";
import { assetSlots, qualityProfiles, sceneTokens, type SceneQuality } from "./scene-config";
import { experienceState } from "./experience-state";
import { WorldEnvironment } from "./WorldEnvironment";
import type { SpatialHudFrame, SpatialHudModeId, SpatialScreenPoint } from "./spatial-hud";
import spatialStyles from "./SpatialLabels.module.css";

type RuntimeState = "pending" | "fallback" | SceneQuality;
type ExperienceCanvasProps = {
  className?: string;
  enabledByCms?: boolean;
  projects?: SceneProject[];
  zoneLabels?: { photo: string; game: string };
  onProjectSelect?: (index: number) => void;
  onRuntimeReady?: (runtime: RuntimeState) => void;
  onFirstFrame?: () => void;
};

type SpatialHudModeCopy = {
  primaryCode: string;
  primaryValue: string;
  primaryMeta?: string;
  secondaryCode?: string;
  secondaryValue?: string;
  secondaryMeta?: string;
};

function ExhibitionWorld({
  quality,
  projects,
  onFirstFrame,
  onProjectSelect,
  onSpatialFrame,
}: {
  quality: SceneQuality;
  projects: SceneProject[];
  onFirstFrame?: () => void;
  onProjectSelect?: (index: number) => void;
  onSpatialFrame?: (frame: SpatialHudFrame) => void;
}) {
  if (sceneTokens.rendering.pipeline === "baked-modular") {
    return (
      <>
        <color attach="background" args={[sceneTokens.bakedScene.background]} />
        <Suspense fallback={null}>
          <CameraRig source={assetSlots.environment} />
          <BakedMandegarScene
            quality={quality}
            projects={projects}
            onFirstFrame={onFirstFrame}
            onProjectSelect={onProjectSelect}
            onSpatialFrame={onSpatialFrame}
          />
        </Suspense>
      </>
    );
  }
  return (
    <>
      <WorldEnvironment />
      <Suspense fallback={null}>
        <CameraRig />
        <MandegarModel
          projects={projects}
          onFirstFrame={onFirstFrame}
          onProjectSelect={onProjectSelect}
          onSpatialFrame={onSpatialFrame}
        />
        <SignalField quality={quality} />
      </Suspense>
      {sceneTokens.featureFlags.audience ? <AudienceSystem quality={quality} /> : null}
    </>
  );
}

class CanvasErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV !== "production") console.warn("Mandegar exhibition canvas fallback", error, info.componentStack);
  }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

function CanvasFallback({ className }: { className?: string }) {
  return <div className={className} data-webgl="fallback" aria-hidden="true" />;
}

export function ExperienceCanvas({ className, enabledByCms = true, projects = [], zoneLabels, onProjectSelect, onRuntimeReady, onFirstFrame }: ExperienceCanvasProps) {
  const [runtime, setRuntime] = useState<RuntimeState>("pending");
  const [pageVisible, setPageVisible] = useState(true);
  const spatialRoot = useRef<HTMLDivElement>(null);
  const primaryAnchor = useRef<SVGCircleElement>(null);
  const secondaryAnchor = useRef<SVGCircleElement>(null);
  const primaryLabel = useRef<HTMLDivElement>(null);
  const secondaryLabel = useRef<HTMLDivElement>(null);
  const activeHudTarget = useRef<"primary" | "secondary" | null>(null);
  const primaryCode = useRef<HTMLSpanElement>(null);
  const primaryValue = useRef<HTMLElement>(null);
  const primaryMeta = useRef<HTMLElement>(null);
  const secondaryCode = useRef<HTMLSpanElement>(null);
  const secondaryValue = useRef<HTMLElement>(null);
  const secondaryMeta = useRef<HTMLElement>(null);
  const projectLabel = projects[0]?.label || "PRIMARY DISPLAY";
  const spatialHudCopy = useMemo<Record<SpatialHudModeId, SpatialHudModeCopy>>(() => ({
    assembly: {
      primaryCode: "MEDIA CORE",
      primaryValue: "CURVED PRESENTATION SYSTEM",
      primaryMeta: "CONTENT • SIGNAL • SYNCHRONIZATION",
      secondaryCode: "DISPLAY NODE 00",
      secondaryValue: "SHARED MEDIA CANVAS",
      secondaryMeta: "SCALE • FOCUS • LIVE MEDIA",
    },
    activationLeft: {
      primaryCode: "EXPERIENCE NODE 01",
      primaryValue: "PHOTO + TOUCH",
      primaryMeta: "CAPTURE → PERSONALIZE → SHARE",
      secondaryCode: "TOUCHPOINT 01",
      secondaryValue: "RESPONSIVE DISPLAY",
      secondaryMeta: "SELECT • CUSTOMIZE • PUBLISH",
    },
    activationRight: {
      primaryCode: "EXPERIENCE NODE 02",
      primaryValue: "GAME + IMMERSIVE",
      primaryMeta: "PLAY → RESPOND → PARTICIPATE",
      secondaryCode: "LIVE FEEDBACK",
      secondaryValue: "DUAL MEDIA RESPONSE",
      secondaryMeta: "MOTION • INPUT • OUTPUT",
    },
    reveal: {
      primaryCode: "CONNECTED SYSTEM",
      primaryValue: "THREE EXPERIENCE ZONES",
      primaryMeta: "MEDIA • INTERACTION • AUDIENCE",
      secondaryCode: "SIGNAL CANOPY",
      secondaryValue: "SHARED VISUAL LANDMARK",
      secondaryMeta: "ORIENT • ATTRACT • CONNECT",
    },
    experiences: {
      primaryCode: "EXPERIENCE NODE 01",
      primaryValue: zoneLabels?.photo || "PHOTO + TOUCH",
      primaryMeta: "CAPTURE → PERSONALIZE → SHARE",
      secondaryCode: "EXPERIENCE NODE 02",
      secondaryValue: zoneLabels?.game || "GAME + IMMERSIVE",
      secondaryMeta: "PLAY → RESPOND → PARTICIPATE",
    },
    proof: {
      primaryCode: "MEDIA CORE",
      primaryValue: projectLabel,
      primaryMeta: "LIVE • ADAPTIVE • SYNCHRONIZED",
      secondaryCode: "ZONE DISPLAY",
      secondaryValue: "CONTEXTUAL MEDIA RESPONSE",
      secondaryMeta: "LOCAL • RESPONSIVE • CONNECTED",
    },
    intelligence: {
      primaryCode: "AUDIENCE SIGNAL",
      primaryValue: "PRESENCE + INTERACTION",
      primaryMeta: "INPUT • RESPONSE • PATTERN",
      secondaryCode: "ADAPTIVE RESPONSE",
      secondaryValue: "EXPERIENCE NODES INFORM THE CORE",
      secondaryMeta: "FLOW • MEDIA • INSIGHT",
    },
  }), [projectLabel, zoneLabels?.game, zoneLabels?.photo]);

  const renderSpatialHud = useCallback((frame: SpatialHudFrame) => {
    const root = spatialRoot.current;
    if (!root) return;
    const copy = frame.mode ? spatialHudCopy[frame.mode] : null;
    const active = Boolean(copy) && frame.opacity > 0.002 && (frame.primary.visible || frame.secondary.visible);
    root.style.opacity = frame.opacity.toFixed(4);
    root.style.visibility = active ? "visible" : "hidden";
    root.dataset.compact = frame.compact ? "true" : "false";
    root.dataset.mode = frame.mode ?? "none";
    const peakIntensity = Math.max(
      experienceState.stage.production.environmentPeak,
      experienceState.stage.production.centralPeak,
      experienceState.stage.production.leftPeak,
      experienceState.stage.production.rightPeak,
    );
    root.dataset.tone = peakIntensity > 0.42 ? "dark" : "light";
    if (!active || !copy) {
      activeHudTarget.current = null;
      if (primaryLabel.current) primaryLabel.current.style.opacity = "0";
      if (secondaryLabel.current) secondaryLabel.current.style.opacity = "0";
      if (primaryAnchor.current) primaryAnchor.current.style.opacity = "0";
      if (secondaryAnchor.current) secondaryAnchor.current.style.opacity = "0";
      root.dataset.proximity = "0.000";
      return;
    }

    if (primaryCode.current?.textContent !== copy.primaryCode) primaryCode.current!.textContent = copy.primaryCode;
    if (primaryValue.current?.textContent !== copy.primaryValue) primaryValue.current!.textContent = copy.primaryValue;
    if (primaryMeta.current && primaryMeta.current.textContent !== (copy.primaryMeta ?? "")) primaryMeta.current.textContent = copy.primaryMeta ?? "";
    if (secondaryCode.current && secondaryCode.current.textContent !== (copy.secondaryCode ?? "")) secondaryCode.current.textContent = copy.secondaryCode ?? "";
    if (secondaryValue.current && secondaryValue.current.textContent !== (copy.secondaryValue ?? "")) secondaryValue.current.textContent = copy.secondaryValue ?? "";
    if (secondaryMeta.current && secondaryMeta.current.textContent !== (copy.secondaryMeta ?? "")) secondaryMeta.current.textContent = copy.secondaryMeta ?? "";

    const pointerX = (experienceState.pointerX * 0.5 + 0.5) * frame.width;
    const pointerY = (experienceState.pointerY * 0.5 + 0.5) * frame.height;
    const proximityRadius = frame.compact ? 120 : 230;
    const proximityCore = frame.compact ? 34 : 54;
    const getProximity = (point: SpatialScreenPoint) => {
      if (!experienceState.pointerPresent || !point.visible) return 0;
      const distance = Math.hypot(pointerX - point.x, pointerY - point.y);
      return 1 - THREE.MathUtils.smoothstep(distance, proximityCore, proximityRadius);
    };
    const primaryProximity = getProximity(frame.primary);
    const secondaryProximity = getProximity(frame.secondary);
    const maximumProximity = Math.max(primaryProximity, secondaryProximity);
    const previousTarget = activeHudTarget.current;
    if (maximumProximity < 0.035) {
      activeHudTarget.current = null;
    } else if (
      previousTarget === "primary"
      && primaryProximity + 0.14 >= secondaryProximity
    ) {
      activeHudTarget.current = "primary";
    } else if (
      previousTarget === "secondary"
      && secondaryProximity + 0.14 >= primaryProximity
    ) {
      activeHudTarget.current = "secondary";
    } else {
      activeHudTarget.current = primaryProximity >= secondaryProximity ? "primary" : "secondary";
    }
    const primaryActivation = activeHudTarget.current === "primary" ? primaryProximity : 0;
    const secondaryActivation = activeHudTarget.current === "secondary" ? secondaryProximity : 0;
    root.dataset.proximity = maximumProximity.toFixed(3);
    root.dataset.activeTarget = activeHudTarget.current ?? "none";
    const placeAnnotation = (
      point: SpatialScreenPoint,
      proximity: number,
      label: HTMLDivElement | null,
      anchor: SVGCircleElement | null,
    ) => {
      if (!label || !anchor) return;
      const opensRight = point.x <= frame.width * 0.5;
      label.dataset.side = opensRight ? "right" : "left";
      label.style.opacity = proximity.toFixed(3);
      label.style.filter = `blur(${((1 - proximity) * 3.5).toFixed(2)}px)`;
      anchor.style.opacity = point.visible
        ? (0.42 + proximity * 0.58).toFixed(3)
        : "0";
      anchor.setAttribute("r", (2.8 + proximity * 1.2).toFixed(2));
      if (!point.visible) {
        return;
      }
      anchor.setAttribute("cx", point.x.toFixed(2));
      anchor.setAttribute("cy", point.y.toFixed(2));
      const labelX = point.x + (opensRight ? 12 : -12);
      const horizontalAlignment = opensRight ? "0" : "-100%";
      label.style.transform = `translate3d(${labelX.toFixed(2)}px, ${point.y.toFixed(2)}px, 0) translate(${horizontalAlignment}, -50%)`;
    };

    placeAnnotation(frame.primary, primaryActivation, primaryLabel.current, primaryAnchor.current);
    placeAnnotation(frame.secondary, secondaryActivation, secondaryLabel.current, secondaryAnchor.current);
  }, [spatialHudCopy]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const saveData = Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
      const supportsWebGL = Boolean(document.createElement("canvas").getContext("webgl2") || document.createElement("canvas").getContext("webgl"));
      const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 8;
      const adaptive = window.matchMedia("(max-width: 760px)").matches || (navigator.hardwareConcurrency || 8) <= 4 || deviceMemory <= 4;
      const nextRuntime: RuntimeState = enabledByCms && !reduced && !saveData && supportsWebGL ? (adaptive ? "adaptive" : "full") : "fallback";
      experienceState.quality = nextRuntime === "full" ? "full" : "adaptive";
      setRuntime(nextRuntime);
      onRuntimeReady?.(nextRuntime);
      if (nextRuntime === "fallback") window.requestAnimationFrame(() => onFirstFrame?.());
    });
    const onVisibilityChange = () => setPageVisible(document.visibilityState === "visible");
    const onPointerMove = (event: PointerEvent) => {
      experienceState.pointerX = (event.clientX / Math.max(window.innerWidth, 1) - 0.5) * 2;
      experienceState.pointerY = (event.clientY / Math.max(window.innerHeight, 1) - 0.5) * 2;
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
      experienceState.focusProject = null;
      experienceState.focusScreen = null;
      experienceState.focusZone = null;
      document.body.style.cursor = "";
    };
  }, [enabledByCms, onFirstFrame, onRuntimeReady]);

  if (runtime === "pending" || runtime === "fallback") return <CanvasFallback className={className} />;
  const profile = qualityProfiles[runtime];
  const bakedPipeline = sceneTokens.rendering.pipeline === "baked-modular";
  return (
    <>
      <CanvasErrorBoundary fallback={<CanvasFallback className={className} />}>
        <Canvas
          className={className}
          data-experience-canvas="true"
          data-particle-system={bakedPipeline ? "transition-boundary" : "signal-network"}
          data-interaction-system="pointer-touch"
          data-color-mode={bakedPipeline ? "baked-srgb" : "aces"}
          data-postprocessing={bakedPipeline ? "none" : runtime === "full" ? "bloom-dof" : "performance"}
          data-scene-pipeline={sceneTokens.rendering.pipeline}
          aria-hidden="true"
          dpr={[profile.dpr[0], profile.dpr[1]]}
          frameloop={pageVisible ? "always" : "never"}
          camera={{ position: [0, 4, 27], fov: 48, near: 0.1, far: 60 }}
          shadows={!bakedPipeline && runtime === "full"}
          gl={{ alpha: false, antialias: profile.antialias, powerPreference: runtime === "full" ? "high-performance" : "low-power" }}
          onPointerDown={() => { experienceState.pointerPulse = 1; }}
          onCreated={({ gl }) => {
            gl.toneMapping = bakedPipeline ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = bakedPipeline ? 1 : sceneTokens.environment.exposure;
            gl.outputColorSpace = THREE.SRGBColorSpace;
          }}
        >
          <ExhibitionWorld
            quality={runtime}
            projects={projects}
            onFirstFrame={onFirstFrame}
            onProjectSelect={onProjectSelect}
            onSpatialFrame={renderSpatialHud}
          />
          {bakedPipeline ? null : <ExperiencePostProcessing quality={runtime} />}
        </Canvas>
      </CanvasErrorBoundary>
      <div
        ref={spatialRoot}
        className={spatialStyles.root}
        data-spatial-labels="model-anchored"
        data-compact="false"
        dir="ltr"
        style={{
          "--hud-accent": sceneTokens.spatialLabels.accent,
          "--hud-ink": sceneTokens.spatialLabels.ink,
        } as CSSProperties}
        aria-hidden="true"
      >
        <svg className={spatialStyles.graphics} aria-hidden="true">
          <circle ref={primaryAnchor} className={spatialStyles.anchor} data-spatial-anchor="primary" />
          <circle ref={secondaryAnchor} className={`${spatialStyles.anchor} ${spatialStyles.secondaryGraphic}`} data-spatial-anchor="secondary" />
        </svg>
        <div ref={primaryLabel} className={spatialStyles.label} data-side="left" data-spatial-annotation="primary">
          <span ref={primaryCode}>FORM / 01</span>
          <strong ref={primaryValue} dir="auto">CORE ASSEMBLY</strong>
          <small ref={primaryMeta}>FUNCTION / CENTRAL MEDIA HUB</small>
        </div>
        <div ref={secondaryLabel} className={`${spatialStyles.label} ${spatialStyles.secondaryLabel}`} data-side="right" data-spatial-annotation="secondary">
          <span ref={secondaryCode} />
          <strong ref={secondaryValue} dir="auto" />
          <small ref={secondaryMeta} />
        </div>
      </div>
    </>
  );
}
