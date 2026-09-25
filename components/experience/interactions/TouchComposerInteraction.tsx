"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { InteractionCopy } from "./interaction-copy";
import {
  markInteractionCanvasDirty,
  registerInteractionCanvas,
  registerSceneInteraction,
} from "./interaction-runtime";
import styles from "./HeroInteractions.module.css";

const palettes = [
  ["#225cff", "#50c7ff", "#f7f7f4"],
  ["#d95cff", "#225cff", "#080b10"],
  ["#ffb54a", "#ef86ff", "#16191d"],
] as const;

function paint(canvas: HTMLCanvasElement, preset: number, x = 0.5, y = 0.5) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const colors = palettes[preset];
  const gradient = context.createRadialGradient(x * canvas.width, y * canvas.height, 12, x * canvas.width, y * canvas.height, canvas.width * 0.72);
  gradient.addColorStop(0, colors[1]);
  gradient.addColorStop(0.48, colors[0]);
  gradient.addColorStop(1, colors[2]);
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = "screen";
  context.strokeStyle = "rgba(255,255,255,.7)";
  context.lineWidth = 5;
  for (let index = 0; index < 7; index += 1) {
    context.beginPath();
    context.arc(x * canvas.width, y * canvas.height, 34 + index * 42, 0, Math.PI * (1.15 + index * 0.08));
    context.stroke();
  }
  context.globalCompositeOperation = "source-over";
  markInteractionCanvasDirty("interactive");
}

export function TouchComposerInteraction({ copy, onComplete }: { copy: InteractionCopy; onComplete: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activePointer = useRef<number | null>(null);
  const [preset, setPreset] = useState(0);
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    registerInteractionCanvas("interactive", canvas);
    paint(canvas, preset);
    return () => registerInteractionCanvas("interactive", null);
  }, [preset]);

  const updateFromPointer = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width));
    const y = Math.min(1, Math.max(0, (clientY - bounds.top) / bounds.height));
    paint(canvas, preset, x, y);
    setChanged(true);
  }, [preset]);

  const updateFromScene = useCallback((x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    paint(canvas, preset, x, y);
    setChanged(true);
  }, [preset]);

  useEffect(() => {
    registerSceneInteraction("touch", (event) => {
      if (event.phase === "down") {
        activePointer.current = event.pointerId;
        updateFromScene(event.x, event.y);
      } else if (event.phase === "move" && activePointer.current === event.pointerId) {
        updateFromScene(event.x, event.y);
      } else if (event.phase === "up" || event.phase === "cancel") {
        activePointer.current = null;
      }
    });
    return () => registerSceneInteraction("touch", null);
  }, [updateFromScene]);

  const choosePreset = (index: number) => {
    setPreset(index);
    setChanged(true);
    window.requestAnimationFrame(() => {
      if (canvasRef.current) paint(canvasRef.current, index, 0.32 + index * 0.18, 0.5);
    });
  };

  return (
    <div className={styles.composer}>
      <canvas
        ref={canvasRef}
        width={960}
        height={540}
        className={styles.textureSource}
        data-composer-canvas
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          updateFromPointer(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) updateFromPointer(event.clientX, event.clientY);
        }}
        onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
        aria-label={copy.stations.touch.instruction}
      />
      <div className={styles.presetRow} role="group" aria-label={copy.stations.touch.title}>
        {copy.touch.presets.map((label, index) => (
          <button key={label} type="button" aria-pressed={preset === index} onClick={() => choosePreset(index)}>{label}</button>
        ))}
      </div>
      <div className={styles.actionRow}>
        <button type="button" onClick={() => choosePreset(0)}>{copy.reset}</button>
        <button type="button" disabled={!changed} onClick={onComplete}>{copy.finish}</button>
      </div>
    </div>
  );
}
