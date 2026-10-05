"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent } from "react";
import { experienceState } from "../experience-state";
import { interactionSurfaceSizes } from "../scene-config";
import type { InteractionCopy } from "./interaction-copy";
import { interactionRuntime, markInteractionCanvasDirty, registerInteractionCanvas } from "./interaction-runtime";
import { reportInteractionParticipation } from "./interaction-participation";
import { loadPuzzleArtwork, puzzleArtworkUrl } from "./puzzle-artwork";
import {
  activatePuzzleSlot, beginPuzzleDrag, cancelPuzzleDrag, clearPuzzleSelection,
  finishPuzzleDrag, getPuzzleState, setPuzzleFocusedSlot,
  setPuzzleInteractive, subscribePuzzle, updatePuzzleDrag,
} from "./puzzle-store";
import styles from "./HeroInteractions.module.css";

const { width: canvasWidth, height: canvasHeight } = interactionSurfaceSizes.interactive.canvas;
const storyFrame = { x: (canvasWidth - 690) / 2, y: 32, width: 690, height: 460 };

function smoothstep(value: number) {
  const bounded = Math.max(0, Math.min(1, value));
  return bounded * bounded * (3 - 2 * bounded);
}

function interpolate(label: string, values: Record<string, number>) {
  return label.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match));
}

export function TouchComposerInteraction({ copy, onComplete }: {
  copy: InteractionCopy;
  onClose: () => void;
  onComplete: () => void;
  onReset: () => void;
  onContinue: () => void;
}) {
  const puzzle = useSyncExternalStore(subscribePuzzle, getPuzzleState, getPuzzleState);
  const [artworkStatus, setArtworkStatus] = useState<"loading" | "ready" | "missing">("loading");
  const [artworkSource, setArtworkSource] = useState(puzzleArtworkUrl);
  const artworkStatusRef = useRef(artworkStatus);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const tileButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const renderFrame = useRef<number | null>(null);
  const transitionFrame = useRef<number | null>(null);
  const transitionProgress = useRef(0);
  const transitionState = useRef<"intro" | "ready" | "outro">("intro");
  const transitionTarget = useRef<0 | 1>(1);
  const puzzleImage = useRef<HTMLImageElement | null>(null);
  const suppressGridClickUntil = useRef(0);
  const focusFrame = useRef<number | null>(null);
  const storyReveal = useRef<number[]>(Array.from({ length: 9 }, (_, piece) => puzzle.tiles[piece] === piece ? 1 : 0));
  const lastPaint = useRef(0);
  const paintRef = useRef<() => void>(() => {});
  const completionNotified = useRef(false);
  const completeCallback = useRef(onComplete);

  useEffect(() => { completeCallback.current = onComplete; }, [onComplete]);

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
    const inChapter = experienceState.narrative.phase === "engagement";
    const transition = inChapter ? transitionProgress.current : 0;
    const time = performance.now();
    const elapsed = lastPaint.current ? Math.min(64, time - lastPaint.current) : 16;
    lastPaint.current = time;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const smoothing = reducedMotion ? 1 : 1 - Math.exp(-elapsed / 140);
    let revealing = false;
    storyReveal.current = storyReveal.current.map((value, piece) => {
      const target = state.tiles[piece] === piece ? 1 : 0;
      const valueNext = value + (target - value) * smoothing;
      if (Math.abs(target - valueNext) > 0.002) revealing = true;
      return Math.abs(target - valueNext) < 0.002 ? target : valueNext;
    });
    const image = puzzleImage.current;
    Object.assign(canvas.dataset, {
      transitionProgress: transition.toFixed(3), puzzleTiles: JSON.stringify(state.tiles),
      puzzlePreviewTiles: JSON.stringify(state.previewTiles), puzzleSolved: String(state.solved),
      puzzleMoves: String(state.moves), puzzleSelected: String(state.selectedSlot ?? "none"),
      puzzleArtwork: artworkStatusRef.current, puzzleArtworkSrc: puzzleArtworkUrl,
      puzzlePresentation: "story", puzzleCorrectPieces: String(state.tiles.filter((piece, slot) => piece === slot).length),
    });
    interactionRuntime.touchVisibility = transition;
    context.clearRect(0, 0, canvasWidth, canvasHeight);
    context.fillStyle = "#16191d";
    context.fillRect(0, 0, canvasWidth, canvasHeight);
    if (image?.naturalWidth) {
      // The quiet complete picture supplies context. Correctly placed pieces
      // restore its colour; input and shuffled pieces belong to the tabletop.
      context.save();
      context.globalAlpha = 1 - smoothstep(transition) * 0.72;
      context.filter = "saturate(0.2)";
      context.drawImage(image, storyFrame.x, storyFrame.y, storyFrame.width, storyFrame.height);
      context.restore();
      context.save();
      context.globalAlpha = smoothstep(transition);
      const width = storyFrame.width / 3;
      const height = storyFrame.height / 3;
      storyReveal.current.forEach((visibility, piece) => {
        context.save();
        context.globalAlpha *= visibility;
        context.drawImage(image,
          (piece % 3) * image.naturalWidth / 3, Math.floor(piece / 3) * image.naturalHeight / 3,
          image.naturalWidth / 3, image.naturalHeight / 3,
          storyFrame.x + (piece % 3) * width, storyFrame.y + Math.floor(piece / 3) * height,
          width, height);
        context.restore();
      });
      context.restore();
    }
    markInteractionCanvasDirty("interactive");
    if (revealing) schedulePaint();
  }, [schedulePaint]);

  useEffect(() => { paintRef.current = paint; }, [paint]);

  const notifyCompletion = useCallback(() => {
    if (!getPuzzleState().solved || completionNotified.current || transitionState.current !== "ready") return;
    completionNotified.current = true;
    const restoreFocus = Boolean(gridRef.current?.contains(document.activeElement));
    completeCallback.current();
    if (restoreFocus) {
      if (focusFrame.current !== null) window.cancelAnimationFrame(focusFrame.current);
      focusFrame.current = window.requestAnimationFrame(() => {
        focusFrame.current = null;
        document.querySelector<HTMLElement>("p[data-interaction-result]")?.focus({ preventScroll: true });
      });
    }
  }, []);

  const finishTransition = useCallback(() => {
    const target = transitionTarget.current;
    if (transitionFrame.current !== null) window.cancelAnimationFrame(transitionFrame.current);
    transitionFrame.current = null;
    transitionProgress.current = target;
    transitionState.current = target === 1 ? "ready" : "outro";
    setPuzzleInteractive(target === 1 && interactionRuntime.activeStation === "touch");
    paint();
    if (target === 1) notifyCompletion();
  }, [notifyCompletion, paint]);

  const animateTransition = useCallback((target: 0 | 1) => {
    if (transitionFrame.current !== null) window.cancelAnimationFrame(transitionFrame.current);
    transitionTarget.current = target;
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
    schedulePaint();
  }, [schedulePaint]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let active = true;
    let registered = false;
    const stopArtwork = loadPuzzleArtwork((image) => {
      if (!active) return;
      puzzleImage.current = image;
      artworkStatusRef.current = image?.naturalWidth ? "ready" : "missing";
      setArtworkStatus(artworkStatusRef.current);
      setArtworkSource(image?.src ?? puzzleArtworkUrl);
      if (registered) { schedulePaint(); return; }
      registered = true;
      transitionProgress.current = 0;
      paint();
      registerInteractionCanvas("interactive", canvas);
      animateTransition(1);
    }, { immediate: true });
    return () => {
      active = false;
      stopArtwork();
      setPuzzleInteractive(false);
      cancelPuzzleDrag();
      // Preserve the visitor's state, not a canvas displayed in every chapter.
      if (interactionRuntime.monitorEntries.interactive?.canvas === canvas) registerInteractionCanvas("interactive", null);
    };
  }, [animateTransition, paint, schedulePaint]);

  useEffect(() => {
    let previousPuzzle = getPuzzleState();
    const unsubscribe = subscribePuzzle(() => {
      const nextPuzzle = getPuzzleState();
      // The physical table, monitor and accessible grid share this store.
      // Focus, artwork loading and automatic transitions do not count as play.
      const participated = (!previousPuzzle.dragging && Boolean(nextPuzzle.dragging))
        || (nextPuzzle.selectedSlot !== null && nextPuzzle.selectedSlot !== previousPuzzle.selectedSlot)
        || nextPuzzle.moves > previousPuzzle.moves;
      previousPuzzle = nextPuzzle;
      if (participated) reportInteractionParticipation("touch");
      if (!nextPuzzle.solved) completionNotified.current = false;
      notifyCompletion();
      schedulePaint();
    });
    const hidden = () => { if (document.hidden) release(); };
    const departure = (event: Event) => {
      if ((event as CustomEvent<{ station?: string }>).detail?.station !== "touch") return;
      release();
      animateTransition(0);
    };
    const menuToggle = document.querySelector("header button[aria-controls='primary-navigation']");
    const menu = new MutationObserver(() => { if (menuToggle?.getAttribute("aria-expanded") === "true") release(); });
    if (menuToggle) menu.observe(menuToggle, { attributes: true, attributeFilter: ["aria-expanded"] });
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motionChange = () => {
      release();
      if (motion.matches) {
        if (transitionFrame.current !== null) finishTransition();
      }
      schedulePaint();
    };
    window.addEventListener("blur", release);
    window.addEventListener("mandegar:interaction-departure", departure);
    document.addEventListener("visibilitychange", hidden);
    motion.addEventListener("change", motionChange);
    return () => {
      unsubscribe();
      release();
      window.removeEventListener("blur", release);
      window.removeEventListener("mandegar:interaction-departure", departure);
      document.removeEventListener("visibilitychange", hidden);
      motion.removeEventListener("change", motionChange);
      menu.disconnect();
    };
  }, [animateTransition, finishTransition, notifyCompletion, release, schedulePaint]);

  useEffect(() => () => {
    if (renderFrame.current !== null) window.cancelAnimationFrame(renderFrame.current);
    if (transitionFrame.current !== null) window.cancelAnimationFrame(transitionFrame.current);
    if (focusFrame.current !== null) window.cancelAnimationFrame(focusFrame.current);
    renderFrame.current = null;
    transitionFrame.current = null;
    focusFrame.current = null;
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

  return (
    <div className={styles.puzzleInteraction} style={{ "--puzzle-artwork": `url("${artworkSource}")` } as CSSProperties} data-touch-spatial-controls data-touch-complete={String(puzzle.solved)}
      data-puzzle-tiles={JSON.stringify(puzzle.tiles)} data-puzzle-preview-tiles={JSON.stringify(puzzle.previewTiles)}
      data-puzzle-moves={puzzle.moves} data-puzzle-solved={String(puzzle.solved)} data-puzzle-selected={puzzle.selectedSlot ?? "none"}
      data-puzzle-artwork={artworkStatus} data-puzzle-artwork-src={puzzleArtworkUrl} data-puzzle-dragging={puzzle.dragging?.sourceSlot ?? "none"} data-puzzle-interactive={String(puzzle.interactive)}
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
            aria-disabled={puzzle.solved || !puzzle.interactive}
            disabled={puzzle.solved || !puzzle.interactive}
            tabIndex={puzzle.solved || !puzzle.interactive ? -1 : 0}
            aria-label={interpolate(copy.touch.tile, { piece: piece + 1, row: Math.floor(slot / 3) + 1, column: slot % 3 + 1 })}
            style={{ "--puzzle-piece-x": `${(piece % 3) * 50}%`, "--puzzle-piece-y": `${Math.floor(piece / 3) * 50}%` } as CSSProperties}
            onKeyDown={(event) => keyboard(event, slot)}
            onFocus={() => { if (!getPuzzleState().solved) setPuzzleFocusedSlot(slot); }}
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
      <span className={styles.puzzleScreenReader} role="status" aria-live="polite">{puzzle.solved ? copy.touch.complete : interpolate(copy.touch.moves, { count: puzzle.moves })}</span>
    </div>
  );
}
