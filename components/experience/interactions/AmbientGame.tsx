"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import type { Locale } from "@/lib/i18n";
import { experienceState } from "../experience-state";
import { createRaceGame, getAutonomousTarget, raceBoard, stepRace } from "./race-game";
import { getAmbientGameVisibility } from "./ambient-game-visibility";
import { paintRaceScreen } from "./race-screen";
import { loadRaceArtwork } from "./race-artwork";
import { getInteractionCopy } from "./interaction-copy";
import { interactionRuntime } from "./interaction-runtime";
import { getVisitorCreation } from "./visitor-creation";
import styles from "./HeroInteractions.module.css";

function subscribe(callback: () => void) {
  window.addEventListener("mandegar:creation-change", callback);
  return () => window.removeEventListener("mandegar:creation-change", callback);
}

function hasCompletedGame() {
  return getVisitorCreation().gameCompleted;
}

export function AmbientGame({ locale, enabled }: { locale: Locale; enabled: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const completed = useSyncExternalStore(subscribe, hasCompletedGame, () => false);
  const copy = getInteractionCopy(locale);

  useEffect(() => {
    if (!enabled) return;
    return loadRaceArtwork(() => {});
  }, [enabled]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !enabled || !completed) return;
    const root = canvas.closest("[data-experience-root]");
    let onScreen = true;
    let lastTime = performance.now();
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      lastTime = performance.now();
    });
    if (root) observer.observe(root);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let state = createRaceGame(319);
    state.status = "running";
    let round = 1;
    let lastPaint = 0;
    let lastVisibility = -1;
    let wasInteractive = false;
    let handoff: HTMLCanvasElement | null = null;
    let handoffAt = -Infinity;
    let frame: number;
    const resumeClock = () => { lastTime = performance.now(); };
    document.addEventListener("visibilitychange", resumeClock);
    const stopArtwork = loadRaceArtwork(() => { lastVisibility = -1; });

    const releaseSurface = () => {
      if (interactionRuntime.ambientGameSurface?.canvas === canvas) {
        interactionRuntime.ambientGameSurface = null;
      }
      lastVisibility = -1;
    };
    const tick = (time: number) => {
      const delta = Math.max(0, Math.min(1, (time - lastTime) / 1000));
      lastTime = time;
      const interactive = interactionRuntime.activeStation === "game";
      const visibility = experienceState.sequence === "loop"
        ? getAmbientGameVisibility(experienceState.progress)
        : 0;
      const paused = document.hidden || !onScreen;
      canvas.dataset.ambientState = interactive ? "interactive" : paused || visibility === 0 ? "paused" : motion.matches ? "still" : "playing";
      canvas.dataset.ambientVisibility = interactive || paused ? "0.000" : visibility.toFixed(3);
      if (paused || visibility === 0) {
        releaseSurface();
      } else if (interactive) {
        // The painted surface remains available while a new interactive canvas
        // loads; the controller gives that canvas priority once it is painted.
        lastVisibility = -1;
        wasInteractive = true;
      } else {
        if (wasInteractive || interactionRuntime.ambientGameSurface?.canvas !== canvas && !handoff) {
          const previous = interactionRuntime.ambientGameSurface?.canvas;
          if (previous && previous !== canvas) {
            handoff = document.createElement("canvas");
            handoff.width = canvas.width;
            handoff.height = canvas.height;
            handoff.getContext("2d")?.drawImage(previous, 0, 0);
            handoffAt = time;
          }
          wasInteractive = false;
        }
        if (!motion.matches) {
          if (state.status === "complete") { state = { ...createRaceGame(319 + round++), status: "running" }; }
          state = stepRace(state, delta, 0, getAutonomousTarget(state));
        }
        if ((!motion.matches && time - lastPaint >= 1000 / 30) || visibility !== lastVisibility) {
          const blend = motion.matches ? 1 : Math.min(1, (time - handoffAt) / 400);
          paintRaceScreen(context, state, {
            copy, best: getVisitorCreation().gameBest, transition: blend * blend * (3 - 2 * blend),
            background: handoff, interactive: false,
          });
          if (blend >= 1) handoff = null;
          canvas.dataset.ambientRound = String(round);
          canvas.dataset.ambientScore = String(state.score);
          canvas.dataset.ambientCar = String(state.x);
          const surface = interactionRuntime.ambientGameSurface;
          if (surface?.canvas === canvas) surface.revision += 1;
          else interactionRuntime.ambientGameSurface = { canvas, revision: 1 };
          lastPaint = time;
          lastVisibility = visibility;
        }
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", resumeClock);
      stopArtwork();
      releaseSurface();
    };
  }, [completed, copy, enabled]);

  return (
    <canvas
      ref={canvasRef}
      width={raceBoard.width}
      height={raceBoard.height}
      className={styles.textureSource}
      data-game-ambient
      data-ambient-state="unavailable"
      aria-hidden="true"
    />
  );
}
