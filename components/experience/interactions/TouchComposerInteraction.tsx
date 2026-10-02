"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent } from "react";
import { interactionSurfaceSizes, sceneTokens } from "../scene-config";
import type { InteractionCopy } from "./interaction-copy";
import { interactionRuntime, markInteractionCanvasDirty, registerInteractionCanvas, registerSceneInteraction } from "./interaction-runtime";
import type { SceneInteractionEvent } from "./interaction-types";
import { loadMonitorArtwork } from "./monitor-artwork";
import { puzzleArtworkUrl } from "./puzzle-artwork";
import {
  activatePuzzleSlot, beginPuzzleDrag, cancelPuzzleDrag, clearPuzzleSelection,
  finishPuzzleDrag, getPuzzleState, resetPuzzle, setPuzzleFocusedSlot,
  setPuzzleInteractive, subscribePuzzle, updatePuzzleDrag,
} from "./puzzle-store";
import styles from "./HeroInteractions.module.css";

const artwork = puzzleArtworkUrl;
const { width: canvasWidth, height: canvasHeight } = interactionSurfaceSizes.interactive.canvas;
// Keep the 3:2 artwork within the authored wide monitor.
const board = { x: (canvasWidth - 690) / 2, y: 14, width: 690, height: 460 };
const monitorBoard = { x: board.x / canvasWidth, y: board.y / canvasHeight, width: board.width / canvasWidth, height: board.height / canvasHeight };
type Control = "reset" | "close" | "continue";
const controls = {
  reset: { x: 38, y: 486, width: 180, height: 42 },
  continue: { x: canvasWidth - 240, y: 486, width: 202, height: 42 },
  close: { x: canvasWidth - 88, y: 12, width: 54, height: 46 },
} satisfies Record<Control, { x: number; y: number; width: number; height: number }>;

function smoothstep(value: number) {
  const bounded = Math.max(0, Math.min(1, value));
  return bounded * bounded * (3 - 2 * bounded);
}

function monitorPoint(x: number, y: number) {
  return { x: (x - monitorBoard.x) / monitorBoard.width, y: (y - monitorBoard.y) / monitorBoard.height };
}

function monitorControl(x: number, y: number): Control | null {
  return (Object.keys(controls) as Control[]).find((control) => {
    const rect = controls[control];
    return x * canvasWidth >= rect.x && x * canvasWidth <= rect.x + rect.width
      && y * canvasHeight >= rect.y && y * canvasHeight <= rect.y + rect.height;
  }) ?? null;
}

function pointSlot(x: number, y: number) {
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return Math.min(2, Math.floor(y * 3)) * 3 + Math.min(2, Math.floor(x * 3));
}

function interpolate(label: string, values: Record<string, number>) {
  return label.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match));
}

export function TouchComposerInteraction({ copy, onClose, onComplete, onReset, onContinue }: {
  copy: InteractionCopy;
  onClose: () => void;
  onComplete: () => void;
  onReset: () => void;
  onContinue: () => void;
}) {
  const puzzle = useSyncExternalStore(subscribePuzzle, getPuzzleState, getPuzzleState);
  const [artworkStatus, setArtworkStatus] = useState<"loading" | "ready" | "missing">("loading");
  const artworkStatusRef = useRef(artworkStatus);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const tileButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const renderFrame = useRef<number | null>(null);
  const transitionFrame = useRef<number | null>(null);
  const transitionProgress = useRef(0);
  const transitionState = useRef<"intro" | "ready" | "outro">("intro");
  const transitionTarget = useRef<0 | 1>(1);
  const transitionFinish = useRef<(() => void) | undefined>(undefined);
  const puzzleImage = useRef<HTMLImageElement | null>(null);
  const idleImage = useRef<HTMLImageElement | null>(null);
  const previousSurface = useRef<HTMLCanvasElement | null>(null);
  const sceneInputCount = useRef(0);
  const ignoreMonitorActivateUntil = useRef(0);
  const suppressGridClickUntil = useRef(0);
  const pendingMonitorControl = useRef<{ pointerId: number; control: Control } | null>(null);
  const hoverControl = useRef<Control | null>(null);
  const focusedControl = useRef<Control | null>(null);
  const seamOpacity = useRef(puzzle.solved ? 0 : 1);
  const lastPaint = useRef(0);
  const paintRef = useRef<() => void>(() => {});
  const completionNotified = useRef(false);
  const callbacks = useRef({ onClose, onComplete, onReset, onContinue });

  useEffect(() => { callbacks.current = { onClose, onComplete, onReset, onContinue }; }, [onClose, onComplete, onReset, onContinue]);

  const schedulePaint = useCallback(() => {
    if (renderFrame.current !== null) return;
    renderFrame.current = window.requestAnimationFrame(() => {
      renderFrame.current = null;
      paintRef.current();
    });
  }, []);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const state = getPuzzleState();
    const transition = transitionProgress.current;
    const retaining = transitionState.current === "outro" && state.started;
    const contentOpacity = retaining ? 1 : smoothstep(transition);
    const time = performance.now();
    const elapsed = lastPaint.current ? Math.min(64, time - lastPaint.current) : 16;
    lastPaint.current = time;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    seamOpacity.current = state.solved ? reducedMotion ? 0 : Math.max(0, seamOpacity.current - elapsed / 480) : 1;
    Object.assign(canvas.dataset, {
      transitionProgress: transition.toFixed(3), puzzleTiles: JSON.stringify(state.tiles),
      puzzlePreviewTiles: JSON.stringify(state.previewTiles), puzzleSolved: String(state.solved),
      puzzleMoves: String(state.moves), puzzleSelected: String(state.selectedSlot ?? "none"),
      puzzleBoard: JSON.stringify(monitorBoard), puzzleArtwork: artworkStatusRef.current, puzzleArtworkSrc: artwork,
    });
    interactionRuntime.touchVisibility = transition;
    context.clearRect(0, 0, canvasWidth, canvasHeight);
    if (transitionState.current === "intro" && previousSurface.current) context.drawImage(previousSurface.current, 0, 0, canvasWidth, canvasHeight);
    else if (idleImage.current?.naturalWidth) context.drawImage(idleImage.current, 0, 0, canvasWidth, canvasHeight);
    else { context.fillStyle = "#16191d"; context.fillRect(0, 0, canvasWidth, canvasHeight); }
    context.save();
    context.globalAlpha = contentOpacity;
    context.fillStyle = "#16191d";
    context.fillRect(0, 0, canvasWidth, canvasHeight);
    const tileWidth = board.width / 3;
    const tileHeight = board.height / 3;
    const image = puzzleImage.current;
    state.previewTiles.forEach((piece, slot) => {
      const x = board.x + (slot % 3) * tileWidth;
      const y = board.y + Math.floor(slot / 3) * tileHeight;
      if (image?.naturalWidth) context.drawImage(image,
        (piece % 3) * image.naturalWidth / 3, Math.floor(piece / 3) * image.naturalHeight / 3,
        image.naturalWidth / 3, image.naturalHeight / 3, x, y, tileWidth, tileHeight);
      else {
        // Preserve all positions and input while artwork loads or is unavailable.
        context.fillStyle = piece % 2 ? "#22252a" : "#2c2926";
        context.fillRect(x, y, tileWidth, tileHeight);
        context.fillStyle = "rgba(247,247,244,.5)";
        context.font = '500 22px "Vazirmatn Variable", Tahoma, sans-serif';
        context.textAlign = "center";
        context.fillText(String(piece + 1), x + tileWidth / 2, y + tileHeight / 2 + 8);
      }
      if (seamOpacity.current > 0) {
        context.save();
        context.globalAlpha *= seamOpacity.current;
        context.strokeStyle = "rgba(22,25,29,.8)";
        context.lineWidth = 3;
        context.strokeRect(x + 1.5, y + 1.5, tileWidth - 3, tileHeight - 3);
        if (state.selectedSlot === slot || state.focusedSlot === slot || state.dragging?.targetSlot === slot) {
          context.strokeStyle = state.selectedSlot === slot ? "#ece2cc" : "#75d8ff";
          context.lineWidth = state.selectedSlot === slot ? 4 : 3;
          context.strokeRect(x + 4, y + 4, tileWidth - 8, tileHeight - 8);
        }
        context.restore();
      }
    });
    context.restore();
    context.save();
    context.globalAlpha = smoothstep(transition);
    context.direction = document.documentElement.dir === "rtl" ? "rtl" : "ltr";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = '500 22px "Vazirmatn Variable", Tahoma, sans-serif';
    (Object.keys(controls) as Control[]).forEach((control) => {
      const rect = controls[control];
      const focused = focusedControl.current === control || hoverControl.current === control;
      context.fillStyle = focused ? "rgba(117,216,255,.13)" : "rgba(247,247,244,.035)";
      context.beginPath();
      context.roundRect(rect.x, rect.y, rect.width, rect.height, 12);
      context.fill();
      if (focused) { context.strokeStyle = "rgba(117,216,255,.85)"; context.lineWidth = 2; context.stroke(); }
      context.fillStyle = "#f0ebe1";
      if (control === "close") {
        const x = rect.x + rect.width / 2;
        const y = rect.y + rect.height / 2;
        context.strokeStyle = "#f0ebe1";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(x - 7, y - 7); context.lineTo(x + 7, y + 7);
        context.moveTo(x + 7, y - 7); context.lineTo(x - 7, y + 7);
        context.stroke();
      } else context.fillText(control === "reset" ? copy.reset : state.solved ? copy.continue : copy.skip, rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width - 20);
    });
    context.restore();
    markInteractionCanvasDirty("interactive");
    if (state.solved && seamOpacity.current > 0) schedulePaint();
  }, [copy, schedulePaint]);

  useEffect(() => { paintRef.current = paint; }, [paint]);

  const notifyCompletion = useCallback(() => {
    if (!getPuzzleState().solved || completionNotified.current || transitionState.current !== "ready") return;
    completionNotified.current = true;
    if (gridRef.current?.contains(document.activeElement)) continueRef.current?.focus({ preventScroll: true });
    callbacks.current.onComplete();
  }, []);

  const finishTransition = useCallback(() => {
    const target = transitionTarget.current;
    if (transitionFrame.current !== null) window.cancelAnimationFrame(transitionFrame.current);
    transitionFrame.current = null;
    transitionProgress.current = target;
    transitionState.current = target === 1 ? "ready" : "outro";
    setPuzzleInteractive(target === 1);
    paint();
    const callback = transitionFinish.current;
    transitionFinish.current = undefined;
    callback?.();
    if (target === 1) notifyCompletion();
  }, [notifyCompletion, paint]);

  const animateTransition = useCallback((target: 0 | 1, onFinish?: () => void) => {
    if (transitionFrame.current !== null) window.cancelAnimationFrame(transitionFrame.current);
    transitionTarget.current = target;
    transitionFinish.current = onFinish;
    transitionState.current = target === 1 ? "intro" : "outro";
    setPuzzleInteractive(false);
    const from = transitionProgress.current;
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : target === 1 ? 550 : 380;
    if (!duration || Math.abs(target - from) < 0.001) { finishTransition(); return; }
    const startedAt = performance.now();
    const tick = (time: number) => {
      const progress = Math.min(1, (time - startedAt) / duration);
      transitionProgress.current = from + (target - from) * progress;
      paint();
      if (progress < 1) transitionFrame.current = window.requestAnimationFrame(tick);
      else finishTransition();
    };
    transitionFrame.current = window.requestAnimationFrame(tick);
  }, [finishTransition, paint]);

  const release = useCallback(() => {
    const pointerId = getPuzzleState().dragging?.pointerId;
    cancelPuzzleDrag();
    clearPuzzleSelection();
    if (pointerId !== undefined && gridRef.current?.hasPointerCapture(pointerId)) gridRef.current.releasePointerCapture(pointerId);
    setPuzzleFocusedSlot(null);
    hoverControl.current = null;
    focusedControl.current = null;
    pendingMonitorControl.current = null;
    schedulePaint();
  }, [schedulePaint]);

  const exit = useCallback((continueJourney: boolean) => {
    if (transitionState.current === "outro") return;
    release();
    animateTransition(0, () => continueJourney ? callbacks.current.onContinue() : callbacks.current.onClose());
  }, [animateTransition, release]);

  const reset = useCallback(() => {
    if (transitionState.current !== "ready") return;
    release();
    resetPuzzle();
    completionNotified.current = false;
    callbacks.current.onReset();
    schedulePaint();
  }, [release, schedulePaint]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const experience = canvas.closest("[data-experience-root]");
    const retained = interactionRuntime.monitorEntries.interactive?.canvas;
    previousSurface.current = retained && retained !== canvas ? retained : null;
    let active = true;
    let registered = false;
    const begin = (image: HTMLImageElement | null) => {
      if (!active) return;
      puzzleImage.current = image;
      artworkStatusRef.current = image?.naturalWidth ? "ready" : "missing";
      setArtworkStatus(artworkStatusRef.current);
      if (registered) { schedulePaint(); return; }
      registered = true;
      transitionProgress.current = 0;
      paint();
      registerInteractionCanvas("interactive", canvas);
      animateTransition(1, () => { previousSurface.current = null; });
    };
    const stopArtwork = loadMonitorArtwork(artwork, begin, { immediate: Boolean(previousSurface.current) });
    const stopIdle = loadMonitorArtwork(sceneTokens.bakedScene.screens.interactive, (image) => {
      if (!active) return;
      idleImage.current = image;
      schedulePaint();
    }, { immediate: true });
    void document.fonts?.ready.then(() => { if (active) schedulePaint(); });
    return () => {
      active = false;
      stopArtwork();
      stopIdle();
      setPuzzleInteractive(false);
      cancelPuzzleDrag();
      if (interactionRuntime.monitorEntries.interactive?.canvas === canvas) {
        if (experience?.isConnected && getPuzzleState().started) {
          transitionState.current = "outro";
          transitionProgress.current = 0;
          paint();
          registerInteractionCanvas("interactive", canvas);
        } else registerInteractionCanvas("interactive", null);
      }
      previousSurface.current = null;
    };
  }, [animateTransition, paint, schedulePaint]);

  useEffect(() => {
    const unsubscribe = subscribePuzzle(() => {
      if (!getPuzzleState().solved) completionNotified.current = false;
      notifyCompletion();
      schedulePaint();
    });
    const hidden = () => { if (document.hidden) release(); };
    const menuToggle = document.querySelector("header button[aria-controls='primary-navigation']");
    const menu = new MutationObserver(() => { if (menuToggle?.getAttribute("aria-expanded") === "true") release(); });
    if (menuToggle) menu.observe(menuToggle, { attributes: true, attributeFilter: ["aria-expanded"] });
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motionChange = () => {
      release();
      if (motion.matches) {
        seamOpacity.current = getPuzzleState().solved ? 0 : 1;
        if (transitionFrame.current !== null) finishTransition();
      }
      schedulePaint();
    };
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", hidden);
    motion.addEventListener("change", motionChange);
    return () => {
      unsubscribe();
      release();
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", hidden);
      motion.removeEventListener("change", motionChange);
      menu.disconnect();
    };
  }, [finishTransition, notifyCompletion, release, schedulePaint]);

  useEffect(() => {
    const handleSceneInput = (event: SceneInteractionEvent) => {
      sceneInputCount.current += 1;
      if (canvasRef.current) canvasRef.current.dataset.sceneInputCount = String(sceneInputCount.current);
      if (transitionState.current !== "ready") return;
      // Native clicks follow the down/up stream; handle that gesture once.
      if (event.phase === "activate" && performance.now() < ignoreMonitorActivateUntil.current) return;
      if (event.phase === "down" || event.phase === "up" || event.phase === "cancel") ignoreMonitorActivateUntil.current = performance.now() + 650;
      const pending = pendingMonitorControl.current;
      if (pending && pending.pointerId !== event.pointerId) return;
      const dragging = getPuzzleState().dragging;
      // Tabletop and semantic pointers use different coordinate spaces.
      if (dragging && (dragging.surface !== "monitor" || dragging.pointerId !== event.pointerId)) return;
      const point = monitorPoint(event.x, event.y);
      if (event.phase === "cancel") {
        cancelPuzzleDrag(event.pointerId);
        pendingMonitorControl.current = null;
        hoverControl.current = null;
        schedulePaint();
      } else if (event.phase === "move") {
        if (pending) hoverControl.current = monitorControl(event.x, event.y) === pending.control ? pending.control : null;
        else if (dragging) updatePuzzleDrag(event.pointerId, point.x, point.y);
        else { hoverControl.current = monitorControl(event.x, event.y); setPuzzleFocusedSlot(hoverControl.current ? null : pointSlot(point.x, point.y)); }
        schedulePaint();
      } else if (event.phase === "down" || event.phase === "activate") {
        if (dragging || pending) return;
        const control = monitorControl(event.x, event.y);
        if (control && event.phase === "down") {
          pendingMonitorControl.current = { pointerId: event.pointerId, control };
          hoverControl.current = control;
          schedulePaint();
        } else if (control === "close") exit(false);
        else if (control === "continue") exit(true);
        else if (control === "reset") reset();
        else {
          const slot = pointSlot(point.x, point.y);
          if (slot !== null) {
            if (event.phase === "activate") activatePuzzleSlot(slot);
            else beginPuzzleDrag(slot, event.pointerId, point.x, point.y, "monitor");
          }
        }
      } else if (event.phase === "up") {
        if (pending) {
          pendingMonitorControl.current = null;
          hoverControl.current = null;
          if (monitorControl(event.x, event.y) === pending.control) {
            if (pending.control === "close") exit(false);
            else if (pending.control === "continue") exit(true);
            else reset();
          }
          schedulePaint();
        } else if (dragging) {
          updatePuzzleDrag(event.pointerId, point.x, point.y);
          finishPuzzleDrag(event.pointerId);
        }
      }
    };
    registerSceneInteraction("touch", handleSceneInput);
    return () => registerSceneInteraction("touch", null);
  }, [exit, reset, schedulePaint]);

  useEffect(() => () => {
    if (renderFrame.current !== null) window.cancelAnimationFrame(renderFrame.current);
    if (transitionFrame.current !== null) window.cancelAnimationFrame(transitionFrame.current);
    renderFrame.current = null;
    transitionFrame.current = null;
    setPuzzleInteractive(false);
    cancelPuzzleDrag();
    interactionRuntime.touchVisibility = 0;
  }, []);

  const keyboard = (event: KeyboardEvent<HTMLButtonElement>, slot: number) => {
    if (event.key === "Enter" || event.key === " ") suppressGridClickUntil.current = 0;
    if (event.key === "Escape") { cancelPuzzleDrag(); return; }
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (getPuzzleState().dragging) return;
    const row = Math.floor(slot / 3);
    const column = slot % 3;
    const next = event.key === "ArrowLeft" ? row * 3 + Math.max(0, column - 1)
      : event.key === "ArrowRight" ? row * 3 + Math.min(2, column + 1)
        : event.key === "ArrowUp" ? Math.max(0, row - 1) * 3 + column
          : event.key === "ArrowDown" ? Math.min(2, row + 1) * 3 + column : event.key === "Home" ? 0 : 8;
    tileButtons.current[next]?.focus({ preventScroll: true });
  };

  const gridPoint = (clientX: number, clientY: number) => {
    const rect = gridRef.current?.getBoundingClientRect();
    return rect ? { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height } : null;
  };
  const focusControl = (control: Control | null) => { focusedControl.current = control; setPuzzleFocusedSlot(null); schedulePaint(); };

  return (
    <div className={styles.puzzleInteraction} style={{ "--puzzle-artwork": `url("${artwork}")` } as CSSProperties} data-touch-spatial-controls data-touch-complete={String(puzzle.solved)}
      data-puzzle-tiles={JSON.stringify(puzzle.tiles)} data-puzzle-preview-tiles={JSON.stringify(puzzle.previewTiles)}
      data-puzzle-moves={puzzle.moves} data-puzzle-solved={String(puzzle.solved)} data-puzzle-selected={puzzle.selectedSlot ?? "none"}
      data-puzzle-artwork={artworkStatus} data-puzzle-artwork-src={artwork} data-puzzle-dragging={puzzle.dragging?.sourceSlot ?? "none"} data-puzzle-interactive={String(puzzle.interactive)}
      role="region" aria-label={copy.stations.touch.title}>
      <canvas ref={canvasRef} width={canvasWidth} height={canvasHeight} className={styles.textureSource} data-composer-canvas aria-hidden="true" />
      <p className={styles.puzzleScreenReader} id="puzzle-instructions">{copy.touch.instruction} {copy.touch.keyboard}</p>
      <div ref={gridRef} className={styles.puzzleGrid} data-puzzle-grid data-solved={String(puzzle.solved)} data-artwork-ready={String(artworkStatus === "ready")} dir="ltr" role="group"
        aria-label={copy.stations.touch.title} aria-describedby="puzzle-instructions"
        onPointerMove={(event) => {
          if (getPuzzleState().dragging?.surface !== "semantic") return;
          const point = gridPoint(event.clientX, event.clientY);
          if (point) updatePuzzleDrag(event.pointerId, point.x, point.y);
        }}
        onPointerUp={(event) => {
          const dragging = getPuzzleState().dragging;
          if (dragging?.surface !== "semantic" || dragging.pointerId !== event.pointerId) return;
          suppressGridClickUntil.current = event.timeStamp + 650;
          const point = gridPoint(event.clientX, event.clientY);
          if (point) updatePuzzleDrag(event.pointerId, point.x, point.y);
          finishPuzzleDrag(event.pointerId);
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={(event) => {
          if (getPuzzleState().dragging?.pointerId === event.pointerId) suppressGridClickUntil.current = event.timeStamp + 650;
          cancelPuzzleDrag(event.pointerId);
        }}
        onLostPointerCapture={(event) => { cancelPuzzleDrag(event.pointerId); }}>
        {puzzle.previewTiles.map((piece, slot) => (
          <button key={slot} ref={(button) => { tileButtons.current[slot] = button; }} type="button"
            data-puzzle-slot={slot} data-puzzle-piece={piece}
            aria-pressed={puzzle.selectedSlot === slot}
            aria-disabled={puzzle.solved}
            disabled={puzzle.solved}
            tabIndex={puzzle.solved ? -1 : 0}
            aria-label={interpolate(copy.touch.tile, { piece: piece + 1, row: Math.floor(slot / 3) + 1, column: slot % 3 + 1 })}
            style={{ "--puzzle-piece-x": `${(piece % 3) * 50}%`, "--puzzle-piece-y": `${Math.floor(piece / 3) * 50}%` } as CSSProperties}
            onKeyDown={(event) => keyboard(event, slot)}
            onFocus={() => {
              if (getPuzzleState().solved) { continueRef.current?.focus({ preventScroll: true }); return; }
              focusedControl.current = null;
              setPuzzleFocusedSlot(slot);
            }}
            onBlur={() => { if (getPuzzleState().focusedSlot === slot) setPuzzleFocusedSlot(null); }}
            onPointerDown={(event) => {
              if (event.button !== 0 || !event.isPrimary) return;
              const point = gridPoint(event.clientX, event.clientY);
              if (!point || !beginPuzzleDrag(slot, event.pointerId, point.x, point.y, "semantic")) return;
              suppressGridClickUntil.current = event.timeStamp + 650;
              event.preventDefault();
              event.currentTarget.focus({ preventScroll: true });
              gridRef.current?.setPointerCapture(event.pointerId);
            }}
            onClick={(event) => { if (event.detail === 0 && event.timeStamp >= suppressGridClickUntil.current) activatePuzzleSlot(slot); }}>
            {artworkStatus !== "ready" ? piece + 1 : null}
          </button>
        ))}
      </div>
      <div className={styles.puzzleActions}>
        <button type="button" data-puzzle-reset onFocus={() => focusControl("reset")} onBlur={() => focusControl(null)} onClick={reset}>{copy.reset}</button>
        <button type="button" data-puzzle-close data-interaction-dismiss data-interaction-escape onFocus={() => focusControl("close")} onBlur={() => focusControl(null)} onClick={() => exit(false)}>{copy.close}</button>
        <button ref={continueRef} type="button" data-interaction-continue data-mobile-interaction-skip onFocus={() => focusControl("continue")} onBlur={() => focusControl(null)} onClick={() => exit(true)}>{puzzle.solved ? copy.continue : copy.skip}</button>
      </div>
      <span className={styles.puzzleScreenReader} role="status" aria-live="polite">{puzzle.solved ? copy.touch.complete : interpolate(copy.touch.moves, { count: puzzle.moves })}</span>
    </div>
  );
}
