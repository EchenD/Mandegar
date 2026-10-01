"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { publicAssetPath } from "@/lib/public-asset-path";
import type { InteractionCopy } from "./interaction-copy";
import {
  interactionRuntime,
  markPhotoSurfaceDirty,
  registerPhotoSurface,
  registerSceneInteraction,
} from "./interaction-runtime";
import type { SceneInteractionEvent } from "./interaction-types";
import { getVisitorCreation, savePhotoLook } from "./visitor-creation";
import styles from "./HeroInteractions.module.css";

type PhotoStep = "ready" | "countdown" | "captured";
type PhotoLook = "warm" | "cool";
type PhotoControl = "capture" | "replay" | "continue" | PhotoLook;

const canvasWidth = 800;
const canvasHeight = 520;
const readyControls = {
  warm: { x: 0.22, y: 0.63, width: 0.26, height: 0.1 },
  cool: { x: 0.52, y: 0.63, width: 0.26, height: 0.1 },
  capture: { x: 0.3, y: 0.8, width: 0.4, height: 0.11 },
} as const;
const capturedControls = {
  replay: { x: 0.3, y: 0.8, width: 0.25, height: 0.11 },
  continue: { x: 0.56, y: 0.8, width: 0.34, height: 0.11 },
} as const;

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
  if (step === "ready") {
    for (const control of ["warm", "cool", "capture"] as const) {
      const area = readyControls[control];
      if (hitRect(x, y, area.x, area.y, area.width, area.height)) return control;
    }
  }
  if (step === "captured") {
    const replay = capturedControls.replay;
    const next = capturedControls.continue;
    if (hitRect(x, y, 0.24, 0.1, 0.38, 0.64)) return "replay";
    if (hitRect(x, y, replay.x - 0.02, replay.y - 0.02, replay.width + 0.04, replay.height + 0.04)) return "replay";
    if (hitRect(x, y, next.x - 0.02, next.y - 0.02, next.width + 0.04, next.height + 0.04)) return "continue";
  }
  return null;
}

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
  const previewImage = useRef<HTMLImageElement | null>(null);
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
  const onResetRef = useRef(onReset);
  const lookRef = useRef<PhotoLook>("warm");
  const [step, setStep] = useState<PhotoStep>("ready");
  const [count, setCount] = useState(3);
  const [look, setLook] = useState<PhotoLook>("warm");

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
    const direction = document.documentElement.dir === "rtl" ? "rtl" : "ltr";
    const currentStep = stepRef.current;
    const currentCount = countRef.current;
    const transition = transitionProgress.current;
    const surfaceReveal = revealProgress(transition, 0, 0.38);
    const contentReveal = revealProgress(transition, 0.2, 0.72);
    const controlsReveal = revealProgress(transition, 0.62, 1);

    interactionRuntime.photoStep = currentStep;
    interactionRuntime.photoCount = currentCount;
    interactionRuntime.photoLook = lookRef.current;
    interactionRuntime.photoVisibility = transition;
    context.clearRect(0, 0, width, height);
    canvas.dataset.paintedPhotoState = currentStep;
    canvas.dataset.paintedPhotoCount = String(currentCount);
    canvas.dataset.photoLook = lookRef.current;
    canvas.dataset.transitionProgress = transition.toFixed(3);

    context.save();
    context.globalAlpha = surfaceReveal;
    const centerX = width / 2;
    const centerY = height * 0.42;
    if (currentStep === "ready") {
      context.save();
      context.globalAlpha = contentReveal;
      context.direction = direction;
      context.textAlign = "center";
      context.fillStyle = "#f7f7f4";
      context.font = '500 17px "Vazirmatn Variable", Tahoma, sans-serif';
      context.fillText(copy.photo.ready, centerX, 25, width - 64);
      const previewWidth = 130;
      const previewHeight = 230;
      const previewX = centerX - previewWidth / 2;
      const previewY = 48;
      roundedRect(context, previewX - 8, previewY - 8, previewWidth + 16, previewHeight + 16, 12);
      context.fillStyle = lookRef.current === "warm" ? "#fff2df" : "#e8f2ff";
      context.fill();
      if (previewImage.current?.complete && previewImage.current.naturalWidth > 0) {
        context.filter = lookRef.current === "warm" ? "sepia(.2) saturate(.9)" : "saturate(.8) hue-rotate(8deg)";
        context.drawImage(previewImage.current, previewX, previewY, previewWidth, previewHeight);
        context.filter = "none";
      }
      context.direction = direction;
      context.textAlign = "center";
      context.fillStyle = "#f7f7f4";
      context.font = '600 20px "Vazirmatn Variable", Tahoma, sans-serif';
      context.fillText(copy.photo.choose, centerX, height * 0.59, width - 80);
      context.restore();
    }
    if (currentStep === "countdown") {
      context.save();
      context.globalAlpha = contentReveal;
      context.fillStyle = "#fff7ee";
      context.font = '780 142px "Vazirmatn Variable", Tahoma, sans-serif';
      context.textAlign = "center";
      context.shadowColor = "#ffb56d";
      context.shadowBlur = 14;
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
      const selected = control === lookRef.current;
      roundedRect(context, left, top, buttonWidth, buttonHeight, buttonHeight / 2);
      context.fillStyle = primary || selected ? "#225cff" : focused ? "#e9eeff" : "rgba(247,247,244,.96)";
      context.fill();
      context.strokeStyle = focused ? "#75d8ff" : primary || selected ? "#225cff" : "rgba(22,25,29,.26)";
      context.lineWidth = focused ? 3 : 1.5;
      context.stroke();
      context.direction = direction;
      context.textAlign = "center";
      context.fillStyle = primary || selected ? "#fff" : "#16191d";
      context.font = '700 22px "Vazirmatn Variable", Tahoma, sans-serif';
      context.fillText(label, left + buttonWidth / 2, top + buttonHeight * 0.62, buttonWidth - 24);
    };

    context.save();
    context.globalAlpha = controlsReveal;
    if (currentStep === "ready") {
      for (const [index, control] of (["warm", "cool"] as const).entries()) {
        const area = readyControls[control];
        drawButton(control, width * area.x, height * area.y, width * area.width, height * area.height, copy.photo.looks[index], false);
      }
      const area = readyControls.capture;
      drawButton("capture", width * area.x, height * area.y, width * area.width, height * area.height, copy.photo.capture, true);
    } else if (currentStep === "captured") {
      const replay = capturedControls.replay;
      const next = capturedControls.continue;
      drawButton("replay", width * replay.x, height * replay.y, width * replay.width, height * replay.height, copy.replay, false);
      drawButton("continue", width * next.x, height * next.y, width * next.width, height * next.height, copy.continue, true);
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
    savePhotoLook(lookRef.current);
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
    if (completionReported.current) {
      completionReported.current = false;
      onResetRef.current();
    }
  }, [clearTimers, commitCount, commitStep]);

  const chooseLook = useCallback((nextLook: PhotoLook) => {
    if (stepRef.current !== "ready") return;
    lookRef.current = nextLook;
    interactionRuntime.photoLook = nextLook;
    setLook(nextLook);
    paint();
  }, [paint]);

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
    hoverControl.current = null;
    document.body.style.cursor = "";
    animateTransition(0, callback);
  }, [animateTransition, clearTimers]);

  const handleControl = useCallback((control: PhotoControl) => {
    if (control === "capture") capture();
    else if (control === "replay") replay();
    else if (control === "continue") exitWithTransition(onContinue);
    else chooseLook(control);
  }, [capture, chooseLook, exitWithTransition, onContinue, replay]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    clearTimers();
    transitionProgress.current = 0;
    transitionState.current = "intro";
    stepRef.current = "ready";
    countRef.current = 3;
    lookRef.current = getVisitorCreation().photoLook ?? "warm";
    completionReported.current = false;
    setStep("ready");
    setCount(3);
    setLook(lookRef.current);
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
    const image = new window.Image();
    let mounted = true;
    image.onload = () => {
      if (!mounted) return;
      previewImage.current = image;
      schedulePaint();
    };
    image.src = publicAssetPath("/media/placeholders/photo-experience.webp");
    return () => {
      mounted = false;
      image.onload = null;
      previewImage.current = null;
    };
  }, [schedulePaint]);

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
    <>
      <div
        className={styles.spatialInteractionSemantics}
        data-photo-spatial-controls
        data-photo-state={step}
        data-photo-count={count}
        data-photo-look={look}
        role="region"
        aria-label={copy.stations.photo.title}
      >
        <canvas ref={canvasRef} width={canvasWidth} height={canvasHeight} aria-hidden="true" />
        <p>{step === "captured" ? copy.photo.captured : copy.photo.ready}</p>
        <div role="group" aria-label={copy.photo.choose}>
          {(["warm", "cool"] as const).map((option, index) => (
            <button key={option} type="button" data-photo-look-choice={option} aria-pressed={look === option} disabled={step !== "ready"} onFocus={() => focusControl(option)} onBlur={() => focusControl(null)} onClick={() => chooseLook(option)}>{copy.photo.looks[index]}</button>
          ))}
        </div>
        <button type="button" data-photo-capture disabled={step !== "ready"} onFocus={() => focusControl("capture")} onBlur={() => focusControl(null)} onClick={capture}>{copy.photo.capture}</button>
        <button type="button" data-photo-replay disabled={step !== "captured"} onFocus={() => focusControl("replay")} onBlur={() => focusControl(null)} onClick={replay}>{copy.replay}</button>
        <button type="button" data-interaction-continue disabled={step !== "captured"} onFocus={() => focusControl("continue")} onBlur={() => focusControl(null)} onClick={() => handleControl("continue")}>{copy.continue}</button>
        <button type="button" data-interaction-dismiss onClick={() => exitWithTransition(onClose)}>{copy.close}</button>
        <span role="status" aria-live="polite">{step === "countdown" ? count : step === "captured" ? copy.photo.captured : copy.photo.ready}</span>
      </div>
      <figure className={styles.mobilePhotoResult} data-mobile-photo-result={step === "captured" ? "" : undefined} data-mobile-photo-preview={step !== "captured" ? "" : undefined} data-photo-look={look} role="status">
        <span>MANDEGAR</span>
        <Image
          src={publicAssetPath("/media/placeholders/photo-experience.webp")}
          width={116}
          height={206}
          alt={copy.photo.ready}
          unoptimized
        />
        <figcaption>{step === "captured" ? copy.photo.captured : copy.photo.ready}</figcaption>
      </figure>
      {step !== "captured" && (
        <div className={styles.photoChoiceDock} data-photo-choice-dock data-photo-look={look}>
          <span>{copy.photo.choose}</span>
          <div className={styles.photoLookChoices} role="group" aria-label={copy.photo.choose}>
            {(["warm", "cool"] as const).map((option, index) => (
              <button key={option} type="button" data-mobile-photo-look={option} aria-pressed={look === option} disabled={step !== "ready"} onClick={() => chooseLook(option)}>{copy.photo.looks[index]}</button>
            ))}
          </div>
          <button type="button" className={styles.photoCaptureButton} data-mobile-photo-capture disabled={step !== "ready"} onClick={capture}>{step === "countdown" ? count : copy.photo.capture}</button>
        </div>
      )}
      {step === "captured" && (
        <button type="button" className={styles.mobilePhotoReplay} data-mobile-photo-replay onClick={replay}>
          {copy.replay}
        </button>
      )}
    </>
  );
}
