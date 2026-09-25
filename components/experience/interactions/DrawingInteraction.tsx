"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { InteractionCopy } from "./interaction-copy";
import {
  markInteractionCanvasDirty,
  registerInteractionCanvas,
  registerSceneInteraction,
} from "./interaction-runtime";
import styles from "./HeroInteractions.module.css";

type Point = { x: number; y: number };
type Stroke = Point[];

function renderDrawing(canvas: HTMLCanvasElement, strokes: Stroke[]) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const background = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  background.addColorStop(0, "#080b10");
  background.addColorStop(1, "#101c35");
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = 11;
  context.strokeStyle = "#75d8ff";
  context.shadowColor = "#225cff";
  context.shadowBlur = 22;
  strokes.forEach((stroke) => {
    if (stroke.length === 0) return;
    context.beginPath();
    context.moveTo(stroke[0].x, stroke[0].y);
    stroke.slice(1).forEach((point) => context.lineTo(point.x, point.y));
    context.stroke();
  });
  context.shadowBlur = 0;
  markInteractionCanvasDirty("main");
}

export function DrawingInteraction({ copy, onComplete }: { copy: InteractionCopy; onComplete: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const activeStroke = useRef<Stroke | null>(null);
  const activePointer = useRef<number | null>(null);
  const [strokeCount, setStrokeCount] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    strokes.current = [];
    renderDrawing(canvas, strokes.current);
    registerInteractionCanvas("main", canvas);
    return () => registerInteractionCanvas("main", null);
  }, []);

  const pointFromEvent = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: ((clientX - bounds.left) / bounds.width) * canvas.width,
      y: ((clientY - bounds.top) / bounds.height) * canvas.height,
    };
  }, []);

  const refresh = useCallback(() => {
    if (canvasRef.current) renderDrawing(canvasRef.current, strokes.current);
    setStrokeCount(strokes.current.length);
  }, []);

  useEffect(() => {
    registerSceneInteraction("draw", (event) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const point = { x: event.x * canvas.width, y: event.y * canvas.height };
      if (event.phase === "down") {
        activePointer.current = event.pointerId;
        activeStroke.current = [point];
        strokes.current.push(activeStroke.current);
        refresh();
      } else if (event.phase === "move" && activePointer.current === event.pointerId && activeStroke.current) {
        activeStroke.current.push(point);
        refresh();
      } else if (event.phase === "up" || event.phase === "cancel") {
        activePointer.current = null;
        activeStroke.current = null;
      }
    });
    return () => registerSceneInteraction("draw", null);
  }, [refresh]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pointerDown = (event: PointerEvent) => {
      const point = pointFromEvent(event.clientX, event.clientY);
      if (!point) return;
      canvas.setPointerCapture(event.pointerId);
      activeStroke.current = [point];
      strokes.current.push(activeStroke.current);
      refresh();
    };
    const pointerMove = (event: PointerEvent) => {
      if (!activeStroke.current || !canvas.hasPointerCapture(event.pointerId)) return;
      const point = pointFromEvent(event.clientX, event.clientY);
      if (!point) return;
      activeStroke.current.push(point);
      refresh();
    };
    const pointerEnd = (event: PointerEvent) => {
      activeStroke.current = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerup", pointerEnd);
    canvas.addEventListener("pointercancel", pointerEnd);
    return () => {
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerEnd);
      canvas.removeEventListener("pointercancel", pointerEnd);
    };
  }, [pointFromEvent, refresh]);

  const addPreset = () => {
    const preset: Stroke = [];
    for (let index = 0; index <= 80; index += 1) {
      const angle = (index / 80) * Math.PI * 2;
      const radius = 70 + index * 1.4;
      preset.push({ x: 480 + Math.cos(angle * 2.1) * radius, y: 270 + Math.sin(angle * 1.7) * radius * 0.58 });
    }
    strokes.current.push(preset);
    refresh();
  };

  return (
    <div className={styles.drawingExperience}>
      <canvas
        ref={canvasRef}
        width={960}
        height={540}
        className={styles.textureSource}
        data-drawing-canvas
        data-stroke-count={strokeCount}
        aria-label={copy.stations.draw.instruction}
      />
      <p className={styles.statusText}>{copy.draw.local}</p>
      <div className={styles.actionRow}>
        <button type="button" onClick={() => { strokes.current.pop(); refresh(); }} disabled={strokeCount === 0}>{copy.undo}</button>
        <button type="button" onClick={() => { strokes.current = []; refresh(); }} disabled={strokeCount === 0}>{copy.clear}</button>
        <button type="button" onClick={addPreset}>{copy.draw.keyboardMark}</button>
        <button type="button" disabled={strokeCount === 0 || finished} onClick={() => { setFinished(true); onComplete(); }}>{copy.finish}</button>
      </div>
      {finished && <div className={styles.drawingEcho} data-drawing-echo aria-hidden="true" />}
    </div>
  );
}
