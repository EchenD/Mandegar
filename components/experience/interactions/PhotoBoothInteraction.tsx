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

const canvasWidth = 800;
const canvasHeight = 520;

export function PhotoBoothInteraction({
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
  const interfaceRef = useRef<HTMLDivElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const countdownFrame = useRef<number | null>(null);
  const renderFrame = useRef<number | null>(null);
  const transitionFrame = useRef<number | null>(null);
  const transitionProgress = useRef(0);
  const transitionState = useRef<"intro" | "ready" | "outro">("intro");
  const stepRef = useRef<PhotoStep>("ready");
  const countRef = useRef(3);
  const completionReported = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const onResetRef = useRef(onReset);
  const [step, setStep] = useState<PhotoStep>("ready");
  const [count, setCount] = useState(3);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    onResetRef.current = onReset;
  }, [onComplete, onReset]);

  const clearTimers = useCallback(() => {
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
    const fontFamily = getComputedStyle(document.body).fontFamily;
    const currentStep = stepRef.current;
    const currentCount = countRef.current;
    const transition = transitionProgress.current;

    interactionRuntime.photoStep = currentStep;
    interactionRuntime.photoCount = currentCount;
    interactionRuntime.photoVisibility = transition;
    context.clearRect(0, 0, width, height);
    canvas.dataset.paintedPhotoState = currentStep;
    canvas.dataset.paintedPhotoCount = String(currentCount);
    canvas.dataset.transitionProgress = transition.toFixed(3);
    interfaceRef.current?.style.setProperty("--photo-copy-opacity", transition.toFixed(3));
    interfaceRef.current?.style.setProperty("--photo-copy-offset", `${((1 - transition) * 8).toFixed(2)}px`);
    if (currentStep === "countdown") {
      context.save();
      context.globalAlpha = transition;
      context.fillStyle = "#f7f7f4";
      context.font = `600 180px ${fontFamily}`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.shadowColor = "#225cff";
      context.shadowBlur = 8;
      context.fillText(String(currentCount), width / 2, height / 2);
      context.restore();
    }

    markPhotoSurfaceDirty();
  }, []);

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
    if (stepRef.current !== "ready" || transitionState.current === "outro") return;
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
    if (transitionState.current === "outro") return;
    clearTimers();
    commitCount(3);
    commitStep("ready");
    if (completionReported.current) {
      completionReported.current = false;
      onResetRef.current();
    }
  }, [clearTimers, commitCount, commitStep]);

  const animateTransition = useCallback((target: 0 | 1, onFinish?: () => void) => {
    if (transitionFrame.current !== null) window.cancelAnimationFrame(transitionFrame.current);
    const from = transitionProgress.current;
    const duration = reducedMotion ? 0 : target === 1 ? 600 : 560;
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
    if (interfaceRef.current) interfaceRef.current.dataset.photoExiting = "true";
    document.body.style.cursor = "";
    animateTransition(0, callback);
  }, [animateTransition, clearTimers]);

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
    animateTransition(1);
    void document.fonts?.ready.then(schedulePaint);
    return () => {
      registerPhotoSurface(null);
      interactionRuntime.photoStep = "idle";
      interactionRuntime.photoCount = 3;
      interactionRuntime.photoVisibility = 0;
    };
  }, [animateTransition, clearTimers, paint, schedulePaint]);

  useEffect(() => {
    const handleSceneInput = (event: SceneInteractionEvent) => {
      if (transitionState.current !== "ready" || stepRef.current !== "captured" || event.phase !== "down") return;
      replay();
    };
    registerSceneInteraction("photo", handleSceneInput);
    return () => registerSceneInteraction("photo", null);
  }, [replay]);

  useEffect(() => () => {
    clearTimers();
    document.body.style.cursor = "";
    if (renderFrame.current !== null) window.cancelAnimationFrame(renderFrame.current);
    if (transitionFrame.current !== null) window.cancelAnimationFrame(transitionFrame.current);
  }, [clearTimers]);

  useEffect(() => {
    if (step !== "captured") return;
    const frame = window.requestAnimationFrame(() => continueRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [step]);

  return (
    <div
      ref={interfaceRef}
      className={styles.photoSceneCopy}
      data-photo-spatial-controls
      data-photo-service-dock
      data-mobile-photo-result={step === "captured" ? "" : undefined}
      data-photo-state={step}
      data-photo-count={count}
      role="region"
      aria-label={copy.stations.photo.title}
      aria-busy={step === "countdown"}
    >
      <canvas ref={canvasRef} hidden width={canvasWidth} height={canvasHeight} aria-hidden="true" />
      <div className={styles.photoSceneContent}>
        <h2>{step === "captured" ? copy.photo.captured : copy.photo.ready}</h2>
        {step !== "captured" ? <p>{copy.photo.delivery}</p> : null}
        <small>{copy.photo.example}</small>
        <div className={styles.photoSceneActions}>
          {step === "captured" ? (
            <>
              <button type="button" data-photo-replay data-mobile-photo-replay onClick={replay}>{copy.replay}</button>
              <button ref={continueRef} type="button" data-photo-continue data-mobile-photo-continue data-interaction-continue onClick={() => exitWithTransition(onContinue)}>{copy.continue}</button>
            </>
          ) : (
            <button type="button" data-photo-capture data-mobile-photo-capture disabled={step !== "ready"} onClick={capture}>{copy.photo.capture}</button>
          )}
        </div>
      </div>
      <button type="button" hidden data-interaction-dismiss onClick={() => exitWithTransition(onClose)}>{copy.close}</button>
      <span className={styles.spatialInteractionSemantics} role="status" aria-live="polite">{step === "countdown" ? count : step === "captured" ? copy.photo.captured : copy.photo.ready}</span>
    </div>
  );
}
