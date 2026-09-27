"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { InteractionCopy } from "./interaction-copy";
import {
  interactionRuntime,
  markPhotoSurfaceDirty,
  registerPhotoSurface,
  registerSceneInteraction,
} from "./interaction-runtime";
import type { SceneInteractionEvent } from "./interaction-types";
import styles from "./HeroInteractions.module.css";

type PhotoStep = "ready" | "countdown" | "captured";
type PhotoControl = "capture" | "replay" | "continue";

const canvasWidth = 800;
const canvasHeight = 520;

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

function revealProgress(progress: number, start: number, end: number) {
  const value = Math.max(0, Math.min(1, (progress - start) / (end - start)));
  return value * value * (3 - 2 * value);
}

function controlAtPoint(step: PhotoStep, x: number, y: number): PhotoControl | null {
  if (step === "captured") {
    if (hitRect(x, y, 0.24, 0.1, 0.38, 0.64)) return "replay";
    if (hitRect(x, y, 0.58, 0.78, 0.34, 0.13)) return "continue";
  }
  return null;
}

export function PhotoBoothInteraction({
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
  const timers = useRef<number[]>([]);
  const countdownFrame = useRef<number | null>(null);
  const renderFrame = useRef<number | null>(null);
  const transitionFrame = useRef<number | null>(null);
  const transitionProgress = useRef(0);
  const transitionState = useRef<"intro" | "ready" | "outro">("intro");
  const stepRef = useRef<PhotoStep>("ready");
  const countRef = useRef(3);
  const hoverControl = useRef<PhotoControl | null>(null);
  const keyboardFocus = useRef<PhotoControl | null>(null);
  const completionReported = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const [step, setStep] = useState<PhotoStep>("ready");
  const [count, setCount] = useState(3);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
    if (countdownFrame.current !== null) {
      window.cancelAnimationFrame(countdownFrame.current);
      countdownFrame.current = null;
    }
  }, []);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const width = canvas.width;
    const height = canvas.height;
    const direction = document.documentElement.dir === "rtl" ? "rtl" : "ltr";
    const currentStep = stepRef.current;
    const currentCount = countRef.current;
    const transition = transitionProgress.current;
    const surfaceReveal = revealProgress(transition, 0, 0.38);
    const contentReveal = revealProgress(transition, 0.2, 0.72);
    const controlsReveal = revealProgress(transition, 0.62, 1);

    interactionRuntime.photoStep = currentStep;
    interactionRuntime.photoCount = currentCount;
    interactionRuntime.photoVisibility = transition;
    context.clearRect(0, 0, width, height);
    canvas.dataset.paintedPhotoState = currentStep;
    canvas.dataset.paintedPhotoCount = String(currentCount);
    canvas.dataset.transitionProgress = transition.toFixed(3);

    context.save();
    context.globalAlpha = surfaceReveal;
    const centerX = width / 2;
    const centerY = height * 0.42;
    if (currentStep === "countdown") {
      context.save();
      context.globalAlpha = contentReveal;
      context.fillStyle = "#fff7ee";
      context.font = '780 142px "Vazirmatn Variable", Tahoma, sans-serif';
      context.textAlign = "center";
      context.shadowColor = "#ffb56d";
      context.shadowBlur = 32;
      context.fillText(String(currentCount), centerX, centerY + 48);
      context.shadowBlur = 0;
      context.restore();
    }

    const drawButton = (
      control: PhotoControl,
      left: number,
      top: number,
      buttonWidth: number,
      buttonHeight: number,
      label: string,
      primary: boolean,
    ) => {
      const focused = hoverControl.current === control || keyboardFocus.current === control;
      roundedRect(context, left, top, buttonWidth, buttonHeight, buttonHeight / 2);
      context.fillStyle = primary ? "#225cff" : focused ? "rgba(117,216,255,.14)" : "rgba(5,14,28,.94)";
      context.shadowColor = primary ? "#225cff" : "transparent";
      context.shadowBlur = primary ? 18 : 0;
      context.fill();
      context.shadowBlur = 0;
      context.strokeStyle = focused ? "#f7f7f4" : "rgba(117,216,255,.76)";
      context.lineWidth = focused ? 3 : 1.5;
      context.stroke();
      context.direction = direction;
      context.textAlign = "center";
      context.fillStyle = "#f7f7f4";
      context.font = '680 16px "Vazirmatn Variable", Tahoma, sans-serif';
      context.fillText(label, left + buttonWidth / 2, top + buttonHeight * 0.62);
    };

    context.save();
    context.globalAlpha = controlsReveal;
    if (currentStep === "captured") {
      drawButton("continue", width * 0.57, height * 0.8, width * 0.35, height * 0.11, copy.continue, true);
    }
    context.restore();
    context.restore();

    markPhotoSurfaceDirty();
  }, [copy]);

  const schedulePaint = useCallback(() => {
    if (renderFrame.current !== null) return;
    renderFrame.current = window.requestAnimationFrame(() => {
      renderFrame.current = null;
      paint();
    });
  }, [paint]);

  const commitCount = useCallback((nextCount: number) => {
    countRef.current = nextCount;
    setCount(nextCount);
    paint();
  }, [paint]);

  const commitStep = useCallback((nextStep: PhotoStep) => {
    stepRef.current = nextStep;
    interactionRuntime.photoStep = nextStep;
    setStep(nextStep);
    paint();
  }, [paint]);

  const finishCapture = useCallback(() => {
    commitStep("captured");
    if (!completionReported.current) {
      completionReported.current = true;
      onCompleteRef.current();
    }
  }, [commitStep]);

  const capture = useCallback(() => {
    if (stepRef.current !== "ready") return;
    clearTimers();
    commitCount(3);
    if (reducedMotion) {
      finishCapture();
      return;
    }
    commitStep("countdown");
    const startedAt = performance.now();
    const advanceCountdown = (time: number) => {
      if (stepRef.current !== "countdown") {
        countdownFrame.current = null;
        return;
      }
      const elapsed = time - startedAt;
      const nextCount = elapsed < 620 ? 3 : elapsed < 1240 ? 2 : 1;
      if (countRef.current !== nextCount) commitCount(nextCount);
      if (elapsed >= 1900) {
        countdownFrame.current = null;
        finishCapture();
        return;
      }
      countdownFrame.current = window.requestAnimationFrame(advanceCountdown);
    };
    countdownFrame.current = window.requestAnimationFrame(advanceCountdown);
  }, [clearTimers, commitCount, commitStep, finishCapture, reducedMotion]);

  const replay = useCallback(() => {
    clearTimers();
    commitCount(3);
    commitStep("ready");
    timers.current.push(window.setTimeout(capture, 700));
  }, [capture, clearTimers, commitCount, commitStep]);

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
      const elapsed = Math.min(1, (time - startedAt) / duration);
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
    clearTimers();
    hoverControl.current = null;
    document.body.style.cursor = "";
    animateTransition(0, callback);
  }, [animateTransition, clearTimers]);

  const handleControl = useCallback((control: PhotoControl) => {
    if (control === "capture") capture();
    else if (control === "replay") replay();
    else if (control === "continue") exitWithTransition(onContinue);
  }, [capture, exitWithTransition, onContinue, replay]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    clearTimers();
    transitionProgress.current = 0;
    transitionState.current = "intro";
    stepRef.current = "ready";
    countRef.current = 3;
    completionReported.current = false;
    setStep("ready");
    setCount(3);
    interactionRuntime.photoStep = "ready";
    interactionRuntime.photoCount = 3;
    interactionRuntime.photoVisibility = 0;
    registerPhotoSurface(canvas);
    paint();
    capture();
    animateTransition(1);
    void document.fonts?.ready.then(schedulePaint);
    return () => {
      registerPhotoSurface(null);
      interactionRuntime.photoStep = "idle";
      interactionRuntime.photoCount = 3;
      interactionRuntime.photoVisibility = 0;
    };
  }, [animateTransition, capture, clearTimers, paint, schedulePaint]);

  useEffect(() => {
    const handleSceneInput = (event: SceneInteractionEvent) => {
      if (transitionState.current !== "ready" || event.phase === "activate") return;
      const control = controlAtPoint(stepRef.current, event.x, event.y);
      if (event.phase === "move") {
        hoverControl.current = control;
        schedulePaint();
      } else if (event.phase === "down" && control) {
        handleControl(control);
      } else if (event.phase === "cancel") {
        hoverControl.current = null;
        schedulePaint();
      }
    };
    registerSceneInteraction("photo", handleSceneInput);
    return () => registerSceneInteraction("photo", null);
  }, [handleControl, schedulePaint]);

  useEffect(() => () => {
    clearTimers();
    document.body.style.cursor = "";
    if (renderFrame.current !== null) window.cancelAnimationFrame(renderFrame.current);
    if (transitionFrame.current !== null) window.cancelAnimationFrame(transitionFrame.current);
  }, [clearTimers]);

  const focusControl = (control: PhotoControl | null) => {
    keyboardFocus.current = control;
    schedulePaint();
  };

  return (
    <div
      className={styles.spatialInteractionSemantics}
      data-photo-spatial-controls
      data-photo-state={step}
      data-photo-count={count}
      role="region"
      aria-label={copy.stations.photo.title}
    >
      <canvas ref={canvasRef} width={canvasWidth} height={canvasHeight} aria-hidden="true" />
      <p>{step === "captured" ? copy.photo.captured : copy.photo.ready}</p>
      <button type="button" disabled={step !== "ready"} onFocus={() => focusControl("capture")} onBlur={() => focusControl(null)} onClick={capture}>{copy.photo.capture}</button>
      <button type="button" disabled={step !== "captured"} onFocus={() => focusControl("replay")} onBlur={() => focusControl(null)} onClick={replay}>{copy.replay}</button>
      <button type="button" disabled={step !== "captured"} onFocus={() => focusControl("continue")} onBlur={() => focusControl(null)} onClick={() => handleControl("continue")}>{copy.continue}</button>
      <button type="button" data-interaction-dismiss onClick={() => exitWithTransition(onClose)}>{copy.close}</button>
      <span role="status" aria-live="polite">{step === "countdown" ? count : step === "captured" ? copy.photo.captured : copy.photo.ready}</span>
    </div>
  );
}
