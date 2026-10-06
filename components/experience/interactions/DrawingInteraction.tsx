"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { interactionSurfaceSizes } from "../scene-config";
import type { InteractionCopy } from "./interaction-copy";
import {
  interactionRuntime,
  markInteractionCanvasDirty,
  registerInteractionCanvas,
  registerSceneInteraction,
} from "./interaction-runtime";
import type { SceneInteractionEvent } from "./interaction-types";
import styles from "./HeroInteractions.module.css";
import { reportInteractionParticipation } from "./interaction-participation";
import { clearDrawing, getDrawingDraft, getVisitorCreation, saveDrawing, saveDrawingDraft } from "./visitor-creation";

type Point = { x: number; y: number };
type Stroke = Point[];
type DrawingControl = "undo" | "clear" | "finish";

const { width: canvasWidth, height: canvasHeight } = interactionSurfaceSizes.main.canvas;
const drawingArea = { left: 0.055, top: 0.205, width: 0.89, height: 0.57 } as const;
const controlDefinitions = [
  { id: "undo", left: 0.055, width: 0.21 },
  { id: "clear", left: 0.28, width: 0.21 },
  { id: "finish", left: 0.68, width: 0.265 },
] as const;

function paintStroke(context: CanvasRenderingContext2D, stroke: Stroke, highlight = false) {
  if (!stroke.length) return;
  context.beginPath();
  context.moveTo(stroke[0].x, stroke[0].y);
  stroke.slice(1).forEach((point) => context.lineTo(point.x, point.y));
  if (stroke.length === 1) context.lineTo(stroke[0].x + .01, stroke[0].y + .01);
  context.strokeStyle = highlight ? "rgba(117,216,255,.2)" : "rgba(34,92,255,.36)";
  context.lineWidth = highlight ? 22 : 16;
  context.shadowColor = "#225cff";
  context.shadowBlur = highlight ? 22 : 14;
  context.stroke();
  if (highlight) return;
  context.strokeStyle = "#e7f7ff";
  context.lineWidth = 5;
  context.shadowColor = "transparent";
  context.shadowBlur = 0;
  context.stroke();
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

function revealProgress(progress: number, start: number, end: number) {
  const value = Math.max(0, Math.min(1, (progress - start) / (end - start)));
  return value * value * (3 - 2 * value);
}

function controlAtPoint(x: number, y: number): DrawingControl | null {
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
  onComplete,
}: {
  copy: InteractionCopy;
  onClose: () => void;
  onComplete: () => void;
  onContinue: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>(getDrawingDraft());
  const activeStroke = useRef<Stroke | null>(null);
  const activePointer = useRef<number | null>(null);
  const capturedPointer = useRef<number | null>(null);
  const renderFrame = useRef<number | null>(null);
  const transitionFrame = useRef<number | null>(null);
  const finaleFrame = useRef<number | null>(null);
  const transitionProgress = useRef(0);
  const transitionState = useRef<"intro" | "ready" | "outro">("intro");
  const finaleStartedAt = useRef<number | null>(null);
  const hoverControl = useRef<DrawingControl | null>(null);
  const keyboardFocus = useRef<DrawingControl | null>(null);
  const finishedRef = useRef(Boolean(getVisitorCreation().drawing));
  const completionReported = useRef(false);
  const replayProgress = useRef(1);
  const savedWall = useRef<HTMLCanvasElement | null>(null);
  const keyboardPoint = useRef<Point>({ x: canvasWidth / 2, y: canvasHeight / 2 });
  const [strokeCount, setStrokeCount] = useState(() => getDrawingDraft().length);
  const [finished, setFinished] = useState(() => Boolean(getVisitorCreation().drawing));

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const width = canvas.width;
    const height = canvas.height;
    const direction = document.documentElement.dir === "rtl" ? "rtl" : "ltr";
    const transition = transitionProgress.current;
    const retainedWall = transitionState.current === "outro" ? savedWall.current : null;
    const interfaceProgress = transitionState.current === "outro" ? 1 : transition;
    const surfaceReveal = revealProgress(interfaceProgress, 0, 0.36);
    const contentReveal = revealProgress(interfaceProgress, 0.2, 0.68);
    const controlsReveal = revealProgress(interfaceProgress, 0.58, 1);
    const count = strokes.current.length;
    const isFinished = finishedRef.current;
    const finaleElapsed = finaleStartedAt.current === null
      ? 1
      : Math.min(1, (performance.now() - finaleStartedAt.current) / 700);
    const finalePulse = isFinished ? Math.sin(finaleElapsed * Math.PI) : 0;

    context.clearRect(0, 0, width, height);
    canvas.dataset.transitionProgress = transition.toFixed(3);
    if (retainedWall) {
      context.drawImage(retainedWall, 0, 0, width, height);
    } else if (transitionState.current === "intro" && savedWall.current) {
      context.drawImage(savedWall.current, 0, 0, width, height);
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
    context.fillText(copy.stations.draw.title, width / 2, 78, width - 170);
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
    context.shadowBlur = isFinished ? 4 + finalePulse * 10 : 0;
    context.fill();
    context.shadowBlur = 0;
    context.strokeStyle = isFinished
      ? `rgba(117,216,255,${0.4 + finalePulse * 0.1})`
      : "rgba(247,247,244,.2)";
    context.lineWidth = 1.5;
    context.stroke();

    context.save();
    roundedRect(context, areaLeft, areaTop, areaWidth, areaHeight, 22);
    context.clip();
    context.globalAlpha = contentReveal;
    context.lineCap = "round";
    context.lineJoin = "round";
    strokes.current.forEach((stroke) => paintStroke(context, stroke));
    if (isFinished && replayProgress.current < 1) {
      let remaining = Math.ceil(strokes.current.reduce((total, stroke) => total + stroke.length, 0) * replayProgress.current);
      context.globalAlpha = contentReveal * finalePulse;
      strokes.current.forEach((stroke) => {
        const visible = remaining >= stroke.length ? stroke : stroke.slice(0, remaining);
        remaining = Math.max(0, remaining - stroke.length);
        paintStroke(context, visible, true);
      });
      context.globalAlpha = contentReveal;
    }
    context.shadowBlur = 0;

    if (document.activeElement === canvas && !isFinished) {
      const point = keyboardPoint.current;
      context.strokeStyle = "#75d8ff";
      context.lineWidth = 2;
      context.beginPath();
      context.arc(point.x, point.y, 10, 0, Math.PI * 2);
      context.stroke();
    }

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

    const labels: Record<(typeof controlDefinitions)[number]["id"], string> = {
      undo: copy.undo,
      clear: copy.clear,
      finish: copy.finish,
    };
    context.save();
    context.globalAlpha = controlsReveal;
    controlDefinitions.forEach(({ id, left, width: controlWidth }) => {
      if (isFinished) return;
      const enabled = count > 0;
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

    if (retainedWall) {
      context.save();
      context.globalAlpha = 1 - transition;
      context.drawImage(retainedWall, 0, 0, width, height);
      context.restore();
    }

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
    const pointerId = capturedPointer.current ?? activePointer.current;
    capturedPointer.current = null;
    activePointer.current = null;
    activeStroke.current = null;
    if (interactionRuntime.gestureStation === "draw") interactionRuntime.gestureStation = null;
    const surface = canvasRef.current?.closest("[data-experience-root]")?.querySelector<HTMLCanvasElement>("[data-experience-canvas='true']");
    if (pointerId !== null && pointerId >= 0 && surface?.hasPointerCapture(pointerId)) surface.releasePointerCapture(pointerId);
  }, []);

  const beginStroke = useCallback((point: Point, pointerId: number) => {
    if (activePointer.current !== null || finishedRef.current || transitionState.current === "outro") return;
    reportInteractionParticipation("draw");
    if (!strokes.current.length) {
      clearDrawing();
      savedWall.current = null;
    }
    const nextStroke = [clampDrawingPoint(point)];
    activePointer.current = pointerId;
    interactionRuntime.gestureStation = "draw";
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
    reportInteractionParticipation("draw");
    cancelActiveStroke();
    strokes.current.pop();
    updateStrokeCount();
  }, [cancelActiveStroke, updateStrokeCount]);

  const clear = useCallback(() => {
    if (finishedRef.current || strokes.current.length === 0) return;
    reportInteractionParticipation("draw");
    cancelActiveStroke();
    strokes.current = [];
    clearDrawing();
    savedWall.current = null;
    updateStrokeCount();
  }, [cancelActiveStroke, updateStrokeCount]);

  const startFinale = useCallback(() => {
    if (finaleFrame.current !== null) window.cancelAnimationFrame(finaleFrame.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      replayProgress.current = 1;
      paint();
      return;
    }
    finaleStartedAt.current = performance.now();
    replayProgress.current = 0;
    const tick = () => {
      replayProgress.current = Math.min(1, (performance.now() - (finaleStartedAt.current ?? 0)) / 700);
      paint();
      if (replayProgress.current < 1) {
        finaleFrame.current = window.requestAnimationFrame(tick);
      } else {
        finaleFrame.current = null;
        finaleStartedAt.current = null;
        paint();
      }
    };
    finaleFrame.current = window.requestAnimationFrame(tick);
  }, [paint]);

  const completeDrawing = useCallback(() => {
    if (strokes.current.length === 0 || finishedRef.current) return;
    reportInteractionParticipation("draw");
    cancelActiveStroke();
    finishedRef.current = true;
    setFinished(true);
    const artwork = document.createElement("canvas");
    artwork.width = Math.round(drawingArea.width * canvasWidth);
    artwork.height = Math.round(drawingArea.height * canvasHeight);
    const context = artwork.getContext("2d");
    if (context) {
      context.lineCap = "round";
      context.lineJoin = "round";
      context.translate(-drawingArea.left * canvasWidth, -drawingArea.top * canvasHeight);
      strokes.current.forEach((stroke) => paintStroke(context, stroke));
      const wall = document.createElement("canvas");
      wall.width = canvasWidth;
      wall.height = canvasHeight;
      const wallContext = wall.getContext("2d");
      if (wallContext) {
        wallContext.fillStyle = "#090d12";
        wallContext.fillRect(0, 0, canvasWidth, canvasHeight);
        wallContext.drawImage(artwork, drawingArea.left * canvasWidth, drawingArea.top * canvasHeight);
        savedWall.current = wall;
        saveDrawing(artwork, wall);
      }
    }
    startFinale();
    if (!completionReported.current) {
      completionReported.current = true;
      onComplete();
    }
  }, [cancelActiveStroke, onComplete, startFinale]);

  const animateTransition = useCallback((target: 0 | 1) => {
    if (transitionFrame.current !== null) window.cancelAnimationFrame(transitionFrame.current);
    const from = transitionProgress.current;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reducedMotion ? 0 : target === 1 ? 550 : 380;
    transitionState.current = target === 1 ? "intro" : "outro";
    if (duration === 0 || Math.abs(target - from) < 0.001) {
      transitionProgress.current = target;
      transitionState.current = target === 1 ? "ready" : "outro";
      paint();
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
    };
    transitionFrame.current = window.requestAnimationFrame(tick);
  }, [paint]);

  const exitWithTransition = useCallback(() => {
    if (transitionState.current === "outro") return;
    cancelActiveStroke();
    if (finaleFrame.current !== null) window.cancelAnimationFrame(finaleFrame.current);
    finaleFrame.current = null;
    finaleStartedAt.current = null;
    replayProgress.current = 1;
    hoverControl.current = null;
    animateTransition(0);
  }, [animateTransition, cancelActiveStroke]);

  const handleControl = useCallback((control: DrawingControl) => {
    if (finishedRef.current || transitionState.current === "outro") return;
    if (control === "undo") {
      undo();
    } else if (control === "clear") {
      clear();
    } else {
      completeDrawing();
    }
  }, [clear, completeDrawing, undo]);

  useEffect(() => {
    const departure = (event: Event) => {
      if ((event as CustomEvent<{ station?: string }>).detail?.station !== "draw") return;
      if (canvasRef.current) canvasRef.current.dataset.departing = "true";
      exitWithTransition();
    };
    const cancel = () => { cancelActiveStroke(); schedulePaint(); };
    const visibility = () => { if (document.hidden) cancel(); };
    window.addEventListener("mandegar:interaction-departure", departure);
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("mandegar:interaction-departure", departure);
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", visibility);
      cancelActiveStroke();
    };
  }, [cancelActiveStroke, exitWithTransition, schedulePaint]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const experience = canvas.closest("[data-experience-root]");
    savedWall.current = getVisitorCreation().drawingWall;
    let mounted = true;
    let registered = false;
    const begin = () => {
      if (!mounted) return;
      if (transitionState.current === "outro") return;
      if (registered) {
        schedulePaint();
        return;
      }
      registered = true;
      transitionProgress.current = 0;
      paint();
      registerInteractionCanvas("main", canvas);
      animateTransition(1);
    };
    begin();
    void document.fonts?.ready.then(() => {
      if (mounted) schedulePaint();
    });
    return () => {
      mounted = false;
      saveDrawingDraft(strokes.current);
      if (interactionRuntime.monitorEntries.main?.canvas === canvas) {
        registerInteractionCanvas("main", experience?.isConnected ? savedWall.current : null);
      }
    };
  }, [animateTransition, paint, schedulePaint]);

  useEffect(() => {
    const handleSceneInput = (event: SceneInteractionEvent) => {
      if (transitionState.current === "outro" || event.phase === "activate") return;
      const control = finishedRef.current ? null : controlAtPoint(event.x, event.y);
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
        if (capturedPointer.current !== null && capturedPointer.current !== event.pointerId) return;
        capturedPointer.current = event.pointerId;
        if (control) {
          if (transitionState.current === "ready") handleControl(control);
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
        if (capturedPointer.current === event.pointerId) capturedPointer.current = null;
        hoverControl.current = null;
        schedulePaint();
        return;
      }
      if (event.phase === "up") {
        finishStroke(event.pointerId);
        if (capturedPointer.current === event.pointerId) capturedPointer.current = null;
      }
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
          tabIndex={0}
          aria-label={copy.draw.keyboard}
          onFocus={schedulePaint}
          onBlur={() => { finishStroke(-1); schedulePaint(); }}
          onKeyDown={(event) => {
            if (finishedRef.current || transitionState.current !== "ready") return;
            if (event.key === " " || event.key === "Enter") {
              event.preventDefault();
              if (event.repeat) return;
              if (activePointer.current === -1) finishStroke(-1);
              else beginStroke(keyboardPoint.current, -1);
              return;
            }
            const offset = { ArrowLeft: [-18, 0], ArrowRight: [18, 0], ArrowUp: [0, -18], ArrowDown: [0, 18] }[event.key];
            if (!offset) return;
            event.preventDefault();
            keyboardPoint.current = clampDrawingPoint({ x: keyboardPoint.current.x + offset[0], y: keyboardPoint.current.y + offset[1] });
            if (activePointer.current === -1) queuePoint(keyboardPoint.current);
            schedulePaint();
          }}
        />
        {!finished && <>
          <button type="button" disabled={strokeCount === 0} onFocus={() => focusControl("undo")} onBlur={() => focusControl(null)} onClick={undo}>{copy.undo}</button>
          <button type="button" disabled={strokeCount === 0} onFocus={() => focusControl("clear")} onBlur={() => focusControl(null)} onClick={clear}>{copy.clear}</button>
          <button type="button" data-drawing-finish data-interaction-continue disabled={strokeCount === 0} onFocus={() => focusControl("finish")} onBlur={() => focusControl(null)} onClick={() => handleControl("finish")}>{copy.finish}</button>
        </>}
        <span role="status" aria-live="polite">{finished ? copy.draw.complete : `${strokeCount}`}</span>
      </div>
      {!finished && <div className={styles.mobileDrawingDock} data-mobile-drawing-dock role="group" aria-label={copy.stations.draw.title}>
        <div className={styles.mobileDrawingDockHeader}>
          <strong>{copy.stations.draw.title}</strong>
          <span role="status" aria-live="polite">{strokeCount}</span>
        </div>
        <div className={styles.mobileDrawingActions}>
          <button type="button" disabled={strokeCount === 0} onClick={undo}>{copy.undo}</button>
          <button type="button" disabled={strokeCount === 0} onClick={clear}>{copy.clear}</button>
          <button type="button" data-mobile-drawing-finish disabled={strokeCount === 0} onClick={() => handleControl("finish")}>{copy.finish}</button>
        </div>
      </div>}
    </>
  );
}
