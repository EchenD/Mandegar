"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { InteractionCopy } from "./interaction-copy";
import { interactionRuntime, markInteractionCanvasDirty, registerInteractionCanvas, registerSceneInteraction } from "./interaction-runtime";
import { completeGameResult, getVisitorCreation } from "./visitor-creation";
import { getSavedRace, raceBoard, saveRace, steerRace, stepRace, toggleRace, type RaceGame } from "./race-game";
import { paintRaceScreen, raceControlAtPoint, type RaceControl } from "./race-screen";
import { loadRaceArtwork } from "./race-artwork";
import { reportInteractionParticipation } from "./interaction-participation";
import styles from "./HeroInteractions.module.css";

export function GameInteraction({ copy, reducedMotion, onComplete }: {
  copy: InteractionCopy;
  reducedMotion: boolean;
  onClose: () => void;
  onComplete: () => void;
  onReset: () => void;
  onContinue: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  const game = useRef<RaceGame>(getSavedRace());
  const best = useRef(getVisitorCreation().gameBest);
  const direction = useRef(0);
  const pointer = useRef<number | null>(null);
  const heldControl = useRef<{ id: number; target: HTMLButtonElement } | null>(null);
  const focused = useRef<RaceControl | null>(null);
  const transition = useRef(0);
  const transitionReady = useRef(false);
  const departingAt = useRef<number | null>(null);
  const diagnosticsAt = useRef(-Infinity);
  const entranceBackground = useRef<HTMLCanvasElement | null>(null);
  const reported = useRef(false);
  const complete = useRef(onComplete);
  const [snapshot, setSnapshot] = useState(getSavedRace);
  const [bestScore, setBestScore] = useState(() => getVisitorCreation().gameBest);
  useEffect(() => { complete.current = onComplete; }, [onComplete]);

  const release = useCallback(() => {
    const held = heldControl.current;
    heldControl.current = null;
    if (held?.target.hasPointerCapture(held.id)) held.target.releasePointerCapture(held.id);
    direction.current = 0;
    pointer.current = null;
    if (interactionRuntime.gestureStation === "game") interactionRuntime.gestureStation = null;
    if (canvasRef.current) canvasRef.current.dataset.dragging = "false";
  }, []);
  const apply = useCallback((next: RaceGame, publish = true) => {
    game.current = next;
    if (publish) setSnapshot(next);
    if (next.status === "complete" && !reported.current) {
      reported.current = true;
      release();
      best.current = completeGameResult(next.score);
      setBestScore(best.current);
      saveRace(next);
      complete.current();
    }
  }, [release]);
  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    canvas.dataset.transitionProgress = transition.current.toFixed(3);
    canvas.dataset.carX = String(game.current.x);
    canvas.dataset.dragging = String(pointer.current !== null);
    const time = performance.now();
    if (time - diagnosticsAt.current >= 200 || game.current.status === "complete") {
      canvas.dataset.traffic = JSON.stringify(game.current.traffic);
      diagnosticsAt.current = time;
    }
    interactionRuntime.gameVisibility = transition.current;
    interactionRuntime.gameComplete = game.current.status === "complete";
    chromeRef.current?.style.setProperty("--game-ui-opacity", String(transition.current));
    paintRaceScreen(context, game.current, {
      copy,
      best: best.current,
      transition: departingAt.current === null ? transition.current : 1,
      focused: focused.current,
      background: entranceBackground.current,
      interactive: window.innerWidth > 760,
    });
    markInteractionCanvasDirty("game");
  }, [copy]);
  const action = useCallback(() => {
    if (!transitionReady.current || departingAt.current !== null || game.current.status === "complete") return;
    reportInteractionParticipation("game");
    release();
    apply(toggleRace(game.current));
    paint();
  }, [apply, paint, release]);
  const move = useCallback((x: number) => {
    if (departingAt.current !== null || game.current.status === "complete") return;
    reportInteractionParticipation("game");
    game.current = steerRace(game.current, x);
    paint();
  }, [paint]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    transitionReady.current = false;
    departingAt.current = null;
    const retained = interactionRuntime.ambientGameSurface?.canvas;
    if (retained) {
      const background = document.createElement("canvas");
      background.width = canvas.width;
      background.height = canvas.height;
      background.getContext("2d")?.drawImage(retained, 0, 0, canvas.width, canvas.height);
      entranceBackground.current = background;
    }
    const stopArtwork = loadRaceArtwork(paint);
    const started = performance.now();
    let previous = started;
    let lastPublish = started;
    let frame: number;
    paint();
    registerInteractionCanvas("game", canvas);
    const tick = (time: number) => {
      const dt = (time - previous) / 1000;
      previous = time;
      const previousTransition = transition.current;
      const previousGame = game.current;
      const amount = reducedMotion ? 1 : Math.min(1, (time - started) / 500);
      const entrance = amount * amount * (3 - 2 * amount);
      const departure = departingAt.current === null ? 0 : reducedMotion ? 1 : Math.min(1, (time - departingAt.current) / 400);
      transition.current = entrance * (1 - departure * departure * (3 - 2 * departure));
      if (amount === 1 && !transitionReady.current && departingAt.current === null) {
        transitionReady.current = true;
        if (game.current.status === "ready" || game.current.status === "paused") apply({ ...game.current, status: "running" });
        else if (game.current.status === "complete") apply(game.current);
      }
      if (!document.hidden) {
        if (transitionReady.current && departingAt.current === null && game.current.status === "running") {
          const next = stepRace(game.current, dt, pointer.current === null ? direction.current : 0);
          const publish = time - lastPublish >= 200 || next.status !== game.current.status;
          apply(next, publish);
          if (publish) lastPublish = time;
        }
        if (previousTransition !== transition.current || previousGame !== game.current) paint();
      }
      frame = requestAnimationFrame(tick);
    };
    const pause = () => {
      release();
      if (game.current.status === "running") apply({ ...game.current, status: "paused" });
      previous = performance.now();
      paint();
    };
    const departure = (event: Event) => {
      if ((event as CustomEvent<{ station?: string }>).detail?.station !== "game") return;
      departingAt.current = performance.now();
      release();
      canvas.dataset.departing = "true";
      paint();
    };
    const visibility = () => { if (document.hidden) pause(); else previous = performance.now(); };
    const menu = document.querySelector("header button[aria-controls='primary-navigation']");
    const observer = new MutationObserver(() => { if (menu?.getAttribute("aria-expanded") === "true") pause(); });
    if (menu) observer.observe(menu, { attributes: true, attributeFilter: ["aria-expanded"] });
    window.addEventListener("blur", pause);
    window.addEventListener("mandegar:interaction-departure", departure);
    document.addEventListener("visibilitychange", visibility);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      stopArtwork();
      observer.disconnect();
      window.removeEventListener("blur", pause);
      window.removeEventListener("mandegar:interaction-departure", departure);
      document.removeEventListener("visibilitychange", visibility);
      release();
      saveRace(game.current);
      best.current = completeGameResult(game.current.score);
      // Hold the outgoing image until the autonomous renderer takes over.
      interactionRuntime.ambientGameSurface = { canvas, revision: 1 };
      registerInteractionCanvas("game", null);
      interactionRuntime.gameVisibility = 0;
      interactionRuntime.gameComplete = false;
    };
  }, [apply, paint, reducedMotion, release]);

  useEffect(() => {
    registerSceneInteraction("game", (event) => {
      if (event.phase === "activate" || departingAt.current !== null) return;
      const control = window.innerWidth > 760 ? raceControlAtPoint(event.x, event.y) : null;
      if (event.phase === "down") {
        if (control === "action") action();
        else if (event.y >= 0 && event.y <= 1 && game.current.status !== "complete") {
          if (pointer.current !== null && pointer.current !== event.pointerId) return;
          // Own a press during the entrance too, so holding through the fade
          // remains one continuous steering gesture.
          pointer.current = event.pointerId;
          interactionRuntime.gestureStation = "game";
          direction.current = 0;
          move(event.x * raceBoard.width);
        }
      } else if (event.phase === "move") {
        if (pointer.current === event.pointerId) move(event.x * raceBoard.width);
        else if (focused.current !== control) { focused.current = control; paint(); }
      } else if (event.phase === "up" || event.phase === "cancel") {
        if (pointer.current !== event.pointerId) return;
        release();
        if (event.phase === "up") canvasRef.current?.focus({ preventScroll: true });
      }
    });
    return () => registerSceneInteraction("game", null);
  }, [action, move, paint, release]);

  const keyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (game.current.status === "complete" || departingAt.current !== null) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      if (pointer.current === null && heldControl.current === null) {
        direction.current = event.key === "ArrowLeft" ? -1 : 1;
        if (!event.repeat) move(game.current.x + direction.current * 12);
      }
    } else if ((event.key === " " || event.key === "Enter") && event.target === canvasRef.current) {
      event.preventDefault();
      if (!event.repeat) action();
    }
  };
  const keyUp = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") direction.current = 0;
  };
  const keyboardBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      // Clicking the physical WebGL screen can move semantic keyboard focus.
      // That focus change must not cancel a newly captured mouse gesture.
      if (pointer.current === null && heldControl.current === null) release();
    }
  };
  const label = snapshot.status === "running" ? copy.game.pause : copy.game.resume;
  const controlFocus = (control: RaceControl | null) => {
    focused.current = control;
    if (heldControl.current === null) direction.current = 0;
    paint();
  };
  const steeringButton = (value: -1 | 1) => <button type="button" data-mobile-game-left={value === -1 ? "" : undefined} data-mobile-game-right={value === 1 ? "" : undefined}
    aria-label={value === -1 ? copy.game.left : copy.game.right}
    onPointerDown={(event) => {
      event.preventDefault();
      if (game.current.status === "complete" || departingAt.current !== null || pointer.current !== null || heldControl.current !== null || !event.isPrimary) return;
      heldControl.current = { id: event.pointerId, target: event.currentTarget };
      event.currentTarget.setPointerCapture(event.pointerId);
      direction.current = value;
      move(game.current.x + value * 12);
    }}
    onPointerUp={(event) => { if (heldControl.current?.id === event.pointerId) release(); }}
    onPointerCancel={(event) => { if (heldControl.current?.id === event.pointerId) release(); }}
    onLostPointerCapture={(event) => { if (heldControl.current?.id === event.pointerId) release(); }}
    onClick={(event) => { if (event.detail === 0) move(game.current.x + value * 30); }}>{value === -1 ? "←" : "→"}</button>;
  return <div ref={chromeRef} className={styles.gameChrome}>
    <div className={styles.spatialInteractionSemantics} data-game-spatial-controls data-game-type="race"
      data-game-status={snapshot.status} data-game-score={snapshot.score} data-game-best={bestScore} data-game-outcome={snapshot.outcome ?? "none"}
      role="region" aria-label={copy.stations.game.title} onKeyDown={keyDown} onKeyUp={keyUp} onBlur={keyboardBlur}>
      <canvas ref={canvasRef} width={raceBoard.width} height={raceBoard.height} className={styles.textureSource} data-game-canvas tabIndex={0} aria-label={copy.game.keyboard} />
      <p>{copy.stations.game.instruction}</p>
      {snapshot.status !== "complete" && <button type="button" data-game-action onFocus={() => controlFocus("action")} onBlur={() => controlFocus(null)} onClick={action}>{label}</button>}
      <span role="status" aria-live="polite">{snapshot.status === "complete" ? copy.game.result : copy.game.distance}: {snapshot.score} m</span>
    </div>
    {snapshot.status !== "complete" && <div className={styles.mobileGameDock} data-mobile-game-dock role="group" aria-label={copy.stations.game.title}
      onKeyDown={keyDown} onKeyUp={keyUp} onBlur={keyboardBlur}>
      <div className={styles.mobileGameActions}>
        {steeringButton(-1)}
        <button type="button" data-mobile-game-action onClick={action}>{label}</button>
        {steeringButton(1)}
      </div>
    </div>}
  </div>;
}
