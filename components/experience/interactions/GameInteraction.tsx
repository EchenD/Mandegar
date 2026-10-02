"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { interactionSurfaceSizes, sceneTokens } from "../scene-config";
import type { InteractionCopy } from "./interaction-copy";
import {
  interactionRuntime,
  markInteractionCanvasDirty,
  registerInteractionCanvas,
  registerSceneInteraction,
} from "./interaction-runtime";
import type { SceneInteractionEvent } from "./interaction-types";
import { gameControlAtPoint, paintBreakoutScreen, type BlockSpark, type GameControl } from "./breakout-screen";
import { completeGameResult, getVisitorCreation, saveGameResult } from "./visitor-creation";
import {
  breakoutBoard,
  createBreakoutGame,
  finishBreakoutGame,
  moveBreakoutPaddle,
  serveBreakoutBall,
  setBreakoutPaused,
  stepBreakoutGame,
  type BreakoutGame,
} from "./breakout-game";
import styles from "./HeroInteractions.module.css";

const { width: canvasWidth, height: canvasHeight } = interactionSurfaceSizes.game.canvas;
function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function GameInteraction({
  copy,
  reducedMotion,
  onClose,
  onComplete,
  onReset,
  onContinue,
}: {
  copy: InteractionCopy;
  reducedMotion: boolean;
  onClose: () => void;
  onComplete: () => void;
  onReset: () => void;
  onContinue: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);
  const entranceBackground = useRef<HTMLCanvasElement | null>(null);
  const game = useRef<BreakoutGame>(createBreakoutGame());
  const bestRef = useRef(getVisitorCreation().gameBest);
  const onCompleteRef = useRef(onComplete);
  const onResetRef = useRef(onReset);
  const completionReported = useRef(false);
  const activePointer = useRef<number | null>(null);
  const keyboardDirection = useRef<-1 | 0 | 1>(0);
  const heldDirection = useRef<-1 | 0 | 1>(0);
  const heldPointer = useRef<number | null>(null);
  const hoveredControl = useRef<GameControl | null>(null);
  const focusedControl = useRef<GameControl | null>(null);
  const transitionProgress = useRef(0);
  const transitionState = useRef<"intro" | "ready" | "outro">("intro");
  const transitionFrame = useRef<number | null>(null);
  const renderFrame = useRef<number | null>(null);
  const animationFrame = useRef<number | null>(null);
  const monitorImage = useRef<HTMLImageElement | null>(null);
  const trail = useRef<Array<{ x: number; y: number }>>([]);
  const sparks = useRef<BlockSpark[]>([]);
  const [snapshot, setSnapshot] = useState<BreakoutGame>(() => createBreakoutGame());
  const [best, setBest] = useState(() => getVisitorCreation().gameBest);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    onResetRef.current = onReset;
  }, [onComplete, onReset]);

  const applyGame = useCallback((next: BreakoutGame) => {
    const previous = game.current;
    game.current = next;
    if (next.score !== previous.score) {
      next.blocks.forEach((block) => {
        if (block.alive || !previous.blocks[block.id]?.alive) return;
        const x = block.x + block.width / 2;
        const y = block.y + block.height / 2;
        sparks.current.push({ x, y, startedAt: performance.now() });
        interactionRuntime.gameHitId += 1;
        interactionRuntime.gameHitX = x / canvasWidth;
        interactionRuntime.gameHitY = y / canvasHeight;
      });
    }
    if (next.status !== previous.status || next.score !== previous.score || next.lives !== previous.lives
      || next.serves !== previous.serves || Math.ceil(breakoutBoard.duration - next.elapsed) !== Math.ceil(breakoutBoard.duration - previous.elapsed)) setSnapshot(next);
    if (next.status === "complete" && !completionReported.current) {
      activePointer.current = null;
      keyboardDirection.current = 0;
      heldDirection.current = 0;
      heldPointer.current = null;
      completionReported.current = true;
      bestRef.current = completeGameResult(next.score);
      setBest(bestRef.current);
      onCompleteRef.current();
    }
  }, []);

  const paint = useCallback(() => {
    if (!mountedRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const current = game.current;
    const transition = transitionProgress.current;
    interactionRuntime.gameVisibility = transition;
    interactionRuntime.gameComplete = current.status === "complete";
    canvas.dataset.transitionProgress = transition.toFixed(3);
    canvas.dataset.transitionState = transitionState.current;
    canvas.dataset.paddleX = current.paddleX.toFixed(1);
    canvas.dataset.dragging = activePointer.current === null ? "false" : "true";
    chromeRef.current?.style.setProperty("--game-ui-opacity", transition.toFixed(3));
    if (chromeRef.current) chromeRef.current.dataset.gameExiting = transitionState.current === "outro" ? "true" : "false";
    sparks.current = sparks.current.filter((spark) => performance.now() - spark.startedAt < 320);
    paintBreakoutScreen(context, current, {
      copy,
      best: bestRef.current,
      reducedMotion,
      transition: transitionState.current === "outro" ? 1 : transition,
      controlsTransition: transition,
      background: transitionState.current === "intro" && entranceBackground.current ? entranceBackground.current : monitorImage.current,
      trail: trail.current,
      sparks: sparks.current,
      hoveredControl: hoveredControl.current,
      focusedControl: focusedControl.current,
    });
    markInteractionCanvasDirty("game");
  }, [copy, reducedMotion]);

  const schedulePaint = useCallback(() => {
    if (!mountedRef.current || renderFrame.current !== null) return;
    renderFrame.current = window.requestAnimationFrame(() => {
      renderFrame.current = null;
      paint();
    });
  }, [paint]);
  const releaseKeyboardControls = useCallback(() => {
    keyboardDirection.current = 0;
    heldDirection.current = 0;
    heldPointer.current = null;
  }, []);
  const releaseControls = useCallback(() => {
    releaseKeyboardControls();
    activePointer.current = null;
  }, [releaseKeyboardControls]);

  const animateTransition = useCallback((target: 0 | 1, onFinish?: () => void) => {
    if (transitionFrame.current !== null) window.cancelAnimationFrame(transitionFrame.current);
    const from = transitionProgress.current;
    transitionState.current = target === 1 ? "intro" : "outro";
    const duration = reducedMotion ? 0 : target === 1 ? 500 : 360;
    if (duration === 0) {
      transitionProgress.current = target;
      transitionState.current = target === 1 ? "ready" : "outro";
      paint();
      onFinish?.();
      return;
    }
    const startedAt = performance.now();
    const tick = (time: number) => {
      const elapsed = clamp((time - startedAt) / duration);
      const eased = elapsed * elapsed * (3 - 2 * elapsed);
      transitionProgress.current = from + (target - from) * eased;
      paint();
      if (elapsed < 1) transitionFrame.current = window.requestAnimationFrame(tick);
      else {
        transitionFrame.current = null;
        transitionState.current = target === 1 ? "ready" : "outro";
        onFinish?.();
      }
    };
    transitionFrame.current = window.requestAnimationFrame(tick);
  }, [paint, reducedMotion]);
  const action = useCallback(() => {
    if (transitionState.current !== "ready") return;
    releaseControls();
    const current = game.current;
    applyGame(current.status === "ready" ? serveBreakoutBall(current) : setBreakoutPaused(current, current.status === "running"));
    trail.current = [];
    schedulePaint();
  }, [applyGame, releaseControls, schedulePaint]);
  const reset = useCallback(() => {
    if (transitionState.current !== "ready" || game.current.serves === 0) return;
    releaseControls();
    game.current = createBreakoutGame();
    setSnapshot(game.current);
    completionReported.current = false;
    trail.current = [];
    sparks.current = [];
    onResetRef.current();
    schedulePaint();
  }, [releaseControls, schedulePaint]);
  const exitWithTransition = useCallback((callback: () => void) => {
    if (transitionState.current === "outro") return;
    releaseControls();
    if (game.current.serves > 0) saveGameResult(game.current.score);
    game.current = setBreakoutPaused(game.current, true);
    animateTransition(0, callback);
  }, [animateTransition, releaseControls]);
  const finishOrContinue = useCallback(() => {
    if (transitionState.current !== "ready" || game.current.serves === 0) return;
    if (game.current.status === "complete") exitWithTransition(onContinue);
    else {
      releaseControls();
      applyGame(finishBreakoutGame(game.current));
      schedulePaint();
    }
  }, [applyGame, exitWithTransition, onContinue, releaseControls, schedulePaint]);
  const movePaddle = useCallback((x: number) => {
    game.current = moveBreakoutPaddle(game.current, x);
    schedulePaint();
  }, [schedulePaint]);
  const focusGameCanvas = useCallback(() => {
    if (window.matchMedia("(min-width: 761px)").matches) canvasRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    mountedRef.current = true;
    const retained = interactionRuntime.ambientGameSurface?.canvas;
    if (retained) {
      const snapshot = document.createElement("canvas");
      snapshot.width = canvasWidth;
      snapshot.height = canvasHeight;
      snapshot.getContext("2d")?.drawImage(retained, 0, 0, canvasWidth, canvasHeight);
      entranceBackground.current = snapshot;
    }
    let mounted = true;
    let registered = false;
    const image = new Image();
    const begin = () => {
      if (!mounted || registered) return;
      registered = true;
      monitorImage.current = image.naturalWidth > 0 ? image : null;
      paint();
      registerInteractionCanvas("game", canvas);
      animateTransition(1);
    };
    image.onload = begin;
    image.onerror = begin;
    image.src = sceneTokens.bakedScene.screens.game;
    if (image.complete || entranceBackground.current) begin();
    void document.fonts?.ready.then(() => { if (mounted) schedulePaint(); });
    return () => {
      mounted = false;
      mountedRef.current = false;
      image.onload = null;
      image.onerror = null;
      if (renderFrame.current !== null) window.cancelAnimationFrame(renderFrame.current);
      if (transitionFrame.current !== null) window.cancelAnimationFrame(transitionFrame.current);
      renderFrame.current = null;
      transitionFrame.current = null;
      registerInteractionCanvas("game", null);
    };
  }, [animateTransition, paint, schedulePaint]);

  useEffect(() => {
    let previousTime = performance.now();
    const tick = (time: number) => {
      if (document.hidden) {
        animationFrame.current = null;
        return;
      }
      const delta = Math.max(0, (time - previousTime) / 1000);
      previousTime = time;
      if (transitionState.current === "ready") {
        if (delta > 1 && game.current.status === "running") {
          releaseControls();
          applyGame(setBreakoutPaused(game.current, true));
          schedulePaint();
        }
        const movement = activePointer.current === null ? keyboardDirection.current || heldDirection.current : 0;
        if (movement) game.current = moveBreakoutPaddle(game.current, game.current.paddleX + movement * 470 * delta);
        if (game.current.status === "running") {
          const next = stepBreakoutGame(game.current, delta);
          applyGame(next);
          trail.current.push({ x: next.ball.x, y: next.ball.y });
          if (trail.current.length > 7) trail.current.shift();
          paint();
        } else if (movement || (!reducedMotion && sparks.current.length)) paint();
      }
      animationFrame.current = window.requestAnimationFrame(tick);
    };
    const handleVisibility = () => {
      releaseControls();
      if (document.hidden) {
        applyGame(setBreakoutPaused(game.current, true));
        if (animationFrame.current !== null) window.cancelAnimationFrame(animationFrame.current);
        animationFrame.current = null;
      } else {
        previousTime = performance.now();
        if (animationFrame.current === null) animationFrame.current = window.requestAnimationFrame(tick);
        schedulePaint();
      }
    };
    const handleBlur = () => {
      releaseControls();
      applyGame(setBreakoutPaused(game.current, true));
      schedulePaint();
    };
    const menuToggle = document.querySelector("header button[aria-controls='primary-navigation']");
    const handleMenu = () => {
      if (menuToggle?.getAttribute("aria-expanded") === "true") handleBlur();
    };
    const menuObserver = new MutationObserver(handleMenu);
    if (menuToggle) menuObserver.observe(menuToggle, { attributes: true, attributeFilter: ["aria-expanded"] });
    handleMenu();
    animationFrame.current = window.requestAnimationFrame(tick);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    return () => {
      if (animationFrame.current !== null) window.cancelAnimationFrame(animationFrame.current);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      menuObserver.disconnect();
    };
  }, [applyGame, paint, reducedMotion, releaseControls, schedulePaint]);

  useEffect(() => {
    const handleSceneInput = (event: SceneInteractionEvent) => {
      if (transitionState.current !== "ready" || event.phase === "activate") return;
      const control = gameControlAtPoint(event.x, event.y);
      if (event.phase === "move") {
        if (activePointer.current === event.pointerId) movePaddle(event.x * canvasWidth);
        else {
          hoveredControl.current = control;
          schedulePaint();
        }
      } else if (event.phase === "down") {
        if (control === "close") exitWithTransition(onClose);
        else if (control === "reset") {
          reset();
        } else if (control === "action") {
          action();
        } else if (control === "finish") finishOrContinue();
        else if (event.y >= breakoutBoard.top / canvasHeight && event.y <= 0.87 && game.current.status !== "complete") {
          if (activePointer.current !== null && activePointer.current !== event.pointerId) return;
          releaseKeyboardControls();
          if ((game.current.status === "ready" || game.current.status === "paused") && event.y >= 0.45 && event.y <= 0.64) action();
          activePointer.current = event.pointerId;
          if (event.y > 0.74 || game.current.status === "running") movePaddle(event.x * canvasWidth);
          schedulePaint();
        }
      } else if (event.phase === "up" || event.phase === "cancel") {
        if (event.phase === "up" && game.current.status !== "complete") focusGameCanvas();
        if (activePointer.current === event.pointerId) activePointer.current = null;
        hoveredControl.current = null;
        schedulePaint();
      }
    };
    registerSceneInteraction("game", handleSceneInput);
    return () => registerSceneInteraction("game", null);
  }, [action, exitWithTransition, finishOrContinue, focusGameCanvas, movePaddle, onClose, releaseKeyboardControls, reset, schedulePaint]);
  useEffect(() => () => {
    if (renderFrame.current !== null) window.cancelAnimationFrame(renderFrame.current);
    if (transitionFrame.current !== null) window.cancelAnimationFrame(transitionFrame.current);
    interactionRuntime.gameVisibility = 0;
    interactionRuntime.gameComplete = false;
  }, []);

  const focusControl = (control: GameControl | null) => {
    focusedControl.current = control;
    releaseKeyboardControls();
    schedulePaint();
  };
  const actionLabel = snapshot.status === "running" ? copy.game.pause : snapshot.status === "paused" ? copy.game.resume : snapshot.serves > 0 ? copy.game.serve : copy.game.action;
  const cleared = snapshot.blocks.filter((block) => !block.alive).length;
  const time = Math.max(0, Math.ceil(breakoutBoard.duration - snapshot.elapsed));
  const holdPaddle = (event: React.PointerEvent<HTMLButtonElement>, direction: -1 | 1) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    heldPointer.current = event.pointerId;
    heldDirection.current = direction;
    movePaddle(game.current.paddleX + direction * 12);
  };
  const releasePaddle = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (heldPointer.current !== event.pointerId) return;
    heldPointer.current = null;
    heldDirection.current = 0;
  };
  const nudgePaddle = (event: React.MouseEvent<HTMLButtonElement>, direction: -1 | 1) => {
    if (event.detail === 0) movePaddle(game.current.paddleX + direction * 38);
  };
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (transitionState.current !== "ready" || game.current.status === "complete") return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      if (activePointer.current !== null) return;
      keyboardDirection.current = event.key === "ArrowLeft" ? -1 : 1;
      movePaddle(game.current.paddleX + keyboardDirection.current * 12);
    } else if ((event.key === " " || event.key === "Enter")
      && (event.target === canvasRef.current || (event.target as HTMLElement).hasAttribute("data-game-action")
        || (event.target as HTMLElement).hasAttribute("data-mobile-game-action"))) {
      event.preventDefault();
      if (!event.repeat) action();
    }
  };
  const handleKeyUp = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if ((event.key === "ArrowLeft" && keyboardDirection.current === -1)
      || (event.key === "ArrowRight" && keyboardDirection.current === 1)) keyboardDirection.current = 0;
  };
  const handleRegionBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) releaseKeyboardControls();
  };

  return (
    <div ref={chromeRef} className={styles.gameChrome}>
      <div
        className={styles.spatialInteractionSemantics}
        data-game-spatial-controls
        data-game-type="breakout"
        data-game-status={snapshot.status}
        data-game-completed-count={cleared}
        data-game-attempts={snapshot.serves}
        data-game-score={snapshot.score}
        data-game-best={best}
        data-game-lives={snapshot.lives}
        data-game-time={time}
        role="region"
        aria-label={copy.stations.game.title}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onBlur={handleRegionBlur}
      >
        <canvas ref={canvasRef} width={canvasWidth} height={canvasHeight} className={styles.textureSource} data-game-canvas tabIndex={0} aria-label={copy.game.keyboard} onFocus={schedulePaint} />
        <p>{copy.stations.game.instruction}</p>
        <button type="button" data-game-action disabled={snapshot.status === "complete"} onFocus={() => focusControl("action")} onBlur={() => focusControl(null)} onClick={action}>{actionLabel}</button>
        <button type="button" data-game-replay disabled={snapshot.serves === 0} onFocus={() => focusControl("reset")} onBlur={() => focusControl(null)} onClick={reset}>{snapshot.status === "complete" ? copy.replay : copy.reset}</button>
        <button type="button" data-game-finish data-interaction-continue disabled={snapshot.serves === 0} onFocus={() => focusControl("finish")} onBlur={() => focusControl(null)} onClick={finishOrContinue}>{snapshot.status === "complete" ? copy.continue : copy.game.finish}</button>
        <button type="button" data-interaction-dismiss onFocus={() => focusControl("close")} onBlur={() => focusControl(null)} onClick={() => exitWithTransition(onClose)}>{copy.close}</button>
        <span role="status" aria-live="polite">
          {snapshot.status === "complete" ? `${snapshot.outcome === "won" ? copy.game.win : copy.game.result}. ${copy.game.score}: ${snapshot.score}. ${copy.game.best}: ${best}.`
            : `${copy.game.score}: ${snapshot.score}. ${copy.game.lives}: ${snapshot.lives}. ${copy.game.remaining}: ${cleared}.`}
        </span>
      </div>
      {snapshot.status !== "complete" && (
        <div className={styles.mobileGameDock} data-mobile-game-dock role="group" aria-label={copy.stations.game.title} onKeyDown={handleKeyDown} onKeyUp={handleKeyUp} onBlur={handleRegionBlur}>
          <div className={styles.mobileGameHeader}>
            <strong>{copy.stations.game.title}</strong>
            <dl className={styles.mobileGameStats} data-mobile-game-stats>
              <div><dt>{copy.game.score}</dt><dd><bdi>{snapshot.score}</bdi></dd></div>
              <div><dt>{copy.game.lives}</dt><dd><bdi>{snapshot.lives}</bdi></dd></div>
              <div><dt>{copy.game.time}</dt><dd><bdi>{time}</bdi></dd></div>
            </dl>
          </div>
          <div className={styles.mobileGameActions}>
            <button type="button" data-mobile-game-left aria-label={copy.game.left} onPointerDown={(event) => holdPaddle(event, -1)} onPointerUp={releasePaddle} onPointerCancel={releasePaddle} onLostPointerCapture={releasePaddle} onBlur={releaseControls} onClick={(event) => nudgePaddle(event, -1)}>←</button>
            <button type="button" data-mobile-game-action onClick={action}>{actionLabel}</button>
            <button type="button" data-mobile-game-right aria-label={copy.game.right} onPointerDown={(event) => holdPaddle(event, 1)} onPointerUp={releasePaddle} onPointerCancel={releasePaddle} onLostPointerCapture={releasePaddle} onBlur={releaseControls} onClick={(event) => nudgePaddle(event, 1)}>→</button>
          </div>
          <div className={styles.mobileGameSecondary}>
            <button type="button" data-mobile-game-reset disabled={snapshot.serves === 0} onClick={reset}>{copy.reset}</button>
            <button type="button" data-mobile-game-finish disabled={snapshot.serves === 0} onClick={finishOrContinue}>{copy.game.finish}</button>
          </div>
        </div>
      )}
      {snapshot.status === "complete" && (
        <aside className={styles.gameResult} data-game-result>
          <strong>{snapshot.outcome === "won" ? copy.game.win : copy.game.result}</strong>
          <dl className={styles.gameResultStats}>
            <div><dt>{copy.game.score}</dt><dd><bdi>{snapshot.score}</bdi></dd></div>
            <div><dt>{copy.game.remaining}</dt><dd><bdi>{cleared}</bdi></dd></div>
            <div><dt>{copy.game.best}</dt><dd><bdi>{best}</bdi></dd></div>
          </dl>
          <button type="button" data-game-result-replay onClick={reset}>{copy.replay}</button>
        </aside>
      )}
    </div>
  );
}
