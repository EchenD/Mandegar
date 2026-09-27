"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { interactionSurfaceSizes, sceneTokens } from "../scene-config";
import type { InteractionCopy } from "./interaction-copy";
import {
  markInteractionCanvasDirty,
  registerInteractionCanvas,
  registerSceneInteraction,
} from "./interaction-runtime";
import type { SceneInteractionEvent } from "./interaction-types";
import styles from "./HeroInteractions.module.css";

type Point = { x: number; y: number };
type Stroke = Point[];
type DrawingControl = "close" | "undo" | "clear" | "finish";

const { width: canvasWidth, height: canvasHeight } = interactionSurfaceSizes.main.canvas;
const drawingArea = { left: 0.055, top: 0.205, width: 0.89, height: 0.57 } as const;
const controlDefinitions = [
  { id: "undo", left: 0.055, width: 0.21 },
  { id: "clear", left: 0.28, width: 0.21 },
  { id: "finish", left: 0.68, width: 0.265 },
] as const;

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

function revealProgress(progress: number, start: number, end: number) {
  const value = Math.max(0, Math.min(1, (progress - start) / (end - start)));
  return value * value * (3 - 2 * value);
}

function controlAtPoint(x: number, y: number): DrawingControl | null {
  if (Math.hypot(x - 0.945, y - 0.07) <= 0.045) return "close";
  if (y < 0.83 || y > 0.955) return null;
  const control = controlDefinitions.find(({ left, width }) => hitRect(x, y, left, 0.83, width, 0.125));
  return control?.id ?? null;
}

function pointInDrawingArea(x: number, y: number) {
  return hitRect(x, y, drawingArea.left, drawingArea.top, drawingArea.width, drawingArea.height);
}

function clampDrawingPoint(point: Point) {
  const left = drawingArea.left * canvasWidth;
  const right = (drawingArea.left + drawingArea.width) * canvasWidth;
  const top = drawingArea.top * canvasHeight;
  const bottom = (drawingArea.top + drawingArea.height) * canvasHeight;
  return {
    x: Math.max(left, Math.min(right, point.x)),
    y: Math.max(top, Math.min(bottom, point.y)),
  };
}

export function DrawingInteraction({
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
  const strokes = useRef<Stroke[]>([]);
  const activeStroke = useRef<Stroke | null>(null);
  const activePointer = useRef<number | null>(null);
  const renderFrame = useRef<number | null>(null);
  const transitionFrame = useRef<number | null>(null);
  const finaleFrame = useRef<number | null>(null);
  const transitionProgress = useRef(0);
  const transitionState = useRef<"intro" | "ready" | "outro">("intro");
  const finaleStartedAt = useRef<number | null>(null);
  const monitorImage = useRef<HTMLImageElement | null>(null);
  const hoverControl = useRef<DrawingControl | null>(null);
  const keyboardFocus = useRef<DrawingControl | null>(null);
  const finishedRef = useRef(false);
  const completionReported = useRef(false);
  const [strokeCount, setStrokeCount] = useState(0);
  const [finished, setFinished] = useState(false);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const width = canvas.width;
    const height = canvas.height;
    const direction = document.documentElement.dir === "rtl" ? "rtl" : "ltr";
    const transition = transitionProgress.current;
    const surfaceReveal = revealProgress(transition, 0, 0.36);
    const contentReveal = revealProgress(transition, 0.2, 0.68);
    const controlsReveal = revealProgress(transition, 0.58, 1);
    const count = strokes.current.length;
    const isFinished = finishedRef.current;
    const finaleElapsed = finaleStartedAt.current === null
      ? 1
      : Math.min(1, (performance.now() - finaleStartedAt.current) / 900);
    const finalePulse = isFinished ? Math.sin(finaleElapsed * Math.PI) : 0;

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
    const background = context.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, "#151a20");
    background.addColorStop(1, "#090d12");
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    roundedRect(context, 18, 18, width - 36, height - 36, 24);
    context.strokeStyle = "rgba(247,247,244,.14)";
    context.lineWidth = 1;
    context.stroke();

    context.save();
    context.globalAlpha = contentReveal;
    context.direction = direction;
    context.textAlign = "center";
    context.fillStyle = "#75d8ff";
    context.font = '700 13px "Vazirmatn Variable", Tahoma, sans-serif';
    context.fillText("MANDEGAR", width / 2, 37);
    context.fillStyle = "#f7f7f4";
    context.font = '620 30px "Vazirmatn Variable", Tahoma, sans-serif';
    context.fillText(isFinished ? copy.draw.complete : copy.stations.draw.title, width / 2, 78, width - 170);
    context.fillStyle = "rgba(247,247,244,.56)";
    context.font = '500 17px "Vazirmatn Variable", Tahoma, sans-serif';
    context.fillText(copy.draw.local, width / 2, 107, width - 170);
    context.restore();

    context.fillStyle = "rgba(247,247,244,.14)";
    context.fillRect(56, 126, width - 112, 1);

    const areaLeft = drawingArea.left * width;
    const areaTop = drawingArea.top * height;
    const areaWidth = drawingArea.width * width;
    const areaHeight = drawingArea.height * height;
    roundedRect(context, areaLeft, areaTop, areaWidth, areaHeight, 22);
    context.fillStyle = "rgba(3,7,12,.48)";
    context.shadowColor = isFinished ? "rgba(117,216,255,.3)" : "transparent";
    context.shadowBlur = finalePulse * 22;
    context.fill();
    context.shadowBlur = 0;
    context.strokeStyle = isFinished
      ? `rgba(117,216,255,${0.4 + finalePulse * 0.3})`
      : "rgba(247,247,244,.2)";
    context.lineWidth = 1.5;
    context.stroke();

    context.save();
    roundedRect(context, areaLeft, areaTop, areaWidth, areaHeight, 22);
    context.clip();
    context.globalAlpha = contentReveal;
    context.lineCap = "round";
    context.lineJoin = "round";
    strokes.current.forEach((stroke) => {
      if (stroke.length === 0) return;
      context.beginPath();
      context.moveTo(stroke[0].x, stroke[0].y);
      stroke.slice(1).forEach((point) => context.lineTo(point.x, point.y));
      if (stroke.length === 1) {
        context.lineTo(stroke[0].x + 0.01, stroke[0].y + 0.01);
      }
      context.strokeStyle = "rgba(34,92,255,.36)";
      context.lineWidth = 16;
      context.shadowColor = "#225cff";
      context.shadowBlur = 14;
      context.stroke();
      context.strokeStyle = "#e7f7ff";
      context.lineWidth = 5;
      context.shadowColor = "transparent";
      context.shadowBlur = 0;
      context.stroke();
    });
    context.shadowBlur = 0;

    if (count === 0) {
      context.direction = direction;
      context.textAlign = "center";
      context.fillStyle = "rgba(247,247,244,.42)";
      context.font = '500 19px "Vazirmatn Variable", Tahoma, sans-serif';
      context.fillText(copy.stations.draw.instruction, width / 2, areaTop + areaHeight / 2, areaWidth - 100);
      context.strokeStyle = "rgba(117,216,255,.48)";
      context.lineWidth = 1.5;
      context.beginPath();
      context.arc(width / 2, areaTop + areaHeight / 2 + 44, 12, 0, Math.PI * 2);
      context.stroke();
    }
    context.restore();

    const closeFocused = hoverControl.current === "close" || keyboardFocus.current === "close";
    context.fillStyle = closeFocused ? "rgba(117,216,255,.15)" : "rgba(247,247,244,.06)";
    context.beginPath();
    context.arc(width * 0.945, height * 0.07, 25, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = closeFocused ? "#75d8ff" : "rgba(247,247,244,.3)";
    context.lineWidth = closeFocused ? 3 : 1.5;
    context.stroke();
    context.strokeStyle = "#f7f7f4";
    context.lineWidth = 1.7;
    context.beginPath();
    context.moveTo(width * 0.945 - 6, height * 0.07 - 6);
    context.lineTo(width * 0.945 + 6, height * 0.07 + 6);
    context.moveTo(width * 0.945 + 6, height * 0.07 - 6);
    context.lineTo(width * 0.945 - 6, height * 0.07 + 6);
    context.stroke();

    const labels: Record<(typeof controlDefinitions)[number]["id"], string> = {
      undo: copy.undo,
      clear: copy.clear,
      finish: isFinished ? copy.continue : copy.finish,
    };
    context.save();
    context.globalAlpha = controlsReveal;
    controlDefinitions.forEach(({ id, left, width: controlWidth }) => {
      const enabled = id === "finish" ? count > 0 : count > 0 && !isFinished;
      const focused = hoverControl.current === id || keyboardFocus.current === id;
      const x = left * width;
      const y = 0.83 * height;
      const buttonWidth = controlWidth * width;
      const buttonHeight = 0.105 * height;
      roundedRect(context, x, y, buttonWidth, buttonHeight, buttonHeight / 2);
      context.fillStyle = id === "finish" && enabled
        ? "#225cff"
        : focused
          ? "rgba(117,216,255,.1)"
          : "rgba(247,247,244,.04)";
      context.fill();
      context.strokeStyle = focused
        ? "#75d8ff"
        : enabled
          ? "rgba(247,247,244,.42)"
          : "rgba(247,247,244,.17)";
      context.lineWidth = focused ? 2.5 : 1.5;
      context.stroke();
      context.direction = direction;
      context.textAlign = "center";
      context.fillStyle = enabled ? "#f7f7f4" : "rgba(247,247,244,.38)";
      context.font = '680 21px "Vazirmatn Variable", Tahoma, sans-serif';
      context.fillText(labels[id], x + buttonWidth / 2, y + buttonHeight * 0.62, buttonWidth - 24);
    });
    context.restore();
    context.restore();

    markInteractionCanvasDirty("main");
  }, [copy]);

  const schedulePaint = useCallback(() => {
    if (renderFrame.current !== null) return;
    renderFrame.current = window.requestAnimationFrame(() => {
      renderFrame.current = null;
      paint();
    });
  }, [paint]);

  const updateStrokeCount = useCallback(() => {
    setStrokeCount(strokes.current.length);
    schedulePaint();
  }, [schedulePaint]);

  const cancelActiveStroke = useCallback(() => {
    activePointer.current = null;
    activeStroke.current = null;
  }, []);

  const beginStroke = useCallback((point: Point, pointerId: number) => {
    if (activePointer.current !== null || finishedRef.current) return;
    const nextStroke = [clampDrawingPoint(point)];
    activePointer.current = pointerId;
    activeStroke.current = nextStroke;
    strokes.current.push(nextStroke);
    updateStrokeCount();
  }, [updateStrokeCount]);

  const queuePoint = useCallback((point: Point) => {
    const stroke = activeStroke.current;
    if (!stroke) return;
    const nextPoint = clampDrawingPoint(point);
    const previous = stroke.at(-1);
    if (previous && Math.hypot(nextPoint.x - previous.x, nextPoint.y - previous.y) < 1.25) return;
    stroke.push(nextPoint);
    schedulePaint();
  }, [schedulePaint]);

  const finishStroke = useCallback((pointerId: number) => {
    if (activePointer.current !== pointerId) return;
    cancelActiveStroke();
    schedulePaint();
  }, [cancelActiveStroke, schedulePaint]);

  const undo = useCallback(() => {
    if (finishedRef.current || strokes.current.length === 0) return;
    cancelActiveStroke();
    strokes.current.pop();
    updateStrokeCount();
  }, [cancelActiveStroke, updateStrokeCount]);

  const clear = useCallback(() => {
    if (finishedRef.current || strokes.current.length === 0) return;
    cancelActiveStroke();
    strokes.current = [];
    updateStrokeCount();
  }, [cancelActiveStroke, updateStrokeCount]);

  const startFinale = useCallback(() => {
    if (finaleFrame.current !== null) window.cancelAnimationFrame(finaleFrame.current);
    finaleStartedAt.current = performance.now();
    const tick = () => {
      paint();
      if (finaleStartedAt.current !== null && performance.now() - finaleStartedAt.current < 900) {
        finaleFrame.current = window.requestAnimationFrame(tick);
      } else {
        finaleFrame.current = null;
      }
    };
    finaleFrame.current = window.requestAnimationFrame(tick);
  }, [paint]);

  const completeDrawing = useCallback(() => {
    if (strokes.current.length === 0 || finishedRef.current) return;
    cancelActiveStroke();
    finishedRef.current = true;
    setFinished(true);
    startFinale();
    if (!completionReported.current) {
      completionReported.current = true;
      onComplete();
    }
  }, [cancelActiveStroke, onComplete, startFinale]);

  const animateTransition = useCallback((target: 0 | 1, onFinish?: () => void) => {
    if (transitionFrame.current !== null) window.cancelAnimationFrame(transitionFrame.current);
    const from = transitionProgress.current;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reducedMotion ? 0 : target === 1 ? 950 : 620;
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
    cancelActiveStroke();
    hoverControl.current = null;
    animateTransition(0, callback);
  }, [animateTransition, cancelActiveStroke]);

  const handleControl = useCallback((control: DrawingControl) => {
    if (control === "close") {
      exitWithTransition(onClose);
    } else if (control === "undo") {
      undo();
    } else if (control === "clear") {
      clear();
    } else if (finishedRef.current) {
      exitWithTransition(onContinue);
    } else {
      completeDrawing();
    }
  }, [clear, completeDrawing, exitWithTransition, onClose, onContinue, undo]);

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
      paint();
      registerInteractionCanvas("main", canvas);
      animateTransition(1);
    };
    image.onload = begin;
    image.onerror = begin;
    image.src = sceneTokens.bakedScene.screens.main;
    if (image.complete) begin();
    void document.fonts?.ready.then(() => {
      if (mounted) schedulePaint();
    });
    return () => {
      mounted = false;
      image.onload = null;
      image.onerror = null;
      registerInteractionCanvas("main", null);
    };
  }, [animateTransition, paint, schedulePaint]);

  useEffect(() => {
    const handleSceneInput = (event: SceneInteractionEvent) => {
      if (transitionState.current !== "ready" || event.phase === "activate") return;
      const control = controlAtPoint(event.x, event.y);
      if (event.phase === "move") {
        if (activePointer.current === event.pointerId && activeStroke.current) {
          queuePoint({ x: event.x * canvasWidth, y: event.y * canvasHeight });
          return;
        }
        hoverControl.current = control;
        schedulePaint();
        return;
      }
      if (event.phase === "down") {
        if (control) {
          handleControl(control);
          return;
        }
        if (pointInDrawingArea(event.x, event.y)) {
          beginStroke(
            { x: event.x * canvasWidth, y: event.y * canvasHeight },
            event.pointerId,
          );
        }
        return;
      }
      if (event.phase === "cancel") {
        finishStroke(event.pointerId);
        hoverControl.current = null;
        schedulePaint();
        return;
      }
      if (event.phase === "up") finishStroke(event.pointerId);
    };
    registerSceneInteraction("draw", handleSceneInput);
    return () => registerSceneInteraction("draw", null);
  }, [beginStroke, finishStroke, handleControl, queuePoint, schedulePaint]);

  useEffect(() => () => {
    if (renderFrame.current !== null) window.cancelAnimationFrame(renderFrame.current);
    if (transitionFrame.current !== null) window.cancelAnimationFrame(transitionFrame.current);
    if (finaleFrame.current !== null) window.cancelAnimationFrame(finaleFrame.current);
  }, []);

  const focusControl = (control: DrawingControl | null) => {
    keyboardFocus.current = control;
    schedulePaint();
  };

  return (
    <>
      <div
        className={styles.spatialInteractionSemantics}
        data-drawing-spatial-controls
        data-stroke-count={strokeCount}
        data-drawing-finished={finished ? "true" : "false"}
        role="region"
        aria-label={copy.stations.draw.title}
      >
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          className={styles.textureSource}
          data-drawing-canvas
          aria-hidden="true"
        />
        <p>{copy.stations.draw.instruction}</p>
        <button type="button" disabled={strokeCount === 0 || finished} onFocus={() => focusControl("undo")} onBlur={() => focusControl(null)} onClick={undo}>{copy.undo}</button>
        <button type="button" disabled={strokeCount === 0 || finished} onFocus={() => focusControl("clear")} onBlur={() => focusControl(null)} onClick={clear}>{copy.clear}</button>
        <button type="button" data-interaction-continue disabled={strokeCount === 0} onFocus={() => focusControl("finish")} onBlur={() => focusControl(null)} onClick={() => handleControl("finish")}>{finished ? copy.continue : copy.finish}</button>
        <button type="button" data-interaction-dismiss onFocus={() => focusControl("close")} onBlur={() => focusControl(null)} onClick={() => handleControl("close")}>{copy.close}</button>
        <span role="status" aria-live="polite">{finished ? copy.draw.complete : `${strokeCount}`}</span>
      </div>
      <div className={styles.mobileDrawingDock} data-mobile-drawing-dock role="group" aria-label={copy.stations.draw.title}>
        <div className={styles.mobileDrawingDockHeader}>
          <strong>{copy.stations.draw.title}</strong>
          <span role="status" aria-live="polite">{finished ? copy.draw.complete : `${strokeCount}`}</span>
        </div>
        <div className={styles.mobileDrawingActions}>
          <button type="button" disabled={strokeCount === 0 || finished} onClick={undo}>{copy.undo}</button>
          <button type="button" disabled={strokeCount === 0 || finished} onClick={clear}>{copy.clear}</button>
          <button type="button" data-mobile-drawing-finish disabled={strokeCount === 0} onClick={() => handleControl("finish")}>{finished ? copy.continue : copy.finish}</button>
        </div>
      </div>
    </>
  );
}
