"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { InteractionCopy } from "./interaction-copy";
import {
  markInteractionCanvasDirty,
  registerInteractionCanvas,
  registerSceneInteraction,
} from "./interaction-runtime";
import styles from "./HeroInteractions.module.css";

const gameDuration = 8_000;

export function GameInteraction({ copy, reducedMotion, onComplete }: { copy: InteractionCopy; reducedMotion: boolean; onComplete: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrame = useRef<number | null>(null);
  const startedAt = useRef<number | null>(null);
  const pausedAt = useRef<number | null>(null);
  const pausedTotal = useRef(0);
  const running = useRef(false);
  const tickRef = useRef<((now: number) => void) | null>(null);
  const [status, setStatus] = useState<"ready" | "playing" | "complete">("ready");
  const [feedback, setFeedback] = useState("");
  const targetPosition = useRef(0);

  const draw = useCallback((progress: number) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.fillStyle = "#080b10";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(117,216,255,.18)";
    context.fillRect(canvas.width * 0.42, 0, canvas.width * 0.16, canvas.height);
    targetPosition.current = (progress * 3.4) % 1;
    const x = targetPosition.current * canvas.width;
    context.beginPath();
    context.arc(x, canvas.height / 2, 42, 0, Math.PI * 2);
    context.fillStyle = "#ef86ff";
    context.shadowColor = "#ef86ff";
    context.shadowBlur = 28;
    context.fill();
    context.shadowBlur = 0;
    context.strokeStyle = "#75d8ff";
    context.lineWidth = 5;
    context.strokeRect(canvas.width * 0.42, 4, canvas.width * 0.16, canvas.height - 8);
    markInteractionCanvasDirty("game");
  }, []);

  const stop = useCallback(() => {
    if (animationFrame.current !== null) cancelAnimationFrame(animationFrame.current);
    animationFrame.current = null;
  }, []);

  const start = useCallback(() => {
    stop();
    startedAt.current = performance.now();
    pausedTotal.current = 0;
    running.current = true;
    setFeedback("");
    setStatus("playing");
    const duration = reducedMotion ? 3_000 : gameDuration;
    const tick = (now: number) => {
      const elapsed = now - (startedAt.current ?? now) - pausedTotal.current;
      const progress = Math.min(1, elapsed / duration);
      draw(progress);
      if (progress >= 1) {
        running.current = false;
        setStatus("complete");
        setFeedback(copy.game.result);
        onComplete();
        animationFrame.current = null;
        return;
      }
      animationFrame.current = requestAnimationFrame(tick);
    };
    tickRef.current = tick;
    animationFrame.current = requestAnimationFrame(tick);
  }, [copy.game.result, draw, onComplete, reducedMotion, stop]);

  const hit = useCallback(() => {
    if (status === "ready") {
      start();
      return;
    }
    if (status !== "playing") return;
    const distance = Math.abs(targetPosition.current - 0.5);
    setFeedback(distance < 0.13 ? copy.game.hit : copy.game.missed);
  }, [copy.game.hit, copy.game.missed, start, status]);

  useEffect(() => {
    registerSceneInteraction("game", (event) => {
      if (event.phase === "activate") hit();
    });
    return () => registerSceneInteraction("game", null);
  }, [hit]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    registerInteractionCanvas("game", canvas);
    draw(0);
    const visibility = () => {
      if (document.hidden && running.current) {
        pausedAt.current = performance.now();
        stop();
      } else if (pausedAt.current && running.current) {
        pausedTotal.current += performance.now() - pausedAt.current;
        pausedAt.current = null;
        if (tickRef.current) animationFrame.current = requestAnimationFrame(tickRef.current);
      }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      running.current = false;
      stop();
      registerInteractionCanvas("game", null);
    };
  }, [draw, stop]);

  return (
    <div className={styles.gameExperience} data-game-status={status} onKeyDown={(event) => {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        hit();
      }
    }}>
      <canvas ref={canvasRef} width={540} height={720} className={styles.textureSource} aria-hidden="true" />
      <p className={styles.statusText} role="status">{feedback || copy.stations.game.instruction}</p>
      <div className={styles.actionRow}>
        <button type="button" onClick={status === "complete" ? start : hit}>
          {status === "complete" ? copy.replay : copy.game.action}
        </button>
      </div>
    </div>
  );
}
