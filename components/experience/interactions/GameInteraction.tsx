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
import styles from "./HeroInteractions.module.css";

const { width: canvasWidth, height: canvasHeight } = interactionSurfaceSizes.game.canvas;
const maxAttempts = 5;
const targetOrder = [0, 1, 2] as const;
const targetColors = ["#50c7ff", "#ef86ff", "#ffb54a"] as const;
const targetRadii = [48, 40, 34] as const;
type GamePoint = { x: number; y: number };
const targetCenters = [
  { x: 0.2, y: 0.29 },
  { x: 0.8, y: 0.29 },
  { x: 0.5, y: 0.18 },
] as const;
const launcher = { x: 0.5, y: 0.78 };

function getMovingTarget(index: number, elapsedSeconds: number, reducedMotion: boolean) {
  const base = targetCenters[index] ?? targetCenters[2];
  if (reducedMotion || index === 0) return { ...base };
  if (index === 1) {
    return {
      x: base.x + Math.sin(elapsedSeconds * 1.45) * 0.085,
      y: base.y,
    };
  }
  return {
    x: base.x + Math.sin(elapsedSeconds * 1.1) * 0.075,
    y: base.y + Math.cos(elapsedSeconds * 1.7) * 0.035,
  };
}

type GameStatus = "ready" | "dragging" | "flying" | "complete";

type GamePointer = {
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
};

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, value));
}

function distance(firstX: number, firstY: number, secondX: number, secondY: number) {
  return Math.hypot(firstX - secondX, firstY - secondY);
}

function revealProgress(progress: number, start: number, end: number) {
  const value = clamp((progress - start) / Math.max(0.001, end - start));
  return value * value * (3 - 2 * value);
}

function quadraticPoint(
  start: { x: number; y: number },
  control: { x: number; y: number },
  end: { x: number; y: number },
  progress: number,
) {
  const inverse = 1 - progress;
  return {
    x: inverse * inverse * start.x + 2 * inverse * progress * control.x + progress * progress * end.x,
    y: inverse * inverse * start.y + 2 * inverse * progress * control.y + progress * progress * end.y,
  };
}

function getLaunchSolution(
  pointer: { x: number; y: number },
  target: { x: number; y: number },
  targetIndex: number,
) {
  const pullX = launcher.x - pointer.x;
  const pullY = launcher.y - pointer.y;
  const pullLength = Math.hypot(pullX, pullY);
  const directionX = pullLength > 0.001 ? pullX / pullLength : 0;
  const directionY = pullLength > 0.001 ? pullY / pullLength : -1;
  const power = clamp(pullLength / 0.17);
  const travelDistance = 0.42 + power * 0.2;
  const rawEnd = {
    x: launcher.x + directionX * travelDistance,
    y: launcher.y + directionY * travelDistance,
  };
  const pixelDistance = Math.hypot(
    (rawEnd.x - target.x) * canvasWidth,
    (rawEnd.y - target.y) * canvasHeight,
  );
  const innerRadius = targetIndex === 0 ? 28 : targetIndex === 1 ? 23 : 19;
  const outerRadius = targetRadii[targetIndex] ?? targetRadii[2];
  const assistedRadius = outerRadius + (targetIndex === 0 ? 12 : 9);
  const result: 0 | 1 | 2 = pixelDistance <= innerRadius
    ? 2
    : pixelDistance <= assistedRadius
      ? 1
      : 0;
  const end = result === 1 && pixelDistance > outerRadius
    ? {
      x: rawEnd.x + (target.x - rawEnd.x) * 0.36,
      y: rawEnd.y + (target.y - rawEnd.y) * 0.36,
    }
    : rawEnd;
  return {
    pullLength,
    power,
    result,
    end,
    control: {
      x: launcher.x + (end.x - launcher.x) * 0.52,
      y: Math.min(launcher.y + (end.y - launcher.y) * 0.42, 0.43),
    },
  };
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function hitRect(x: number, y: number, left: number, top: number, width: number, height: number) {
  return x >= left && x <= left + width && y >= top && y <= top + height;
}

export function GameInteraction({
  copy,
  reducedMotion,
  onClose,
  onComplete,
  onContinue,
}: {
  copy: InteractionCopy;
  reducedMotion: boolean;
  onClose: () => void;
  onComplete: () => void;
  onContinue: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderFrame = useRef<number | null>(null);
  const motionFrame = useRef<number | null>(null);
  const transitionFrame = useRef<number | null>(null);
  const flightFrame = useRef<number | null>(null);
  const nextRoundTimer = useRef<number | null>(null);
  const completionTimer = useRef<number | null>(null);
  const flightTick = useRef<((time: number) => void) | null>(null);
  const transitionProgress = useRef(0);
  const transitionState = useRef<"intro" | "ready" | "outro">("intro");
  const monitorImage = useRef<HTMLImageElement | null>(null);
  const activePointer = useRef<GamePointer | null>(null);
  const statusRef = useRef<GameStatus>("ready");
  const roundRef = useRef(0);
  const completedRef = useRef([false, false, false]);
  const feedbackRef = useRef("");
  const hoverControl = useRef<"close" | "reset" | "continue" | "launch" | null>(null);
  const keyboardFocus = useRef<"close" | "reset" | "continue" | "launch" | null>(null);
  const flightStartedAt = useRef<number | null>(null);
  const flightDuration = useRef(reducedMotion ? 240 : 880);
  const flightStart = useRef<GamePoint>({ ...launcher });
  const flightControl = useRef<GamePoint>({ x: 0.5, y: 0.38 });
  const flightEnd = useRef<GamePoint>({ ...targetCenters[0] });
  const flightTargetCenter = useRef<GamePoint>({ ...targetCenters[0] });
  const flightTarget = useRef(0);
  const flightAccuracy = useRef(1);
  const flightResult = useRef<0 | 1 | 2>(0);
  const attemptsRef = useRef(0);
  const scoreRef = useRef(0);
  const gameStartedAt = useRef(0);
  const pausedTotal = useRef(0);
  const pausedAt = useRef<number | null>(null);
  const completionReported = useRef(false);
  const [status, setStatus] = useState<GameStatus>("ready");
  const [completed, setCompleted] = useState([false, false, false]);
  const [attempts, setAttempts] = useState(0);
  const [score, setScore] = useState(0);

  const updateStatus = useCallback((next: GameStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const getElapsedSeconds = useCallback(() => (
    (performance.now() - gameStartedAt.current - pausedTotal.current) / 1000
  ), []);

  const syncRuntime = useCallback(() => {
    const targetIndex = targetOrder[roundRef.current] ?? 2;
    const target = statusRef.current === "flying"
      ? flightTargetCenter.current
      : getMovingTarget(targetIndex, getElapsedSeconds(), reducedMotion);
    const base = targetCenters[targetIndex];
    interactionRuntime.gameVisibility = transitionProgress.current;
    interactionRuntime.gameTarget = targetIndex;
    interactionRuntime.gameGateOffsetX = target.x - base.x;
    interactionRuntime.gameGateOffsetY = target.y - base.y;
    interactionRuntime.gameCompletedTargets = [...completedRef.current];
    interactionRuntime.gameComplete = statusRef.current === "complete";
  }, [getElapsedSeconds, reducedMotion]);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const width = canvas.width;
    const height = canvas.height;
    const now = performance.now();
    const transition = transitionProgress.current;
    const surfaceReveal = revealProgress(transition, 0, 0.38);
    const controlsReveal = revealProgress(transition, 0.62, 1);
    const direction = document.documentElement.dir === "rtl" ? "rtl" : "ltr";
    const currentTarget = targetOrder[roundRef.current] ?? 2;
    const activeStatus = statusRef.current;
    const currentTargetPoint = activeStatus === "flying"
      ? flightTargetCenter.current
      : getMovingTarget(currentTarget, getElapsedSeconds(), reducedMotion);
    syncRuntime();

    context.clearRect(0, 0, width, height);
    canvas.dataset.transitionProgress = transition.toFixed(3);
    if (monitorImage.current?.complete) {
      context.drawImage(monitorImage.current, 0, 0, width, height);
    } else {
      context.fillStyle = "#080b10";
      context.fillRect(0, 0, width, height);
    }

    context.save();
    context.globalAlpha = surfaceReveal;
    const background = context.createRadialGradient(width * 0.5, height * 0.36, 10, width * 0.5, height * 0.45, height * 0.78);
    background.addColorStop(0, "#102340");
    background.addColorStop(0.52, "#07111f");
    background.addColorStop(1, "#020509");
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    context.strokeStyle = "rgba(117,216,255,.1)";
    context.lineWidth = 1;
    const vanishingX = width * 0.5;
    const vanishingY = height * 0.35;
    for (let index = -5; index <= 5; index += 1) {
      context.beginPath();
      context.moveTo(vanishingX, vanishingY);
      context.lineTo(width * (0.5 + index * 0.18), height * 0.88);
      context.stroke();
    }
    for (let index = 0; index < 7; index += 1) {
      const progress = index / 6;
      const eased = progress * progress;
      const y = vanishingY + eased * height * 0.53;
      context.beginPath();
      context.moveTo(width * (0.5 - eased * 0.72), y);
      context.lineTo(width * (0.5 + eased * 0.72), y);
      context.stroke();
    }

    roundedRect(context, 12, 12, width - 24, height - 24, 24);
    context.strokeStyle = "rgba(117,216,255,.19)";
    context.lineWidth = 2;
    context.stroke();

    context.save();
    context.direction = direction;
    context.textAlign = "center";
    context.fillStyle = "rgba(247,247,244,.5)";
    context.font = '650 11px "Vazirmatn Variable", Tahoma, sans-serif';
    context.letterSpacing = "3px";
    context.fillText("MANDEGAR  /  SIGNAL TOSS", width / 2, 30);
    context.letterSpacing = "0px";
    context.fillStyle = "#f7f7f4";
    context.font = '700 23px "Vazirmatn Variable", Tahoma, sans-serif';
    context.fillText(
      activeStatus === "complete"
        ? completedRef.current.every(Boolean) ? copy.game.perfect : copy.game.result
        : feedbackRef.current || copy.stations.game.instruction,
      width / 2,
      62,
    );
    context.fillStyle = "rgba(247,247,244,.55)";
    context.font = '700 12px "Vazirmatn Variable", Tahoma, sans-serif';
    context.fillText(
      `${completedRef.current.filter(Boolean).length} / 3   ·   ${scoreRef.current} PTS   ·   ${attemptsRef.current} / ${maxAttempts}`,
      width / 2,
      84,
    );
    context.restore();

    const connection = context.createLinearGradient(width * 0.2, 0, width * 0.8, 0);
    connection.addColorStop(0, `${targetColors[0]}55`);
    connection.addColorStop(0.5, `${targetColors[2]}55`);
    connection.addColorStop(1, `${targetColors[1]}55`);
    context.strokeStyle = connection;
    context.lineWidth = activeStatus === "complete" ? 4 : 1.5;
    context.beginPath();
    context.moveTo(targetCenters[0].x * width, targetCenters[0].y * height);
    context.lineTo(targetCenters[2].x * width, targetCenters[2].y * height);
    context.lineTo(targetCenters[1].x * width, targetCenters[1].y * height);
    context.stroke();

    targetCenters.forEach((baseCenter, index) => {
      const center = index === currentTarget && activeStatus !== "complete"
        ? currentTargetPoint
        : baseCenter;
      const x = center.x * width;
      const y = center.y * height;
      const color = targetColors[index];
      const isCurrent = activeStatus !== "complete" && currentTarget === index;
      const isComplete = completedRef.current[index];
      const pulse = 0.5 + Math.sin(now * 0.005 + index) * 0.5;
      const baseRadius = targetRadii[index];
      const radius = isCurrent ? baseRadius + pulse * 5 : isComplete ? baseRadius : baseRadius * 0.82;
      context.save();
      context.shadowColor = color;
      context.shadowBlur = isComplete ? 26 : isCurrent ? 18 + pulse * 10 : 0;
      context.strokeStyle = isComplete || isCurrent ? color : "rgba(247,247,244,.16)";
      context.lineWidth = isComplete ? 5 : isCurrent ? 3 : 1.5;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.stroke();
      context.shadowBlur = 0;
      context.strokeStyle = isCurrent ? `${color}99` : `${color}33`;
      context.lineWidth = 1;
      context.beginPath();
      context.arc(x, y, radius + 10, now * 0.0014 + index, now * 0.0014 + index + Math.PI * 1.22);
      context.stroke();
      context.fillStyle = isComplete ? color : isCurrent ? "#f7f7f4" : "rgba(247,247,244,.3)";
      context.font = '800 13px "Vazirmatn Variable", Tahoma, sans-serif';
      context.textAlign = "center";
      context.fillText(isComplete ? "✓" : String(index + 1).padStart(2, "0"), x, y + 5);
      context.restore();
    });

    let orbPoint = { ...launcher };
    let previewSolution: ReturnType<typeof getLaunchSolution> | null = null;
    if (activeStatus === "dragging" && activePointer.current) {
      orbPoint = {
        x: clamp(activePointer.current.x, 0.12, 0.88),
        y: clamp(activePointer.current.y, 0.56, 0.96),
      };
      previewSolution = getLaunchSolution(orbPoint, currentTargetPoint, currentTarget);
    } else if (activeStatus === "flying" && flightStartedAt.current !== null) {
      const rawProgress = clamp((now - flightStartedAt.current) / flightDuration.current);
      const travel = 1 - Math.pow(1 - rawProgress, 3);
      orbPoint = quadraticPoint(
        flightStart.current,
        flightControl.current,
        flightEnd.current,
        travel,
      );
      for (let trailIndex = 7; trailIndex >= 1; trailIndex -= 1) {
        const trailProgress = clamp(travel - trailIndex * 0.035);
        const trailPoint = quadraticPoint(
          flightStart.current,
          flightControl.current,
          flightEnd.current,
          trailProgress,
        );
        context.globalAlpha = surfaceReveal * (1 - trailIndex / 9) * 0.54;
        context.fillStyle = targetColors[flightTarget.current];
        context.beginPath();
        context.arc(trailPoint.x * width, trailPoint.y * height, 12 - trailIndex, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = surfaceReveal;
    }

    if (activeStatus === "ready" || activeStatus === "dragging") {
      context.save();
      context.setLineDash([7, 10]);
      context.lineDashOffset = -now * 0.025;
      context.strokeStyle = `${targetColors[currentTarget]}72`;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(launcher.x * width, launcher.y * height);
      if (previewSolution) {
        context.quadraticCurveTo(
          previewSolution.control.x * width,
          previewSolution.control.y * height,
          previewSolution.end.x * width,
          previewSolution.end.y * height,
        );
      } else {
        context.quadraticCurveTo(
          width * 0.5,
          height * 0.46,
          currentTargetPoint.x * width,
          currentTargetPoint.y * height,
        );
      }
      context.stroke();
      context.restore();
      if (previewSolution) {
        context.strokeStyle = "rgba(247,247,244,.42)";
        context.lineWidth = 3 + previewSolution.power * 3;
        context.beginPath();
        context.moveTo(launcher.x * width - 13, launcher.y * height);
        context.lineTo(orbPoint.x * width, orbPoint.y * height);
        context.lineTo(launcher.x * width + 13, launcher.y * height);
        context.stroke();
      }
    }

    if (activeStatus !== "complete") {
      const orbColor = targetColors[activeStatus === "flying" ? flightTarget.current : currentTarget];
      const orbX = orbPoint.x * width;
      const orbY = orbPoint.y * height;
      const orbRadius = activeStatus === "dragging" ? 30 : 25 + Math.sin(now * 0.007) * 2;
      const glow = context.createRadialGradient(orbX, orbY, 1, orbX, orbY, orbRadius * 2.8);
      glow.addColorStop(0, "rgba(255,255,255,1)");
      glow.addColorStop(0.2, orbColor);
      glow.addColorStop(0.48, `${orbColor}76`);
      glow.addColorStop(1, `${orbColor}00`);
      context.fillStyle = glow;
      context.beginPath();
      context.arc(orbX, orbY, orbRadius * 2.8, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#f7f7f4";
      context.beginPath();
      context.arc(orbX, orbY, 7, 0, Math.PI * 2);
      context.fill();
    } else {
      const finale = context.createRadialGradient(width * 0.5, height * 0.52, 4, width * 0.5, height * 0.52, width * 0.38);
      finale.addColorStop(0, "rgba(247,247,244,.9)");
      finale.addColorStop(0.15, "rgba(117,216,255,.42)");
      finale.addColorStop(1, "rgba(34,92,255,0)");
      context.fillStyle = finale;
      context.beginPath();
      context.arc(width * 0.5, height * 0.52, width * 0.38, 0, Math.PI * 2);
      context.fill();
    }

    for (let index = 0; index < maxAttempts; index += 1) {
      context.beginPath();
      context.arc(width * 0.5 + (index - 2) * 19, height * 0.86, 4.5, 0, Math.PI * 2);
      context.fillStyle = index < attemptsRef.current
        ? "rgba(247,247,244,.32)"
        : "rgba(117,216,255,.82)";
      context.fill();
    }

    const closeX = width * 0.92;
    const closeY = height * 0.062;
    const closeFocused = hoverControl.current === "close" || keyboardFocus.current === "close";
    context.fillStyle = closeFocused ? "rgba(117,216,255,.18)" : "rgba(3,8,16,.58)";
    context.beginPath();
    context.arc(closeX, closeY, 18, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = closeFocused ? "#f7f7f4" : "rgba(247,247,244,.55)";
    context.lineWidth = closeFocused ? 3 : 1.5;
    context.stroke();
    context.strokeStyle = "#f7f7f4";
    context.lineWidth = 1.7;
    context.beginPath();
    context.moveTo(closeX - 5, closeY - 5);
    context.lineTo(closeX + 5, closeY + 5);
    context.moveTo(closeX + 5, closeY - 5);
    context.lineTo(closeX - 5, closeY + 5);
    context.stroke();

    const drawButton = (
      left: number,
      buttonWidth: number,
      label: string,
      enabled: boolean,
      focused: boolean,
      primary = false,
    ) => {
      const top = height * 0.895;
      const buttonHeight = height * 0.065;
      roundedRect(context, left, top, buttonWidth, buttonHeight, buttonHeight / 2);
      context.fillStyle = primary && enabled ? "#225cff" : "rgba(5,14,28,.96)";
      context.shadowColor = primary && enabled ? "#225cff" : "transparent";
      context.shadowBlur = primary && enabled ? 16 : 0;
      context.fill();
      context.shadowBlur = 0;
      context.strokeStyle = focused
        ? "#f7f7f4"
        : enabled
          ? "rgba(117,216,255,.82)"
          : "rgba(117,216,255,.2)";
      context.lineWidth = focused ? 3 : 1.5;
      context.stroke();
      context.direction = direction;
      context.fillStyle = enabled ? "#f7f7f4" : "rgba(247,247,244,.34)";
      context.font = '700 13px "Vazirmatn Variable", Tahoma, sans-serif';
      context.textAlign = "center";
      context.fillText(label, left + buttonWidth / 2, top + buttonHeight * 0.63);
    };
    context.save();
    context.globalAlpha = surfaceReveal * controlsReveal;
    drawButton(
      width * 0.045,
      width * 0.32,
      activeStatus === "complete" ? copy.replay : copy.reset,
      activeStatus !== "flying" && (completedRef.current.some(Boolean) || activeStatus === "complete"),
      hoverControl.current === "reset" || keyboardFocus.current === "reset",
    );
    drawButton(
      width * 0.635,
      width * 0.32,
      copy.continue,
      activeStatus === "complete",
      hoverControl.current === "continue" || keyboardFocus.current === "continue",
      true,
    );
    context.restore();
    context.restore();
    markInteractionCanvasDirty("game");
  }, [copy, getElapsedSeconds, reducedMotion, syncRuntime]);

  const schedulePaint = useCallback(() => {
    if (renderFrame.current !== null) return;
    renderFrame.current = window.requestAnimationFrame(() => {
      renderFrame.current = null;
      paint();
    });
  }, [paint]);

  const clearRoundTimers = useCallback(() => {
    if (nextRoundTimer.current !== null) window.clearTimeout(nextRoundTimer.current);
    if (completionTimer.current !== null) window.clearTimeout(completionTimer.current);
    nextRoundTimer.current = null;
    completionTimer.current = null;
  }, []);

  const finishFlight = useCallback(() => {
    const target = flightTarget.current;
    const nextCompleted = [...completedRef.current];
    const hit = flightResult.current > 0;
    if (hit) nextCompleted[target] = true;
    const nextAttempts = attemptsRef.current + 1;
    const earnedScore = flightResult.current === 2 ? 100 : flightResult.current === 1 ? 50 : 0;
    const nextScore = scoreRef.current + earnedScore;
    attemptsRef.current = nextAttempts;
    scoreRef.current = nextScore;
    completedRef.current = nextCompleted;
    setAttempts(nextAttempts);
    setScore(nextScore);
    setCompleted(nextCompleted);
    interactionRuntime.gameCompletedTargets = [...nextCompleted];
    feedbackRef.current = flightResult.current === 2
      ? copy.game.hit
      : flightResult.current === 1
        ? copy.game.outer
        : copy.game.missed;
    const allConnected = nextCompleted.every(Boolean);
    const outOfShots = nextAttempts >= maxAttempts;
    if (allConnected || outOfShots) {
      updateStatus("complete");
      interactionRuntime.gameComplete = true;
      schedulePaint();
      if (!completionReported.current) {
        completionReported.current = true;
        completionTimer.current = window.setTimeout(() => {
          completionTimer.current = null;
          onComplete();
        }, 260);
      }
      return;
    }
    if (hit) roundRef.current += 1;
    interactionRuntime.gameTarget = targetOrder[roundRef.current];
    nextRoundTimer.current = window.setTimeout(() => {
      nextRoundTimer.current = null;
      feedbackRef.current = "";
      updateStatus("ready");
      schedulePaint();
    }, reducedMotion ? 0 : 650);
    schedulePaint();
  }, [copy.game.hit, copy.game.missed, copy.game.outer, onComplete, reducedMotion, schedulePaint, updateStatus]);

  const startFlightAnimation = useCallback(() => {
    if (flightFrame.current !== null) window.cancelAnimationFrame(flightFrame.current);
    flightStartedAt.current = performance.now();
    const tick = (time: number) => {
      if (document.hidden) {
        flightFrame.current = null;
        return;
      }
      paint();
      if (flightStartedAt.current !== null && time - flightStartedAt.current < flightDuration.current) {
        flightFrame.current = window.requestAnimationFrame(tick);
        return;
      }
      flightFrame.current = null;
      finishFlight();
    };
    flightTick.current = tick;
    flightFrame.current = window.requestAnimationFrame(tick);
  }, [finishFlight, paint]);

  const launch = useCallback((pointer: GamePointer | null) => {
    if (statusRef.current !== "ready" && statusRef.current !== "dragging") return;
    const targetIndex = targetOrder[roundRef.current] ?? 2;
    const target = getMovingTarget(targetIndex, getElapsedSeconds(), reducedMotion);
    const targetVectorX = target.x - launcher.x;
    const targetVectorY = target.y - launcher.y;
    const targetDistance = Math.hypot(targetVectorX, targetVectorY);
    const pullPoint = pointer
      ? { x: clamp(pointer.x, 0.12, 0.88), y: clamp(pointer.y, 0.56, 0.96) }
      : {
        x: launcher.x - targetVectorX / targetDistance * 0.17,
        y: launcher.y - targetVectorY / targetDistance * 0.17,
      };
    const solution = getLaunchSolution(pullPoint, target, targetIndex);
    if (pointer && solution.pullLength < 0.045) {
      activePointer.current = null;
      updateStatus("ready");
      schedulePaint();
      return;
    }
    flightStart.current = { ...launcher };
    flightControl.current = solution.control;
    flightEnd.current = solution.end;
    flightTargetCenter.current = target;
    flightTarget.current = targetIndex;
    flightResult.current = solution.result;
    flightAccuracy.current = solution.result === 2 ? 1 : solution.result === 1 ? 0.68 : 0.24;
    feedbackRef.current = "";
    activePointer.current = null;
    updateStatus("flying");
    const baseTarget = targetCenters[targetIndex];
    interactionRuntime.gameLaunchTarget = targetIndex;
    interactionRuntime.gameLaunchAccuracy = flightAccuracy.current;
    interactionRuntime.gameLaunchDestinationX = solution.end.x - baseTarget.x;
    interactionRuntime.gameLaunchDestinationY = solution.end.y - baseTarget.y;
    interactionRuntime.gameLaunchResult = solution.result;
    interactionRuntime.gameGateOffsetX = target.x - baseTarget.x;
    interactionRuntime.gameGateOffsetY = target.y - baseTarget.y;
    interactionRuntime.gameLaunchId += 1;
    startFlightAnimation();
  }, [getElapsedSeconds, reducedMotion, schedulePaint, startFlightAnimation, updateStatus]);

  const reset = useCallback(() => {
    if (flightFrame.current !== null) window.cancelAnimationFrame(flightFrame.current);
    flightFrame.current = null;
    flightStartedAt.current = null;
    activePointer.current = null;
    clearRoundTimers();
    roundRef.current = 0;
    attemptsRef.current = 0;
    scoreRef.current = 0;
    gameStartedAt.current = performance.now();
    pausedTotal.current = 0;
    completedRef.current = [false, false, false];
    feedbackRef.current = "";
    setCompleted([false, false, false]);
    setAttempts(0);
    setScore(0);
    updateStatus("ready");
    interactionRuntime.gameTarget = targetOrder[0];
    interactionRuntime.gameCompletedTargets = [false, false, false];
    interactionRuntime.gameComplete = false;
    interactionRuntime.gameGateOffsetX = 0;
    interactionRuntime.gameGateOffsetY = 0;
    schedulePaint();
  }, [clearRoundTimers, schedulePaint, updateStatus]);

  const animateTransition = useCallback((target: 0 | 1, onFinish?: () => void) => {
    if (transitionFrame.current !== null) window.cancelAnimationFrame(transitionFrame.current);
    const from = transitionProgress.current;
    const duration = reducedMotion ? 0 : target === 1 ? 900 : 560;
    transitionState.current = target === 1 ? "intro" : "outro";
    if (duration === 0 || Math.abs(target - from) < 0.001) {
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
      if (elapsed < 1) {
        transitionFrame.current = window.requestAnimationFrame(tick);
        return;
      }
      transitionFrame.current = null;
      transitionState.current = target === 1 ? "ready" : "outro";
      onFinish?.();
    };
    transitionFrame.current = window.requestAnimationFrame(tick);
  }, [paint, reducedMotion]);

  const exitWithTransition = useCallback((callback: () => void) => {
    if (transitionState.current === "outro") return;
    if (flightFrame.current !== null) window.cancelAnimationFrame(flightFrame.current);
    flightFrame.current = null;
    flightStartedAt.current = null;
    activePointer.current = null;
    hoverControl.current = null;
    animateTransition(0, callback);
  }, [animateTransition]);

  const closeWithTransition = useCallback(() => {
    clearRoundTimers();
    exitWithTransition(onClose);
  }, [clearRoundTimers, exitWithTransition, onClose]);

  const continueWithTransition = useCallback(() => {
    exitWithTransition(onContinue);
  }, [exitWithTransition, onContinue]);

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
      gameStartedAt.current = performance.now();
      transitionProgress.current = 0;
      interactionRuntime.gameVisibility = 0;
      paint();
      registerInteractionCanvas("game", canvas);
      animateTransition(1);
    };
    image.onload = begin;
    image.onerror = begin;
    image.src = sceneTokens.bakedScene.screens.game;
    if (image.complete) begin();
    void document.fonts?.ready.then(() => {
      if (mounted) schedulePaint();
    });
    return () => {
      mounted = false;
      image.onload = null;
      image.onerror = null;
      registerInteractionCanvas("game", null);
    };
  }, [animateTransition, paint, schedulePaint]);

  useEffect(() => {
    if (reducedMotion) return;
    let lastPaint = 0;
    const tick = (time: number) => {
      if (
        !document.hidden
        && transitionState.current === "ready"
        && (statusRef.current === "ready" || statusRef.current === "dragging")
        && time - lastPaint >= 1000 / 30
      ) {
        lastPaint = time;
        paint();
      }
      motionFrame.current = window.requestAnimationFrame(tick);
    };
    motionFrame.current = window.requestAnimationFrame(tick);
    return () => {
      if (motionFrame.current !== null) window.cancelAnimationFrame(motionFrame.current);
      motionFrame.current = null;
    };
  }, [paint, reducedMotion]);

  useEffect(() => {
    const handleSceneInput = (event: SceneInteractionEvent) => {
      if (transitionState.current !== "ready" || event.phase === "activate") return;
      const point = { x: event.x, y: event.y };
      if (event.phase === "move") {
        const pointer = activePointer.current;
        if (pointer?.pointerId === event.pointerId) {
          pointer.x = point.x;
          pointer.y = point.y;
          schedulePaint();
          return;
        }
        hoverControl.current = distance(point.x, point.y, 0.92, 0.062) <= 0.075
          ? "close"
          : hitRect(point.x, point.y, 0.025, 0.86, 0.38, 0.14)
            ? "reset"
            : hitRect(point.x, point.y, 0.595, 0.86, 0.405, 0.14)
              ? "continue"
              : distance(point.x, point.y, launcher.x, launcher.y) <= 0.2
                ? "launch"
                : null;
        schedulePaint();
        return;
      }

      if (event.phase === "down") {
        if (distance(point.x, point.y, 0.92, 0.062) <= 0.075) {
          closeWithTransition();
          return;
        }
        if (hitRect(point.x, point.y, 0.025, 0.86, 0.38, 0.14)) {
          if (statusRef.current !== "flying" && (completedRef.current.some(Boolean) || statusRef.current === "complete")) reset();
          return;
        }
        if (hitRect(point.x, point.y, 0.595, 0.86, 0.405, 0.14)) {
          if (statusRef.current === "complete") continueWithTransition();
          return;
        }
        if (
          statusRef.current !== "ready"
          || distance(point.x, point.y, launcher.x, launcher.y) > 0.2
        ) return;
        activePointer.current = {
          pointerId: event.pointerId,
          startX: point.x,
          startY: point.y,
          x: point.x,
          y: point.y,
        };
        updateStatus("dragging");
        schedulePaint();
        return;
      }

      if (event.phase === "cancel") {
        activePointer.current = null;
        if (statusRef.current === "dragging") updateStatus("ready");
        hoverControl.current = null;
        schedulePaint();
        return;
      }

      if (event.phase !== "up") return;
      const pointer = activePointer.current;
      if (!pointer || pointer.pointerId !== event.pointerId) return;
      pointer.x = point.x;
      pointer.y = point.y;
      launch(pointer);
    };
    registerSceneInteraction("game", handleSceneInput);
    return () => registerSceneInteraction("game", null);
  }, [closeWithTransition, continueWithTransition, launch, reset, schedulePaint, updateStatus]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        pausedAt.current = performance.now();
        if (statusRef.current === "dragging") {
          activePointer.current = null;
          updateStatus("ready");
        }
        return;
      }
      if (pausedAt.current !== null && flightStartedAt.current !== null) {
        flightStartedAt.current += performance.now() - pausedAt.current;
      }
      if (pausedAt.current !== null) pausedTotal.current += performance.now() - pausedAt.current;
      pausedAt.current = null;
      if (statusRef.current === "flying" && flightFrame.current === null && flightTick.current) {
        flightFrame.current = window.requestAnimationFrame(flightTick.current);
      }
      schedulePaint();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [schedulePaint, updateStatus]);

  useEffect(() => () => {
    if (renderFrame.current !== null) window.cancelAnimationFrame(renderFrame.current);
    if (motionFrame.current !== null) window.cancelAnimationFrame(motionFrame.current);
    if (transitionFrame.current !== null) window.cancelAnimationFrame(transitionFrame.current);
    if (flightFrame.current !== null) window.cancelAnimationFrame(flightFrame.current);
    clearRoundTimers();
    interactionRuntime.gameVisibility = 0;
    interactionRuntime.gameTarget = 0;
    interactionRuntime.gameLaunchDestinationX = 0;
    interactionRuntime.gameLaunchDestinationY = 0;
    interactionRuntime.gameLaunchResult = 0;
    interactionRuntime.gameGateOffsetX = 0;
    interactionRuntime.gameGateOffsetY = 0;
    interactionRuntime.gameCompletedTargets = [false, false, false];
    interactionRuntime.gameComplete = false;
  }, [clearRoundTimers]);

  const focusControl = (control: "close" | "reset" | "continue" | "launch" | null) => {
    keyboardFocus.current = control;
    hoverControl.current = control;
    schedulePaint();
  };

  return (
    <div
      className={styles.spatialInteractionSemantics}
      data-game-spatial-controls
      data-game-status={status}
      data-game-completed-count={completed.filter(Boolean).length}
      data-game-attempts={attempts}
      data-game-score={score}
      role="region"
      aria-label={copy.stations.game.title}
    >
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        className={styles.textureSource}
        data-game-canvas
        aria-hidden="true"
      />
      <p>{copy.stations.game.instruction}</p>
      <button
        type="button"
        disabled={status === "flying" || status === "complete"}
        onFocus={() => focusControl("launch")}
        onBlur={() => focusControl(null)}
        onClick={() => launch(null)}
      >
        {copy.game.action}
      </button>
      <button
        type="button"
        disabled={status === "flying" || (!completed.some(Boolean) && status !== "complete")}
        onFocus={() => focusControl("reset")}
        onBlur={() => focusControl(null)}
        onClick={reset}
      >
        {status === "complete" ? copy.replay : copy.reset}
      </button>
      <button
        type="button"
        disabled={status !== "complete"}
        onFocus={() => focusControl("continue")}
        onBlur={() => focusControl(null)}
        onClick={continueWithTransition}
      >
        {copy.continue}
      </button>
      <button
        type="button"
        data-interaction-dismiss
        onFocus={() => focusControl("close")}
        onBlur={() => focusControl(null)}
        onClick={closeWithTransition}
      >
        {copy.close}
      </button>
      <span role="status" aria-live="polite">
        {status === "complete"
          ? completed.every(Boolean) ? copy.game.perfect : copy.game.result
          : `${completed.filter(Boolean).length} / 3 · ${score} · ${attempts} / ${maxAttempts}`}
      </span>
    </div>
  );
}
