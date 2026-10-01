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
import { getVisitorCreation, saveComposer } from "./visitor-creation";
import styles from "./HeroInteractions.module.css";

const { width: canvasWidth, height: canvasHeight } = interactionSurfaceSizes.interactive.canvas;
const center = { x: 0.5, y: 0.45 };
const elementDefinitions = [
  { id: "space", x: 0.2, y: 0.67 },
  { id: "story", x: 0.5, y: 0.71 },
  { id: "people", x: 0.8, y: 0.67 },
] as const;

type ComposerPointer = {
  pointerId: number;
  elementIndex: number | null;
  startX: number;
  startY: number;
  x: number;
  y: number;
};

function distance(firstX: number, firstY: number, secondX: number, secondY: number) {
  return Math.hypot(firstX - secondX, firstY - secondY);
}

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

function scenePoint(event: SceneInteractionEvent) {
  return {
    x: event.x,
    y: event.y,
  };
}

function revealProgress(progress: number, start: number, end: number) {
  const value = Math.max(0, Math.min(1, (progress - start) / (end - start)));
  return value * value * (3 - 2 * value);
}

export function TouchComposerInteraction({
  copy,
  onClose,
  onComplete,
  onReset,
  onContinue,
}: {
  copy: InteractionCopy;
  onClose: () => void;
  onComplete: () => void;
  onReset: () => void;
  onContinue: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderFrame = useRef<number | null>(null);
  const transitionFrame = useRef<number | null>(null);
  const transitionProgress = useRef(0);
  const transitionState = useRef<"intro" | "ready" | "outro">("intro");
  const monitorImage = useRef<HTMLImageElement | null>(null);
  const completionTimer = useRef<number | null>(null);
  const sceneInputCount = useRef(0);
  const activePointer = useRef<ComposerPointer | null>(null);
  const selectedRef = useRef([false, false, false]);
  const completeRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const onResetRef = useRef(onReset);
  const hoverElement = useRef<number | null>(null);
  const hoverControl = useRef<"close" | "reset" | "continue" | null>(null);
  const keyboardFocus = useRef<number | null>(null);
  const [selected, setSelected] = useState([false, false, false]);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    onResetRef.current = onReset;
  }, [onComplete, onReset]);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const width = canvas.width;
    const height = canvas.height;
    const direction = document.documentElement.dir === "rtl" ? "rtl" : "ltr";
    const selectedElements = selectedRef.current;
    const pointer = activePointer.current;
    const selectedCount = selectedElements.filter(Boolean).length;
    const isComplete = selectedCount === elementDefinitions.length;
    const transition = transitionProgress.current;
    const surfaceOpacity = revealProgress(transition, 0, 0.34);
    const centerReveal = revealProgress(transition, 0.18, 0.58);
    const elementReveals = elementDefinitions.map((_, index) => (
      revealProgress(transition, 0.34 + index * 0.09, 0.68 + index * 0.09)
    ));
    const controlsReveal = revealProgress(transition, 0.72, 1);
    interactionRuntime.touchVisibility = transition;

    context.clearRect(0, 0, width, height);
    canvas.dataset.transitionProgress = transition.toFixed(3);
    if (monitorImage.current?.complete) {
      context.drawImage(monitorImage.current, 0, 0, width, height);
    } else {
      context.fillStyle = "#ede2da";
      context.fillRect(0, 0, width, height);
    }

    context.save();
    context.globalAlpha = surfaceOpacity;
    const background = context.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, "#fafaf7");
    background.addColorStop(1, "#e8eceb");
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    roundedRect(context, 14, 14, width - 28, height - 28, 22);
    context.strokeStyle = "rgba(22,25,29,.12)";
    context.lineWidth = 1;
    context.stroke();

    context.save();
    context.direction = direction;
    context.textAlign = "center";
    context.fillStyle = "#225cff";
    context.font = '700 13px "Vazirmatn Variable", Tahoma, sans-serif';
    context.fillText("MANDEGAR", width / 2, 37);
    context.fillStyle = "#16191d";
    context.font = '620 38px "Vazirmatn Variable", Tahoma, sans-serif';
    context.fillText(copy.stations.touch.title, width / 2, 78, width - 180);
    context.fillStyle = "rgba(22,25,29,.6)";
    context.font = '500 22px "Vazirmatn Variable", Tahoma, sans-serif';
    context.fillText(isComplete ? copy.touch.complete : copy.touch.instruction, width / 2, 109, width - 150);
    context.restore();

    context.fillStyle = "rgba(22,25,29,.12)";
    context.fillRect(56, 126, width - 112, 1);
    context.restore();

    const centerX = center.x * width;
    const centerY = center.y * height;
    elementDefinitions.forEach((definition, index) => {
      if (!selectedElements[index]) return;
      context.save();
      context.globalAlpha = surfaceOpacity * centerReveal * elementReveals[index];
      const sourceX = definition.x * width;
      const sourceY = definition.y * height;
      context.strokeStyle = "rgba(34,92,255,.58)";
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(sourceX, sourceY);
      context.quadraticCurveTo(
        (sourceX + centerX) / 2,
        Math.min(sourceY, centerY) - 54,
        centerX,
        centerY,
      );
      context.stroke();
      context.restore();
    });

    context.save();
    context.globalAlpha = surfaceOpacity * centerReveal;
    context.fillStyle = "#fff";
    context.shadowColor = "rgba(22,25,29,.1)";
    context.shadowBlur = 30;
    context.beginPath();
    context.arc(centerX, centerY, 62, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;

    const ringGradient = context.createRadialGradient(centerX, centerY, 8, centerX, centerY, 100);
    ringGradient.addColorStop(0, isComplete ? "rgba(34,92,255,.15)" : "rgba(34,92,255,.07)");
    ringGradient.addColorStop(1, "rgba(34,92,255,0)");
    context.fillStyle = ringGradient;
    context.beginPath();
    context.arc(centerX, centerY, 100, 0, Math.PI * 2);
    context.fill();

    elementDefinitions.forEach((_, index) => {
      const segmentSize = Math.PI * 2 / elementDefinitions.length;
      const start = -Math.PI / 2 + index * segmentSize + 0.12;
      const end = start + segmentSize - 0.24;
      const active = selectedElements[index];
      context.strokeStyle = active ? "#225cff" : "rgba(22,25,29,.12)";
      context.lineWidth = active ? 6 : 4;
      context.lineCap = "round";
      context.beginPath();
      context.arc(centerX, centerY, 66, start, end);
      context.stroke();
    });
    context.lineCap = "butt";
    context.beginPath();
    context.shadowBlur = 0;
    context.strokeStyle = isComplete ? "#225cff" : "rgba(22,25,29,.2)";
    context.lineWidth = 1.5;
    context.arc(centerX, centerY, 50, 0, Math.PI * 2);
    context.stroke();
    if (isComplete) {
      context.strokeStyle = "#225cff";
      context.lineWidth = 6;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.beginPath();
      context.moveTo(centerX - 18, centerY);
      context.lineTo(centerX - 4, centerY + 14);
      context.lineTo(centerX + 24, centerY - 17);
      context.stroke();
      context.lineCap = "butt";
      context.lineJoin = "miter";
    } else {
      context.fillStyle = "#16191d";
      context.font = '720 38px "Vazirmatn Variable", Tahoma, sans-serif';
      context.textAlign = "center";
      context.fillText(String(selectedCount), centerX, centerY + 8);
      context.fillStyle = "rgba(22,25,29,.48)";
      context.font = '650 13px "Vazirmatn Variable", Tahoma, sans-serif';
      context.fillText("/ 03", centerX, centerY + 29);
    }
    context.restore();

    elementDefinitions.forEach((definition, index) => {
      const dragging = pointer?.elementIndex === index;
      const x = (dragging ? pointer.x : definition.x) * width;
      const y = (dragging ? pointer.y : definition.y) * height;
      const active = selectedElements[index];
      const focused = hoverElement.current === index || keyboardFocus.current === index;
      const elementReveal = elementReveals[index];
      context.save();
      context.globalAlpha = surfaceOpacity * elementReveal;
      context.translate(x, y);
      context.scale(0.82 + elementReveal * 0.18, 0.82 + elementReveal * 0.18);
      context.translate(-x, -y);
      context.fillStyle = active ? "#e9eeff" : "#fff";
      context.strokeStyle = active || focused || dragging ? "#225cff" : "rgba(22,25,29,.2)";
      context.lineWidth = focused || dragging ? 4 : active ? 3 : 1.5;
      context.shadowColor = "rgba(22,25,29,.11)";
      context.shadowBlur = focused || dragging ? 26 : 16;
      context.beginPath();
      context.arc(x, y, 56, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.shadowBlur = 0;
      context.fillStyle = active ? "#225cff" : "rgba(22,25,29,.42)";
      context.font = '700 13px "Vazirmatn Variable", Tahoma, sans-serif';
      context.textAlign = "center";
      context.fillText(String(index + 1).padStart(2, "0"), x, y - 72);
      if (active) {
        context.fillStyle = "#225cff";
        context.beginPath();
        context.arc(x + 39, y - 39, 13, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = "#fff";
        context.lineWidth = 3;
        context.lineCap = "round";
        context.beginPath();
        context.moveTo(x + 33, y - 39);
        context.lineTo(x + 38, y - 34);
        context.lineTo(x + 46, y - 44);
        context.stroke();
        context.lineCap = "butt";
      }
      context.direction = direction;
      context.fillStyle = "#16191d";
      context.font = '700 26px "Vazirmatn Variable", Tahoma, sans-serif';
      context.textAlign = "center";
      context.fillText(copy.touch.elements[index], x, y + 7, 98);
      context.restore();
    });

    context.save();
    context.globalAlpha = surfaceOpacity;
    const closeX = width * 0.94;
    const closeY = height * 0.09;
    const closeFocused = keyboardFocus.current === 5 || hoverControl.current === "close";
    context.fillStyle = closeFocused ? "#e9eeff" : "rgba(255,255,255,.88)";
    context.beginPath();
    context.arc(closeX, closeY, 24, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = closeFocused ? "#225cff" : "rgba(22,25,29,.28)";
    context.lineWidth = closeFocused ? 3 : 1.5;
    context.stroke();
    context.strokeStyle = "#16191d";
    context.lineWidth = 2;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(closeX - 7, closeY - 7);
    context.lineTo(closeX + 7, closeY + 7);
    context.moveTo(closeX + 7, closeY - 7);
    context.lineTo(closeX - 7, closeY + 7);
    context.stroke();
    context.lineCap = "butt";
    context.restore();

    const drawButton = (
      left: number,
      label: string,
      enabled: boolean,
      focused: boolean,
      primary = false,
    ) => {
      const top = height * 0.84;
      const buttonWidth = width * 0.235;
      const buttonHeight = height * 0.105;
      roundedRect(context, left, top, buttonWidth, buttonHeight, buttonHeight / 2);
      context.fillStyle = primary && enabled ? "#225cff" : "rgba(255,255,255,.86)";
      context.fill();
      context.strokeStyle = focused
        ? "#225cff"
        : enabled
          ? "rgba(22,25,29,.28)"
          : "rgba(22,25,29,.12)";
      context.lineWidth = focused ? 3 : 1.5;
      context.stroke();
      context.fillStyle = primary && enabled ? "#fff" : enabled ? "#16191d" : "rgba(22,25,29,.38)";
      context.direction = direction;
      context.font = '700 22px "Vazirmatn Variable", Tahoma, sans-serif';
      context.textAlign = "center";
      context.fillText(label, left + buttonWidth / 2, top + buttonHeight * 0.64, buttonWidth - 38);
      if (primary && enabled) {
        const directionSign = direction === "rtl" ? -1 : 1;
        const arrowX = direction === "rtl" ? left + 25 : left + buttonWidth - 25;
        const arrowY = top + buttonHeight / 2;
        context.strokeStyle = "#fff";
        context.lineWidth = 2;
        context.lineCap = "round";
        context.lineJoin = "round";
        context.beginPath();
        context.moveTo(arrowX - directionSign * 5, arrowY - 5);
        context.lineTo(arrowX, arrowY);
        context.lineTo(arrowX - directionSign * 5, arrowY + 5);
        context.stroke();
        context.lineCap = "butt";
        context.lineJoin = "miter";
      }
    };
    context.save();
    context.globalAlpha = surfaceOpacity * controlsReveal;
    drawButton(
      width * 0.055,
      copy.reset,
      selectedCount > 0,
      keyboardFocus.current === 3 || hoverControl.current === "reset",
    );
    drawButton(
      width * 0.71,
      copy.continue,
      isComplete,
      keyboardFocus.current === 4 || hoverControl.current === "continue",
      true,
    );
    context.restore();

    markInteractionCanvasDirty("interactive");
  }, [copy]);

  const schedulePaint = useCallback(() => {
    if (renderFrame.current !== null) return;
    renderFrame.current = window.requestAnimationFrame(() => {
      renderFrame.current = null;
      paint();
    });
  }, [paint]);

  const animateTransition = useCallback((target: 0 | 1, onFinish?: () => void) => {
    if (transitionFrame.current !== null) window.cancelAnimationFrame(transitionFrame.current);
    const from = transitionProgress.current;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reducedMotion ? 0 : target === 1 ? 550 : 380;
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
      transitionProgress.current = from + (target - from) * elapsed;
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
    hoverElement.current = null;
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

  const reset = useCallback(() => {
    if (completionTimer.current !== null) window.clearTimeout(completionTimer.current);
    completionTimer.current = null;
    const wasComplete = completeRef.current;
    selectedRef.current = [false, false, false];
    interactionRuntime.touchElements = [false, false, false];
    saveComposer([false, false, false]);
    completeRef.current = false;
    activePointer.current = null;
    setSelected([false, false, false]);
    setComplete(false);
    schedulePaint();
    if (wasComplete) onResetRef.current();
  }, [schedulePaint]);

  const activateElement = useCallback((index: number) => {
    if (selectedRef.current[index]) return;
    const next = [...selectedRef.current];
    next[index] = true;
    selectedRef.current = next;
    interactionRuntime.touchElements = [...next];
    saveComposer(next);
    setSelected(next);
    const finished = next.every(Boolean);
    if (finished && !completeRef.current) {
      completeRef.current = true;
      setComplete(true);
      completionTimer.current = window.setTimeout(() => {
        completionTimer.current = null;
        onCompleteRef.current();
      }, 320);
    }
    schedulePaint();
  }, [schedulePaint]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    interactionRuntime.touchElements = [...selectedRef.current];
    let active = true;
    let registered = false;
    const image = new Image();
    const begin = () => {
      if (!active || registered) return;
      registered = true;
      monitorImage.current = image.naturalWidth > 0 ? image : null;
      transitionProgress.current = 0;
      paint();
      registerInteractionCanvas("interactive", canvas);
      animateTransition(1);
    };
    image.onload = begin;
    image.onerror = begin;
    image.src = sceneTokens.bakedScene.screens.interactive;
    if (image.complete) begin();
    void document.fonts?.ready.then(() => {
      if (active) schedulePaint();
    });
    return () => {
      active = false;
      image.onload = null;
      image.onerror = null;
      registerInteractionCanvas("interactive", null);
    };
  }, [animateTransition, paint, schedulePaint]);

  useEffect(() => {
    const handleSceneInput = (event: SceneInteractionEvent) => {
      sceneInputCount.current += 1;
      if (canvasRef.current) {
        canvasRef.current.dataset.sceneInputCount = String(sceneInputCount.current);
      }
      if (transitionState.current !== "ready") return;
      const point = scenePoint(event);
      if (event.phase === "move") {
        const pointer = activePointer.current;
        if (pointer?.pointerId === event.pointerId && pointer.elementIndex !== null) {
          pointer.x = point.x;
          pointer.y = point.y;
          schedulePaint();
          return;
        }
        hoverControl.current = distance(point.x, point.y, 0.94, 0.09) <= 0.1
          ? "close"
          : hitRect(point.x, point.y, 0.02, 0.8, 0.32, 0.2)
            ? "reset"
            : hitRect(point.x, point.y, 0.66, 0.8, 0.34, 0.2)
              ? "continue"
              : null;
        hoverElement.current = hoverControl.current === null
          ? elementDefinitions.findIndex((definition, index) => (
            !selectedRef.current[index]
            && distance(point.x, point.y, definition.x, definition.y) <= 0.115
          ))
          : null;
        if (hoverElement.current !== null && hoverElement.current < 0) hoverElement.current = null;
        schedulePaint();
        return;
      }

      if (event.phase === "down") {
        if (distance(point.x, point.y, 0.94, 0.09) <= 0.1) {
          closeWithTransition();
          return;
        }
        if (hitRect(point.x, point.y, 0.02, 0.8, 0.32, 0.2)) {
          reset();
          return;
        }
        if (
          completeRef.current
          && hitRect(point.x, point.y, 0.66, 0.8, 0.34, 0.2)
        ) {
          continueWithTransition();
          return;
        }
        const elementIndex = elementDefinitions.findIndex((definition, index) => (
          !selectedRef.current[index]
          && distance(point.x, point.y, definition.x, definition.y) <= 0.115
        ));
        activePointer.current = {
          pointerId: event.pointerId,
          elementIndex: elementIndex >= 0 ? elementIndex : null,
          startX: point.x,
          startY: point.y,
          x: point.x,
          y: point.y,
        };
        schedulePaint();
        return;
      }

      if (event.phase === "cancel") {
        activePointer.current = null;
        hoverElement.current = null;
        hoverControl.current = null;
        schedulePaint();
        return;
      }

      if (event.phase !== "up") return;
      const pointer = activePointer.current;
      activePointer.current = null;
      if (!pointer || pointer.pointerId !== event.pointerId) {
        schedulePaint();
        return;
      }
      if (pointer.elementIndex !== null) {
        const travelled = distance(point.x, point.y, pointer.startX, pointer.startY);
        const reachedCenter = distance(point.x, point.y, center.x, center.y) <= 0.18;
        if (travelled <= 0.045 || reachedCenter) activateElement(pointer.elementIndex);
      }
      schedulePaint();
    };
    registerSceneInteraction("touch", handleSceneInput);
    return () => registerSceneInteraction("touch", null);
  }, [activateElement, closeWithTransition, continueWithTransition, reset, schedulePaint]);

  useEffect(() => () => {
    if (renderFrame.current !== null) window.cancelAnimationFrame(renderFrame.current);
    if (transitionFrame.current !== null) window.cancelAnimationFrame(transitionFrame.current);
    if (completionTimer.current !== null) window.clearTimeout(completionTimer.current);
    interactionRuntime.touchElements = [...getVisitorCreation().composer];
    interactionRuntime.touchVisibility = 0;
  }, []);

  const focusControl = (index: number | null) => {
    keyboardFocus.current = index;
    schedulePaint();
  };

  return (
    <div
      className={styles.spatialInteractionSemantics}
      data-touch-spatial-controls
      data-touch-selected-count={selected.filter(Boolean).length}
      data-touch-complete={complete ? "true" : "false"}
      role="region"
      aria-label={copy.stations.touch.title}
    >
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        className={styles.textureSource}
        data-composer-canvas
        aria-hidden="true"
      />
      <p>{copy.touch.instruction}</p>
      {copy.touch.elements.map((label, index) => (
        <button
          key={elementDefinitions[index].id}
          type="button"
          data-touch-element={elementDefinitions[index].id}
          aria-pressed={selected[index]}
          onFocus={() => focusControl(index)}
          onBlur={() => focusControl(null)}
          onClick={() => activateElement(index)}
        >
          {label}
        </button>
      ))}
      <button
        type="button"
        disabled={!selected.some(Boolean)}
        onFocus={() => focusControl(3)}
        onBlur={() => focusControl(null)}
        onClick={reset}
      >
        {copy.reset}
      </button>
      <button
        type="button"
        data-interaction-continue
        disabled={!complete}
        onFocus={() => focusControl(4)}
        onBlur={() => focusControl(null)}
        onClick={continueWithTransition}
      >
        {copy.continue}
      </button>
      <button
        type="button"
        data-interaction-dismiss
        onFocus={() => focusControl(5)}
        onBlur={() => focusControl(null)}
        onClick={closeWithTransition}
      >
        {copy.close}
      </button>
      <span role="status" aria-live="polite">
        {complete ? copy.touch.complete : `${selected.filter(Boolean).length} / 3`}
      </span>
    </div>
  );
}
