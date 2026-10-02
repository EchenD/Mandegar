"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import type { Locale } from "@/lib/i18n";
import { experienceState } from "../experience-state";
import { sceneTokens } from "../scene-config";
import { createAmbientBreakoutGame, stepAmbientBreakoutGame } from "./ambient-breakout-game";
import { getAmbientGameVisibility } from "./ambient-game-visibility";
import { breakoutBoard } from "./breakout-game";
import { paintBreakoutScreen } from "./breakout-screen";
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
    const background = new Image();
    background.src = sceneTokens.bakedScene.screens.game;
    let state = createAmbientBreakoutGame();
    let lastPaint = 0;
    let lastVisibility = -1;
    let frame: number;
    const resumeClock = () => { lastTime = performance.now(); };
    document.addEventListener("visibilitychange", resumeClock);
    background.onload = () => { lastVisibility = -1; };

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
      if (interactive || paused || visibility === 0) {
        releaseSurface();
      } else {
        if (!motion.matches) state = stepAmbientBreakoutGame(state, delta);
        if ((!motion.matches && time - lastPaint >= 1000 / 30) || visibility !== lastVisibility) {
          paintBreakoutScreen(context, state.game, {
            copy,
            best: 0,
            reducedMotion: motion.matches,
            transition: visibility,
            background: background.naturalWidth > 0 ? background : null,
            trail: [],
            sparks: [],
            interactive: false,
          });
          canvas.dataset.ambientRound = String(state.round);
          canvas.dataset.ambientScore = String(state.game.score);
          canvas.dataset.ambientBall = `${state.game.ball.x.toFixed(1)},${state.game.ball.y.toFixed(1)}`;
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
      background.onload = null;
      releaseSurface();
    };
  }, [completed, copy, enabled]);

  return (
    <canvas
      ref={canvasRef}
      width={breakoutBoard.width}
      height={breakoutBoard.height}
      className={styles.textureSource}
      data-game-ambient
      data-ambient-state="unavailable"
      aria-hidden="true"
    />
  );
}
