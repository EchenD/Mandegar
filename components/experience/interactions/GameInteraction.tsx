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
import { getVisitorCreation, saveGameResult } from "./visitor-creation";
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
type GameControl = "close" | "reset" | "action" | "finish";
type BlockSpark = { x: number; y: number; startedAt: number };
const gameControls = {
  reset: { left: 0.065, width: 0.23 },
  action: { left: 0.33, width: 0.34 },
  finish: { left: 0.705, width: 0.23 },
} as const;

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, value));
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.roundRect(x, y, width, height, Math.min(radius, width / 2, height / 2));
}

function controlAtPoint(x: number, y: number): GameControl | null {
  if (Math.hypot(x - 0.925, y - 0.057) < 0.07) return "close";
  if (y < 0.88 || y > 0.98) return null;
  return (Object.keys(gameControls) as Array<keyof typeof gameControls>)
    .find((key) => x >= gameControls[key].left && x <= gameControls[key].left + gameControls[key].width) ?? null;
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
  const game = useRef<BreakoutGame>(createBreakoutGame());
  const bestRef = useRef(getVisitorCreation().gameBest);
  const onCompleteRef = useRef(onComplete);
  const onResetRef = useRef(onReset);
  const completionReported = useRef(false);
  const activePointer = useRef<number | null>(null);
  const keyboardDirection = useRef<-1 | 0 | 1>(0);
  const heldDirection = useRef<-1 | 0 | 1>(0);
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
      completionReported.current = true;
      bestRef.current = saveGameResult(next.score);
      setBest(bestRef.current);
      onCompleteRef.current();
    }
  }, []);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const current = game.current;
    const now = performance.now();
    const transition = transitionProgress.current;
    const direction = document.documentElement.dir === "rtl" ? "rtl" : "ltr";
    const cleared = current.blocks.filter((block) => !block.alive).length;
    const actionLabel = current.status === "running" ? copy.game.pause : current.status === "paused" ? copy.game.resume : current.serves > 0 ? copy.game.serve : copy.game.action;
    interactionRuntime.gameVisibility = transition;
    interactionRuntime.gameComplete = current.status === "complete";
    canvas.dataset.transitionProgress = transition.toFixed(3);
    canvas.dataset.paddleX = current.paddleX.toFixed(1);
    context.clearRect(0, 0, canvasWidth, canvasHeight);
    if (monitorImage.current?.complete) context.drawImage(monitorImage.current, 0, 0, canvasWidth, canvasHeight);
    else {
      context.fillStyle = "#080b10";
      context.fillRect(0, 0, canvasWidth, canvasHeight);
    }
    context.save();
    context.globalAlpha = transition;
    const background = context.createLinearGradient(0, 0, canvasWidth, canvasHeight);
    background.addColorStop(0, "#141b26");
    background.addColorStop(1, "#080d16");
    context.fillStyle = background;
    context.fillRect(0, 0, canvasWidth, canvasHeight);
    roundedRect(context, 12, 12, canvasWidth - 24, canvasHeight - 24, 22);
    context.strokeStyle = "rgba(247,247,244,.13)";
    context.lineWidth = 1;
    context.stroke();
    context.direction = direction;
    context.textAlign = "center";
    context.fillStyle = "#75d8ff";
    context.font = '700 12px "Vazirmatn Variable", Tahoma, sans-serif';
    context.fillText("MANDEGAR", canvasWidth / 2, 29);
    context.fillStyle = "#f7f7f4";
    context.font = '650 27px "Vazirmatn Variable", Tahoma, sans-serif';
    context.fillText(copy.stations.game.title, canvasWidth / 2, 62, canvasWidth - 100);
    [
      { label: copy.game.score, value: String(current.score), x: 85 },
      { label: copy.game.lives, value: String(current.lives), x: canvasWidth / 2 },
      { label: copy.game.time, value: `${Math.max(0, Math.ceil(breakoutBoard.duration - current.elapsed))}`, x: canvasWidth - 85 },
    ].forEach(({ label, value, x }) => {
      context.fillStyle = "rgba(247,247,244,.56)";
      context.font = '500 13px "Vazirmatn Variable", Tahoma, sans-serif';
      context.fillText(label, x, 96, 130);
      context.fillStyle = "#f7f7f4";
      context.font = '700 20px "Vazirmatn Variable", Tahoma, sans-serif';
      context.fillText(value, x, 120);
    });
    roundedRect(context, breakoutBoard.left, breakoutBoard.top, breakoutBoard.right - breakoutBoard.left, breakoutBoard.bottom - breakoutBoard.top, 16);
    context.fillStyle = "rgba(2,7,15,.55)";
    context.fill();
    context.strokeStyle = "rgba(117,216,255,.12)";
    context.stroke();
    current.blocks.forEach((block) => {
      if (!block.alive) return;
      roundedRect(context, block.x + 2, block.y, block.width - 4, block.height, 7);
      context.fillStyle = block.id < 4 ? "rgba(67,151,211,.36)" : "rgba(34,92,255,.36)";
      context.fill();
      context.strokeStyle = block.id < 4 ? "#75d8ff" : "#4d85ff";
      context.lineWidth = 1.5;
      context.stroke();
      context.fillStyle = "rgba(247,247,244,.2)";
      context.fillRect(block.x + 13, block.y + 6, block.width - 26, 1);
    });
    if (!reducedMotion) {
      if (current.status === "running") trail.current.forEach((point, index) => {
        context.save();
        context.globalAlpha = transition * (index + 1) / Math.max(1, trail.current.length) * 0.18;
        context.fillStyle = "#75d8ff";
        context.beginPath();
        context.arc(point.x, point.y, 2 + index * 0.55, 0, Math.PI * 2);
        context.fill();
        context.restore();
      });
      sparks.current = sparks.current.filter((spark) => now - spark.startedAt < 320);
      sparks.current.forEach((spark) => {
        const progress = (now - spark.startedAt) / 320;
        context.save();
        context.globalAlpha = transition * (1 - progress) * 0.7;
        context.fillStyle = "#75d8ff";
        for (let index = 0; index < 6; index += 1) {
          const angle = index / 6 * Math.PI * 2;
          context.beginPath();
          context.arc(spark.x + Math.cos(angle) * progress * 28, spark.y + Math.sin(angle) * progress * 20, 2, 0, Math.PI * 2);
          context.fill();
        }
        context.restore();
      });
    }
    if (current.status !== "complete") {
      context.save();
      context.shadowColor = "#75d8ff";
      context.shadowBlur = reducedMotion ? 0 : 12;
      context.fillStyle = "#ecfaff";
      context.beginPath();
      context.arc(current.ball.x, current.ball.y, breakoutBoard.ballRadius, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
    roundedRect(context, current.paddleX - breakoutBoard.paddleWidth / 2, breakoutBoard.paddleY, breakoutBoard.paddleWidth, breakoutBoard.paddleHeight, 6);
    context.fillStyle = "#75d8ff";
    context.fill();
    context.fillStyle = "rgba(247,247,244,.72)";
    context.fillRect(current.paddleX - breakoutBoard.paddleWidth / 2 + 8, breakoutBoard.paddleY + 2, breakoutBoard.paddleWidth - 16, 2);
    if (current.status !== "running") {
      const complete = current.status === "complete";
      roundedRect(context, 67, 329, canvasWidth - 134, complete ? 173 : 105, 18);
      context.fillStyle = "rgba(8,13,22,.92)";
      context.fill();
      context.strokeStyle = "rgba(117,216,255,.2)";
      context.lineWidth = 1;
      context.stroke();
      context.fillStyle = "#f7f7f4";
      context.font = '650 25px "Vazirmatn Variable", Tahoma, sans-serif';
      context.fillText(complete ? current.outcome === "won" ? copy.game.win : copy.game.result : actionLabel, canvasWidth / 2, 368, canvasWidth - 166);
      context.fillStyle = "rgba(247,247,244,.65)";
      context.font = '500 15px "Vazirmatn Variable", Tahoma, sans-serif';
      if (complete) {
        context.fillStyle = "#75d8ff";
        context.font = '750 46px "Vazirmatn Variable", Tahoma, sans-serif';
        context.fillText(String(current.score), canvasWidth / 2, 425);
        context.font = '500 17px "Vazirmatn Variable", Tahoma, sans-serif';
        context.fillText(`${copy.game.best}: ${bestRef.current}`, canvasWidth / 2, 466, canvasWidth - 166);
      } else context.fillText(copy.stations.game.instruction, canvasWidth / 2, 402, canvasWidth - 166);
    }
    context.fillStyle = "rgba(247,247,244,.56)";
    context.font = '500 14px "Vazirmatn Variable", Tahoma, sans-serif';
    context.fillText(`${copy.game.remaining}: ${cleared}`, canvasWidth / 2, 628, canvasWidth - 100);
    (Object.keys(gameControls) as Array<keyof typeof gameControls>).forEach((control) => {
      if (control === "action" && current.status === "complete") return;
      const bounds = gameControls[control];
      const enabled = control === "action" ? current.status !== "complete" : current.serves > 0;
      const focused = hoveredControl.current === control || focusedControl.current === control;
      const label = control === "reset" ? current.status === "complete" ? copy.replay : copy.reset
        : control === "finish" ? current.status === "complete" ? copy.continue : copy.game.finish : actionLabel;
      roundedRect(context, bounds.left * canvasWidth, 651, bounds.width * canvasWidth, 47, 23);
      context.fillStyle = control === "action" && enabled ? "#225cff" : focused ? "rgba(117,216,255,.13)" : "rgba(247,247,244,.05)";
      context.fill();
      context.strokeStyle = focused ? "#75d8ff" : "rgba(247,247,244,.24)";
      context.lineWidth = focused ? 2 : 1;
      context.stroke();
      context.fillStyle = enabled ? "#f7f7f4" : "rgba(247,247,244,.28)";
      context.font = '600 17px "Vazirmatn Variable", Tahoma, sans-serif';
      context.fillText(label, (bounds.left + bounds.width / 2) * canvasWidth, 681, bounds.width * canvasWidth - 14);
    });
    context.strokeStyle = hoveredControl.current === "close" || focusedControl.current === "close" ? "#75d8ff" : "rgba(247,247,244,.65)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(canvasWidth * 0.925 - 6, canvasHeight * 0.057 - 6);
    context.lineTo(canvasWidth * 0.925 + 6, canvasHeight * 0.057 + 6);
    context.moveTo(canvasWidth * 0.925 + 6, canvasHeight * 0.057 - 6);
    context.lineTo(canvasWidth * 0.925 - 6, canvasHeight * 0.057 + 6);
    context.stroke();
    context.restore();
    markInteractionCanvasDirty("game");
  }, [copy, reducedMotion]);

  const schedulePaint = useCallback(() => {
    if (renderFrame.current !== null) return;
    renderFrame.current = window.requestAnimationFrame(() => {
      renderFrame.current = null;
      paint();
    });
  }, [paint]);
  const releaseKeyboardControls = useCallback(() => {
    keyboardDirection.current = 0;
    heldDirection.current = 0;
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
    if (image.complete) begin();
    void document.fonts?.ready.then(() => { if (mounted) schedulePaint(); });
    return () => {
      mounted = false;
      image.onload = null;
      image.onerror = null;
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
        const movement = keyboardDirection.current || heldDirection.current;
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
    animationFrame.current = window.requestAnimationFrame(tick);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    return () => {
      if (animationFrame.current !== null) window.cancelAnimationFrame(animationFrame.current);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
    };
  }, [applyGame, paint, reducedMotion, releaseControls, schedulePaint]);

  useEffect(() => {
    const handleSceneInput = (event: SceneInteractionEvent) => {
      if (transitionState.current !== "ready" || event.phase === "activate") return;
      const control = controlAtPoint(event.x, event.y);
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
        }
        else if (control === "finish") finishOrContinue();
        else if (event.y >= breakoutBoard.top / canvasHeight && event.y <= 0.87 && game.current.status !== "complete") {
          activePointer.current = event.pointerId;
          if (event.y > 0.74 || game.current.status === "running") movePaddle(event.x * canvasWidth);
          if ((game.current.status === "ready" || game.current.status === "paused") && event.y >= 0.45 && event.y <= 0.64) action();
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
  }, [action, exitWithTransition, finishOrContinue, focusGameCanvas, movePaddle, onClose, reset, schedulePaint]);
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
    heldDirection.current = direction;
    movePaddle(game.current.paddleX + direction * 12);
  };
  const releasePaddle = () => { heldDirection.current = 0; };
  const nudgePaddle = (event: React.MouseEvent<HTMLButtonElement>, direction: -1 | 1) => {
    if (event.detail === 0) movePaddle(game.current.paddleX + direction * 38);
  };
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (transitionState.current !== "ready" || game.current.status === "complete") return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
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
    <>
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
            <span><bdi>{snapshot.score}</bdi> · {copy.game.lives}: <bdi>{snapshot.lives}</bdi> · <bdi>{time}</bdi>s</span>
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
    </>
  );
}
