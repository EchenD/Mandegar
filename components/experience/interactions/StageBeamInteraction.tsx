"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { interactionSurfaceSizes, sceneTokens } from "../scene-config";
import type { InteractionCopy } from "./interaction-copy";
import {
  interactionRuntime,
  markInteractionCanvasDirty,
  registerInteractionCanvas,
  registerSceneInteraction,
} from "./interaction-runtime";
import type { SceneInteractionEvent } from "./interaction-types";
import styles from "./HeroInteractions.module.css";

const { width: canvasWidth, height: canvasHeight } = interactionSurfaceSizes.videoWall.canvas;
const beamColors = ["#50c7ff", "#d95cff", "#ffb54a", "#75d8ff", "#ef86ff"] as const;
const beamCenters = [0.12, 0.31, 0.5, 0.69, 0.88] as const;

type StagePointer = {
  pointerId: number;
  startBeam: number;
  lastBeam: number;
  startX: number;
  startY: number;
  moved: boolean;
};

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function hitRect(x: number, y: number, left: number, top: number, width: number, height: number) {
  return x >= left && x <= left + width && y >= top && y <= top + height;
}

function distance(firstX: number, firstY: number, secondX: number, secondY: number) {
  return Math.hypot(firstX - secondX, firstY - secondY);
}

function revealProgress(progress: number, start: number, end: number) {
  const value = Math.max(0, Math.min(1, (progress - start) / Math.max(0.001, end - start)));
  return value * value * (3 - 2 * value);
}

function beamAtPoint(x: number, y: number) {
  if (y < 0.22 || y > 0.79) return -1;
  return beamCenters.findIndex((center) => Math.abs(x - center) <= 0.085);
}

export function StageBeamInteraction({
  copy,
  onClose,
  onComplete,
  onContinue,
}: {
  copy: InteractionCopy;
  onClose: () => void;
  onComplete: () => void;
  onContinue: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderFrame = useRef<number | null>(null);
  const transitionFrame = useRef<number | null>(null);
  const finaleFrame = useRef<number | null>(null);
  const completionTimer = useRef<number | null>(null);
  const transitionProgress = useRef(0);
  const transitionState = useRef<"intro" | "ready" | "outro">("intro");
  const finaleStartedAt = useRef<number | null>(null);
  const monitorImage = useRef<HTMLImageElement | null>(null);
  const activePointer = useRef<StagePointer | null>(null);
  const activeRef = useRef([false, false, false, false, false]);
  const hoverBeam = useRef<number | null>(null);
  const hoverControl = useRef<"close" | "reset" | "continue" | null>(null);
  const keyboardFocus = useRef<number | null>(null);
  const completionReported = useRef(false);
  const sceneInputCount = useRef(0);
  const [active, setActive] = useState([false, false, false, false, false]);

  const syncSceneBeams = useCallback(() => {
    const preview = hoverControl.current === null ? hoverBeam.current : null;
    interactionRuntime.activeBeams = activeRef.current.map(
      (enabled, index) => enabled || preview === index,
    );
    interactionRuntime.stageComplete = activeRef.current.every(Boolean);
  }, []);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const width = canvas.width;
    const height = canvas.height;
    const direction = document.documentElement.dir === "rtl" ? "rtl" : "ltr";
    const activeBeams = activeRef.current;
    const activeCount = activeBeams.filter(Boolean).length;
    const complete = activeCount === beamColors.length;
    const transition = transitionProgress.current;
    const surfaceReveal = revealProgress(transition, 0, 0.34);
    const controlsReveal = revealProgress(transition, 0.62, 1);
    const finaleElapsed = finaleStartedAt.current === null
      ? 1
      : Math.min(1, (performance.now() - finaleStartedAt.current) / 950);
    const finalePulse = complete ? Math.sin(finaleElapsed * Math.PI) : 0;
    interactionRuntime.stageVisibility = transition;
    syncSceneBeams();

    context.clearRect(0, 0, width, height);
    canvas.dataset.transitionProgress = transition.toFixed(3);
    if (monitorImage.current?.complete) {
      context.drawImage(monitorImage.current, 0, 0, width, height);
    } else {
      context.fillStyle = "#080b10";
      context.fillRect(0, 0, width, height);
    }

    context.save();
    context.globalAlpha = surfaceReveal;
    const background = context.createLinearGradient(0, 0, 0, height);
    background.addColorStop(0, "#071225");
    background.addColorStop(0.58, "#050b15");
    background.addColorStop(1, "#020509");
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    context.strokeStyle = "rgba(117,216,255,.045)";
    context.lineWidth = 1;
    for (let x = 0; x <= width; x += 50) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
    for (let y = 0; y <= height; y += 50) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }

    roundedRect(context, 13, 13, width - 26, height - 26, 20);
    context.strokeStyle = "rgba(117,216,255,.17)";
    context.lineWidth = 2;
    context.stroke();

    context.save();
    context.direction = direction;
    context.textAlign = "center";
    context.fillStyle = "rgba(247,247,244,.48)";
    context.font = '650 12px "Vazirmatn Variable", Tahoma, sans-serif';
    context.letterSpacing = "3.4px";
    context.fillText("MANDEGAR  /  STAGE COMPOSER", width / 2, 28);
    context.letterSpacing = "0px";
    context.fillStyle = "#f7f7f4";
    context.font = '680 27px "Vazirmatn Variable", Tahoma, sans-serif';
    context.fillText(complete ? copy.stage.finale : copy.stations.stage.instruction, width / 2, 63);
    context.fillStyle = complete ? "#f7f7f4" : "rgba(247,247,244,.56)";
    context.font = '700 13px "Vazirmatn Variable", Tahoma, sans-serif';
    context.fillText(`${String(activeCount).padStart(2, "0")} / 05`, width / 2, 88);
    context.restore();

    const headerRule = context.createLinearGradient(55, 0, width - 55, 0);
    headerRule.addColorStop(0, "rgba(117,216,255,0)");
    headerRule.addColorStop(0.5, "rgba(117,216,255,.28)");
    headerRule.addColorStop(1, "rgba(117,216,255,0)");
    context.fillStyle = headerRule;
    context.fillRect(55, 101, width - 110, 1);

    context.strokeStyle = "rgba(247,247,244,.12)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(56, 326);
    context.lineTo(width - 56, 326);
    context.stroke();

    beamCenters.forEach((normalizedX, index) => {
      const x = normalizedX * width;
      const enabled = activeBeams[index];
      const focused = hoverBeam.current === index || keyboardFocus.current === index;
      const reveal = revealProgress(transition, 0.18 + index * 0.07, 0.54 + index * 0.07);
      const strength = enabled ? 1 : focused ? 0.5 : 0.12;
      const color = beamColors[index];
      context.save();
      context.globalAlpha = surfaceReveal * reveal;

      const cone = context.createLinearGradient(x, 133, x, 318);
      cone.addColorStop(0, `${color}${enabled ? "8c" : focused ? "52" : "12"}`);
      cone.addColorStop(0.72, `${color}${enabled ? "32" : focused ? "20" : "04"}`);
      cone.addColorStop(1, `${color}00`);
      context.fillStyle = cone;
      context.beginPath();
      context.moveTo(x - 9, 139);
      context.lineTo(x - 58, 316);
      context.lineTo(x + 58, 316);
      context.lineTo(x + 9, 139);
      context.closePath();
      context.fill();

      context.shadowColor = color;
      context.shadowBlur = (enabled ? 24 : focused ? 16 : 5) + finalePulse * 18;
      context.fillStyle = enabled ? color : focused ? `${color}b8` : "rgba(247,247,244,.18)";
      roundedRect(context, x - 37, 116, 74, 31, 12);
      context.fill();
      context.shadowBlur = 0;
      context.fillStyle = "#03070d";
      context.font = '800 12px "Vazirmatn Variable", Tahoma, sans-serif';
      context.textAlign = "center";
      context.fillText(String(index + 1).padStart(2, "0"), x, 136);

      const pool = context.createRadialGradient(x, 315, 2, x, 315, 61 + finalePulse * 9);
      pool.addColorStop(0, `${color}${enabled ? "d9" : focused ? "8a" : "28"}`);
      pool.addColorStop(0.36, `${color}${enabled ? "61" : focused ? "3d" : "12"}`);
      pool.addColorStop(1, `${color}00`);
      context.fillStyle = pool;
      context.beginPath();
      context.ellipse(x, 315, 63 + finalePulse * 8, 13 + finalePulse * 2, 0, 0, Math.PI * 2);
      context.fill();

      context.direction = direction;
      context.fillStyle = enabled ? "#f7f7f4" : `rgba(247,247,244,${0.35 + strength * 0.35})`;
      context.font = '680 13px "Vazirmatn Variable", Tahoma, sans-serif';
      context.fillText(`${copy.stage.beam} ${index + 1}`, x, 351);
      if (enabled) {
        context.strokeStyle = color;
        context.lineWidth = 2.5;
        context.lineCap = "round";
        context.beginPath();
        context.moveTo(x - 7, 367);
        context.lineTo(x - 1, 373);
        context.lineTo(x + 10, 360);
        context.stroke();
      }
      context.restore();
    });

    const closeX = width * 0.965;
    const closeY = height * 0.085;
    const closeFocused = hoverControl.current === "close" || keyboardFocus.current === 7;
    context.fillStyle = closeFocused ? "rgba(117,216,255,.17)" : "rgba(3,8,16,.52)";
    context.beginPath();
    context.arc(closeX, closeY, 19, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = closeFocused ? "#f7f7f4" : "rgba(247,247,244,.52)";
    context.lineWidth = closeFocused ? 3 : 1.5;
    context.stroke();
    context.strokeStyle = "#f7f7f4";
    context.lineWidth = 1.7;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(closeX - 5, closeY - 5);
    context.lineTo(closeX + 5, closeY + 5);
    context.moveTo(closeX + 5, closeY - 5);
    context.lineTo(closeX - 5, closeY + 5);
    context.stroke();
    context.lineCap = "butt";

    const drawButton = (
      left: number,
      label: string,
      enabled: boolean,
      focused: boolean,
      primary = false,
    ) => {
      const top = height * 0.865;
      const buttonWidth = width * 0.205;
      const buttonHeight = height * 0.09;
      roundedRect(context, left, top, buttonWidth, buttonHeight, buttonHeight / 2);
      context.fillStyle = primary && enabled ? "#225cff" : "rgba(5,14,28,.96)";
      context.shadowColor = primary && enabled ? "#225cff" : "transparent";
      context.shadowBlur = primary && enabled ? 16 : 0;
      context.fill();
      context.shadowBlur = 0;
      context.strokeStyle = focused
        ? "#f7f7f4"
        : enabled
          ? "rgba(117,216,255,.84)"
          : "rgba(117,216,255,.22)";
      context.lineWidth = focused ? 3 : 1.5;
      context.stroke();
      context.direction = direction;
      context.fillStyle = enabled ? "#f7f7f4" : "rgba(247,247,244,.34)";
      context.font = '700 14px "Vazirmatn Variable", Tahoma, sans-serif';
      context.textAlign = "center";
      context.fillText(label, left + buttonWidth / 2, top + buttonHeight * 0.63);
    };
    context.save();
    context.globalAlpha = surfaceReveal * controlsReveal;
    drawButton(
      width * 0.035,
      copy.reset,
      activeCount > 0,
      hoverControl.current === "reset" || keyboardFocus.current === 5,
    );
    drawButton(
      width * 0.76,
      copy.continue,
      complete,
      hoverControl.current === "continue" || keyboardFocus.current === 6,
      true,
    );
    context.restore();
    context.restore();

    markInteractionCanvasDirty("videoWall");
  }, [copy, syncSceneBeams]);

  const schedulePaint = useCallback(() => {
    if (renderFrame.current !== null) return;
    renderFrame.current = window.requestAnimationFrame(() => {
      renderFrame.current = null;
      paint();
    });
  }, [paint]);

  const startFinaleAnimation = useCallback(() => {
    if (finaleFrame.current !== null) window.cancelAnimationFrame(finaleFrame.current);
    finaleStartedAt.current = performance.now();
    const tick = () => {
      paint();
      if (finaleStartedAt.current !== null && performance.now() - finaleStartedAt.current < 950) {
        finaleFrame.current = window.requestAnimationFrame(tick);
      } else {
        finaleFrame.current = null;
      }
    };
    finaleFrame.current = window.requestAnimationFrame(tick);
  }, [paint]);

  const animateTransition = useCallback((target: 0 | 1, onFinish?: () => void) => {
    if (transitionFrame.current !== null) window.cancelAnimationFrame(transitionFrame.current);
    const from = transitionProgress.current;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reducedMotion ? 0 : target === 1 ? 1050 : 650;
    transitionState.current = target === 1 ? "intro" : "outro";
    if (duration === 0 || Math.abs(target - from) < 0.001) {
      transitionProgress.current = target;
      transitionState.current = target === 1 ? "ready" : "outro";
      paint();
      onFinish?.();
      return;
    }
    const startedAt = performance.now();
    const tick = (time: number) => {
      const elapsed = Math.min(1, (time - startedAt) / duration);
      const eased = elapsed * elapsed * (3 - 2 * elapsed);
      transitionProgress.current = from + (target - from) * eased;
      paint();
      if (elapsed < 1) {
        transitionFrame.current = window.requestAnimationFrame(tick);
        return;
      }
      transitionFrame.current = null;
      transitionState.current = target === 1 ? "ready" : "outro";
      onFinish?.();
    };
    transitionFrame.current = window.requestAnimationFrame(tick);
  }, [paint]);

  const exitWithTransition = useCallback((callback: () => void) => {
    if (transitionState.current === "outro") return;
    activePointer.current = null;
    hoverBeam.current = null;
    hoverControl.current = null;
    animateTransition(0, callback);
  }, [animateTransition]);

  const closeWithTransition = useCallback(() => {
    if (completionTimer.current !== null) window.clearTimeout(completionTimer.current);
    completionTimer.current = null;
    exitWithTransition(onClose);
  }, [exitWithTransition, onClose]);

  const continueWithTransition = useCallback(() => {
    exitWithTransition(onContinue);
  }, [exitWithTransition, onContinue]);

  const commitBeams = useCallback((next: boolean[]) => {
    activeRef.current = next;
    hoverBeam.current = null;
    interactionRuntime.activeBeams = [...next];
    interactionRuntime.stageComplete = next.every(Boolean);
    setActive(next);
    schedulePaint();
    if (next.every(Boolean) && !completionReported.current) {
      completionReported.current = true;
      startFinaleAnimation();
      completionTimer.current = window.setTimeout(() => {
        completionTimer.current = null;
        onComplete();
      }, 320);
    }
  }, [onComplete, schedulePaint, startFinaleAnimation]);

  const toggleBeam = useCallback((index: number) => {
    const next = [...activeRef.current];
    next[index] = !next[index];
    commitBeams(next);
  }, [commitBeams]);

  const activateBeam = useCallback((index: number) => {
    if (activeRef.current[index]) return;
    const next = [...activeRef.current];
    next[index] = true;
    commitBeams(next);
  }, [commitBeams]);

  const reset = useCallback(() => {
    if (completionTimer.current !== null) window.clearTimeout(completionTimer.current);
    completionTimer.current = null;
    finaleStartedAt.current = null;
    activePointer.current = null;
    commitBeams([false, false, false, false, false]);
  }, [commitBeams]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let mounted = true;
    let registered = false;
    const image = new Image();
    const begin = () => {
      if (!mounted || registered) return;
      registered = true;
      monitorImage.current = image.naturalWidth > 0 ? image : null;
      transitionProgress.current = 0;
      interactionRuntime.stageVisibility = 0;
      paint();
      registerInteractionCanvas("videoWall", canvas);
      animateTransition(1);
    };
    image.onload = begin;
    image.onerror = begin;
    image.src = sceneTokens.bakedScene.screens.videoWall;
    if (image.complete) begin();
    void document.fonts?.ready.then(() => {
      if (mounted) schedulePaint();
    });
    return () => {
      mounted = false;
      image.onload = null;
      image.onerror = null;
      registerInteractionCanvas("videoWall", null);
    };
  }, [animateTransition, paint, schedulePaint]);

  useEffect(() => {
    const handleSceneInput = (event: SceneInteractionEvent) => {
      sceneInputCount.current += 1;
      if (canvasRef.current) {
        canvasRef.current.dataset.sceneInputCount = String(sceneInputCount.current);
      }
      if (transitionState.current !== "ready" || event.phase === "activate") return;
      const point = { x: event.x, y: event.y };
      if (event.phase === "move") {
        const pointer = activePointer.current;
        if (pointer?.pointerId === event.pointerId) {
          const index = beamAtPoint(point.x, point.y);
          if (distance(point.x, point.y, pointer.startX, pointer.startY) > 0.025) {
            pointer.moved = true;
            activateBeam(pointer.startBeam);
          }
          if (pointer.moved && index >= 0 && index !== pointer.lastBeam) {
            pointer.lastBeam = index;
            activateBeam(index);
          }
          hoverBeam.current = index >= 0 ? index : null;
          syncSceneBeams();
          schedulePaint();
          return;
        }
        hoverControl.current = distance(point.x, point.y, 0.965, 0.085) <= 0.075
          ? "close"
          : hitRect(point.x, point.y, 0.02, 0.82, 0.25, 0.18)
            ? "reset"
            : hitRect(point.x, point.y, 0.73, 0.82, 0.27, 0.18)
              ? "continue"
              : null;
        const index = hoverControl.current === null ? beamAtPoint(point.x, point.y) : -1;
        hoverBeam.current = index >= 0 ? index : null;
        syncSceneBeams();
        schedulePaint();
        return;
      }

      if (event.phase === "down") {
        if (distance(point.x, point.y, 0.965, 0.085) <= 0.075) {
          closeWithTransition();
          return;
        }
        if (hitRect(point.x, point.y, 0.02, 0.82, 0.25, 0.18)) {
          if (activeRef.current.some(Boolean)) reset();
          return;
        }
        if (hitRect(point.x, point.y, 0.73, 0.82, 0.27, 0.18)) {
          if (activeRef.current.every(Boolean)) continueWithTransition();
          return;
        }
        const index = beamAtPoint(point.x, point.y);
        if (index < 0) return;
        activePointer.current = {
          pointerId: event.pointerId,
          startBeam: index,
          lastBeam: index,
          startX: point.x,
          startY: point.y,
          moved: false,
        };
        hoverBeam.current = index;
        syncSceneBeams();
        schedulePaint();
        return;
      }

      if (event.phase === "cancel") {
        activePointer.current = null;
        hoverBeam.current = null;
        hoverControl.current = null;
        syncSceneBeams();
        schedulePaint();
        return;
      }

      if (event.phase !== "up") return;
      const pointer = activePointer.current;
      activePointer.current = null;
      if (pointer?.pointerId === event.pointerId && !pointer.moved) toggleBeam(pointer.startBeam);
      hoverBeam.current = null;
      syncSceneBeams();
      schedulePaint();
    };
    registerSceneInteraction("stage", handleSceneInput);
    return () => registerSceneInteraction("stage", null);
  }, [activateBeam, closeWithTransition, continueWithTransition, reset, schedulePaint, syncSceneBeams, toggleBeam]);

  useEffect(() => () => {
    if (renderFrame.current !== null) window.cancelAnimationFrame(renderFrame.current);
    if (transitionFrame.current !== null) window.cancelAnimationFrame(transitionFrame.current);
    if (finaleFrame.current !== null) window.cancelAnimationFrame(finaleFrame.current);
    if (completionTimer.current !== null) window.clearTimeout(completionTimer.current);
    interactionRuntime.activeBeams = [false, false, false, false, false];
    interactionRuntime.stageComplete = false;
    interactionRuntime.stageVisibility = 0;
  }, []);

  const focusControl = (index: number | null) => {
    keyboardFocus.current = index;
    hoverBeam.current = index !== null && index < beamColors.length ? index : null;
    syncSceneBeams();
    schedulePaint();
  };

  return (
    <div
      className={styles.spatialInteractionSemantics}
      data-stage-spatial-controls
      data-stage-active-count={active.filter(Boolean).length}
      data-stage-complete={active.every(Boolean) ? "true" : "false"}
      role="region"
      aria-label={copy.stations.stage.title}
    >
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        className={styles.textureSource}
        data-stage-canvas
        aria-hidden="true"
      />
      <p>{copy.stations.stage.instruction}</p>
      {beamColors.map((color, index) => (
        <button
          key={color}
          type="button"
          data-stage-beam={index + 1}
          aria-pressed={active[index]}
          onFocus={() => focusControl(index)}
          onBlur={() => focusControl(null)}
          onClick={() => toggleBeam(index)}
        >
          {copy.stage.beam} {index + 1}
        </button>
      ))}
      <button
        type="button"
        disabled={!active.some(Boolean)}
        onFocus={() => focusControl(5)}
        onBlur={() => focusControl(null)}
        onClick={reset}
      >
        {copy.reset}
      </button>
      <button
        type="button"
        disabled={!active.every(Boolean)}
        onFocus={() => focusControl(6)}
        onBlur={() => focusControl(null)}
        onClick={continueWithTransition}
      >
        {copy.continue}
      </button>
      <button
        type="button"
        data-interaction-dismiss
        onFocus={() => focusControl(7)}
        onBlur={() => focusControl(null)}
        onClick={closeWithTransition}
      >
        {copy.close}
      </button>
      <span role="status" aria-live="polite">
        {active.every(Boolean) ? copy.stage.finale : `${active.filter(Boolean).length} / 5`}
      </span>
    </div>
  );
}
