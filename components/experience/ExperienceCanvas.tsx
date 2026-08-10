"use client";

import { Canvas } from "@react-three/fiber";
import { Component, Suspense, type CSSProperties, type ErrorInfo, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { AudienceSystem } from "./AudienceSystem";
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
  secondaryCode?: string;
  secondaryValue?: string;
  measurementPrefix?: string;
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
  const primaryLeader = useRef<SVGPathElement>(null);
  const secondaryLeader = useRef<SVGPathElement>(null);
  const measurementGroup = useRef<SVGGElement>(null);
  const measurementLine = useRef<SVGPathElement>(null);
  const primaryLabel = useRef<HTMLDivElement>(null);
  const secondaryLabel = useRef<HTMLDivElement>(null);
  const primaryCode = useRef<HTMLSpanElement>(null);
  const primaryValue = useRef<HTMLElement>(null);
  const secondaryCode = useRef<HTMLSpanElement>(null);
  const secondaryValue = useRef<HTMLElement>(null);
  const measurementLabel = useRef<HTMLDivElement>(null);
  const projectLabel = projects[0]?.label || "PRIMARY DISPLAY";
  const spatialHudCopy = useMemo<Record<SpatialHudModeId, SpatialHudModeCopy>>(() => ({
    assembly: {
      primaryCode: "FORM / 01",
      primaryValue: "CORE ASSEMBLY",
      measurementPrefix: "H",
    },
    activationLeft: {
      primaryCode: "SIGNAL / L",
      primaryValue: "EXPERIENCE POD",
      secondaryCode: "TOUCH / L",
      secondaryValue: "INTERACTION SURFACE",
    },
    activationRight: {
      primaryCode: "SIGNAL / R",
      primaryValue: "EXPERIENCE POD",
      secondaryCode: "TOUCH / R",
      secondaryValue: "INTERACTION SURFACE",
    },
    reveal: {
      primaryCode: "LIGHT / 01",
      primaryValue: "CANOPY SIGNAL",
      secondaryCode: "CORE / ACTIVE",
      secondaryValue: "REVEAL COMPLETE",
      measurementPrefix: "DIA",
    },
    experiences: {
      primaryCode: "ZONE / L",
      primaryValue: zoneLabels?.photo || "PHOTO EXPERIENCE",
      secondaryCode: "ZONE / R",
      secondaryValue: zoneLabels?.game || "GAME EXPERIENCE",
    },
    proof: {
      primaryCode: "MEDIA / 21:9",
      primaryValue: projectLabel,
      measurementPrefix: "W",
    },
    intelligence: {
      primaryCode: "FLOW / INPUT",
      primaryValue: "HUMAN SIGNAL",
      secondaryCode: "CORE / OUTPUT",
      secondaryValue: "SOFT INSIGHT",
      measurementPrefix: "DELTA",
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
    if (!active || !copy) return;

    if (primaryCode.current?.textContent !== copy.primaryCode) primaryCode.current!.textContent = copy.primaryCode;
    if (primaryValue.current?.textContent !== copy.primaryValue) primaryValue.current!.textContent = copy.primaryValue;
    if (secondaryCode.current && secondaryCode.current.textContent !== (copy.secondaryCode ?? "")) secondaryCode.current.textContent = copy.secondaryCode ?? "";
    if (secondaryValue.current && secondaryValue.current.textContent !== (copy.secondaryValue ?? "")) secondaryValue.current.textContent = copy.secondaryValue ?? "";

    const safeArea = frame.compact ? sceneTokens.spatialLabels.safeArea.compact : sceneTokens.spatialLabels.safeArea.desktop;
    const labelHalfWidth = frame.compact ? 60 : 84;
    const horizontalOffset = frame.compact ? 82 : 128;
    const coreSide = frame.primary.x <= frame.width * 0.52 ? -1 : 1;
    const mediaSide = -coreSide;
    const inlineSafety = Math.min(safeArea.inline, Math.max(12, (frame.width - labelHalfWidth * 2) / 3));
    const safeTop = Math.min(safeArea.top, frame.height * 0.35);
    const safeBottom = Math.min(safeArea.bottom, frame.height * 0.35);
    const clampX = (value: number) => THREE.MathUtils.clamp(value, inlineSafety + labelHalfWidth, frame.width - inlineSafety - labelHalfWidth);
    const clampY = (value: number) => THREE.MathUtils.clamp(value, safeTop, frame.height - safeBottom);
    const placeAnnotation = (
      point: SpatialScreenPoint,
      side: number,
      verticalOffset: number,
      label: HTMLDivElement | null,
      leader: SVGPathElement | null,
    ) => {
      if (!label || !leader) return;
      const visible = point.visible;
      label.dataset.side = side < 0 ? "left" : "right";
      label.style.opacity = visible ? "1" : "0";
      label.style.visibility = visible ? "visible" : "hidden";
      leader.style.opacity = visible ? "1" : "0";
      if (!visible) return;
      const labelX = clampX(point.x + side * horizontalOffset);
      const labelY = clampY(point.y + verticalOffset);
      const edgeX = labelX - side * labelHalfWidth;
      const elbowX = point.x + side * Math.min(34, Math.abs(edgeX - point.x) * 0.42);
      const elbowY = THREE.MathUtils.lerp(point.y, labelY, 0.48);
      label.style.transform = `translate3d(${labelX.toFixed(2)}px, ${labelY.toFixed(2)}px, 0) translate(-50%, -50%)`;
      leader.setAttribute(
        "d",
        `M ${point.x.toFixed(2)} ${point.y.toFixed(2)} L ${elbowX.toFixed(2)} ${elbowY.toFixed(2)} L ${edgeX.toFixed(2)} ${labelY.toFixed(2)} M ${(point.x - 3).toFixed(2)} ${point.y.toFixed(2)} L ${point.x.toFixed(2)} ${(point.y - 3).toFixed(2)} L ${(point.x + 3).toFixed(2)} ${point.y.toFixed(2)} L ${point.x.toFixed(2)} ${(point.y + 3).toFixed(2)} Z`,
      );
    };

    placeAnnotation(frame.primary, coreSide, frame.compact ? -46 : -62, primaryLabel.current, primaryLeader.current);
    placeAnnotation(frame.secondary, mediaSide, frame.compact ? 38 : 52, secondaryLabel.current, secondaryLeader.current);

    const showMeasurement = frame.measureStart.visible && frame.measureEnd.visible && frame.measureMeters > 0;
    if (measurementGroup.current) measurementGroup.current.style.opacity = showMeasurement ? "1" : "0";
    if (measurementLabel.current) {
      measurementLabel.current.style.opacity = showMeasurement ? "1" : "0";
      measurementLabel.current.style.visibility = showMeasurement ? "visible" : "hidden";
    }
    if (!showMeasurement || !measurementLine.current || !measurementLabel.current) return;
    const dx = frame.measureEnd.x - frame.measureStart.x;
    const dy = frame.measureEnd.y - frame.measureStart.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const normalX = -dy / length;
    const normalY = dx / length;
    const tick = frame.compact ? 4 : 5;
    measurementLine.current.setAttribute(
      "d",
      `M ${frame.measureStart.x.toFixed(2)} ${frame.measureStart.y.toFixed(2)} L ${frame.measureEnd.x.toFixed(2)} ${frame.measureEnd.y.toFixed(2)} M ${(frame.measureStart.x - normalX * tick).toFixed(2)} ${(frame.measureStart.y - normalY * tick).toFixed(2)} L ${(frame.measureStart.x + normalX * tick).toFixed(2)} ${(frame.measureStart.y + normalY * tick).toFixed(2)} M ${(frame.measureEnd.x - normalX * tick).toFixed(2)} ${(frame.measureEnd.y - normalY * tick).toFixed(2)} L ${(frame.measureEnd.x + normalX * tick).toFixed(2)} ${(frame.measureEnd.y + normalY * tick).toFixed(2)}`,
    );
    const measurementX = clampX((frame.measureStart.x + frame.measureEnd.x) * 0.5 + normalX * 14);
    const measurementY = clampY((frame.measureStart.y + frame.measureEnd.y) * 0.5 + normalY * 14);
    const measurementText = `${copy.measurementPrefix ? `${copy.measurementPrefix} / ` : ""}${frame.measureMeters.toFixed(2)} M`;
    if (measurementLabel.current.textContent !== measurementText) measurementLabel.current.textContent = measurementText;
    measurementLabel.current.style.transform = `translate3d(${measurementX.toFixed(2)}px, ${measurementY.toFixed(2)}px, 0) translate(-50%, -50%)`;
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
    };
    const resetPointer = () => {
      experienceState.pointerX = 0;
      experienceState.pointerY = 0;
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
      experienceState.pointerPulse = 0;
      experienceState.assemblyProgress = 0;
      experienceState.focusDistance = 18;
      experienceState.focusProject = null;
      experienceState.focusZone = null;
      document.body.style.cursor = "";
    };
  }, [enabledByCms, onFirstFrame, onRuntimeReady]);

  if (runtime === "pending" || runtime === "fallback") return <CanvasFallback className={className} />;
  const profile = qualityProfiles[runtime];
  return (
    <>
      <CanvasErrorBoundary fallback={<CanvasFallback className={className} />}>
        <Canvas
          className={className}
          data-experience-canvas="true"
          data-particle-system="signal-network"
          data-interaction-system="pointer-touch"
          data-color-mode="aces"
          data-postprocessing={runtime === "full" ? "bloom-dof" : "performance"}
          aria-hidden="true"
          dpr={[profile.dpr[0], profile.dpr[1]]}
          frameloop={pageVisible ? "always" : "never"}
          camera={{ position: [0, 4, 27], fov: 48, near: 0.1, far: 60 }}
          shadows={runtime === "full"}
          gl={{ alpha: false, antialias: profile.antialias, powerPreference: runtime === "full" ? "high-performance" : "low-power" }}
          onPointerDown={() => { experienceState.pointerPulse = 1; }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = sceneTokens.environment.exposure;
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
          <ExperiencePostProcessing quality={runtime} />
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
          <path ref={primaryLeader} className={spatialStyles.leader} />
          <path ref={secondaryLeader} className={`${spatialStyles.leader} ${spatialStyles.secondaryGraphic}`} />
          <g ref={measurementGroup} className={spatialStyles.measurementGroup}>
            <path ref={measurementLine} className={spatialStyles.dimension} />
          </g>
        </svg>
        <div ref={primaryLabel} className={spatialStyles.label} data-side="left">
          <span ref={primaryCode}>FORM / 01</span>
          <strong ref={primaryValue} dir="auto">CORE ASSEMBLY</strong>
        </div>
        <div ref={secondaryLabel} className={`${spatialStyles.label} ${spatialStyles.secondaryLabel}`} data-side="right">
          <span ref={secondaryCode} />
          <strong ref={secondaryValue} dir="auto" />
        </div>
        <div ref={measurementLabel} className={spatialStyles.measurementLabel}>0.00 M</div>
      </div>
    </>
  );
}
