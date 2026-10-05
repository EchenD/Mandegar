"use client";

import { useEffect, useRef } from "react";
import type { Locale } from "@/lib/i18n";
import { experienceState } from "../experience-state";
import { interactionSurfaceSizes, sceneTokens } from "../scene-config";
import { getInteractionCopy } from "./interaction-copy";
import { stageBeamColors } from "./interaction-palette";
import { interactionRuntime, markInteractionCanvasDirty, markPhotoSurfaceDirty, registerInteractionCanvas, registerPhotoSurface } from "./interaction-runtime";
import { getScrollScenes, photoScrollTiming, scrollHoldTiming, syncScrollScenes } from "./scroll-scenes";
import { saveLightingLook } from "./visitor-creation";
import styles from "./HeroInteractions.module.css";

export function ScrollScenes({ locale, enabled }: { locale: Locale; enabled: boolean }) {
  const photoRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const photo = photoRef.current;
    const stage = stageRef.current;
    const photoContext = photo?.getContext("2d");
    const context = stage?.getContext("2d");
    if (!enabled || !photo || !stage || !photoContext || !context) return;
    const copy = getInteractionCopy(locale);
    const root = photo.closest<HTMLElement>("[data-experience-root]");
    const image = new Image();
    image.src = sceneTokens.bakedScene.screens.videoWall;
    let previous = "";
    let savedLighting = false;
    let frame: number;
    let disposed = false;
    let countdownStartedAt: number | null = null;
    let photoVisit = -1;
    let stageVisit = -1;
    let stageStartedAt = 0;
    let stageStartProgress = 0.2;
    let completedVisit = -1;
    let previousFrameAt = performance.now();
    image.onload = () => { previous = ""; };
    void document.fonts.ready.then(() => { if (!disposed) previous = ""; });
    registerPhotoSurface(photo);
    registerInteractionCanvas("videoWall", stage, 0);
    const tick = () => {
      if (!document.hidden) {
        const now = performance.now();
        const reverseBlend = 1 - Math.exp(-Math.min(0.1, (now - previousFrameAt) / 1000) / 0.045);
        previousFrameAt = now;
        const nativeSample = getScrollScenes(experienceState.progress);
        const holdingPhoto = interactionRuntime.activeStation === "photo";
        const holdingStage = interactionRuntime.activeStation === "stage";
        const reverse = root?.dataset.scrollDirection === "backward";
        if (holdingPhoto && photoVisit !== interactionRuntime.scrollSceneVisit) {
          photoVisit = interactionRuntime.scrollSceneVisit;
          countdownStartedAt = now;
        }
        if (!holdingPhoto && (nativeSample.photo < photoScrollTiming.countdownStart || nativeSample.photo >= photoScrollTiming.fadeEnd)) {
          countdownStartedAt = null;
          interactionRuntime.photoHoldProgress = null;
        } else if (!holdingPhoto && reverse) {
          countdownStartedAt = null;
          const carried = interactionRuntime.photoHoldProgress;
          if (carried !== null) interactionRuntime.photoHoldProgress = Math.abs(carried - nativeSample.photo) < 0.0001
            ? null : carried + (nativeSample.photo - carried) * reverseBlend;
        }
        let photoProgress = holdingPhoto ? interactionRuntime.photoHoldProgress ?? photoScrollTiming.countdownStart : nativeSample.photo;
        if (holdingPhoto && countdownStartedAt !== null) {
          const elapsed = now - countdownStartedAt;
          // During the hold the camera stays in its authored position while
          // the remaining countdown and phone delivery play without rewinding.
          photoProgress = Math.max(photoProgress, photoScrollTiming.countdownStart
            + Math.min(1, elapsed / photoScrollTiming.countdownMs) * (photoScrollTiming.capture - photoScrollTiming.countdownStart)
            + Math.max(0, Math.min(1, (elapsed - photoScrollTiming.countdownMs) / photoScrollTiming.deliveryMs)) * (photoScrollTiming.deliveryEnd - photoScrollTiming.capture));
        }
        if (holdingPhoto) interactionRuntime.photoHoldProgress = photoProgress;
        else if (interactionRuntime.photoHoldProgress !== null) photoProgress = Math.max(photoProgress, interactionRuntime.photoHoldProgress);
        if (holdingStage && stageVisit !== interactionRuntime.scrollSceneVisit) {
          stageVisit = interactionRuntime.scrollSceneVisit;
          stageStartedAt = now;
          stageStartProgress = interactionRuntime.stageHoldProgress ?? nativeSample.stage;
        }
        if (holdingStage) {
          const amount = Math.min(1, (now - stageStartedAt) / scrollHoldTiming.stageMs);
          interactionRuntime.stageHoldProgress = stageStartProgress + amount * (Math.max(0.8, stageStartProgress) - stageStartProgress);
        } else if (nativeSample.stage <= 0 || nativeSample.stage >= 1) interactionRuntime.stageHoldProgress = null;
        else if (reverse && interactionRuntime.stageHoldProgress !== null) {
          const carried = interactionRuntime.stageHoldProgress;
          interactionRuntime.stageHoldProgress = Math.abs(carried - nativeSample.stage) < 0.0001
            ? null : carried + (nativeSample.stage - carried) * reverseBlend;
        }
        const stageProgress = holdingStage ? interactionRuntime.stageHoldProgress ?? 0.2
          : Math.max(nativeSample.stage, interactionRuntime.stageHoldProgress ?? 0);
        const sample = getScrollScenes(experienceState.progress, { photo: photoProgress, stage: stageProgress });
        syncScrollScenes(experienceState.progress);
        const photoVisibility = holdingPhoto ? sample.photoVisibility : nativeSample.photoVisibility;
        const stageVisibility = holdingStage ? sample.stageVisibility : nativeSample.stageVisibility;
        interactionRuntime.photoProgress = photoProgress;
        interactionRuntime.photoStep = sample.photoStep;
        interactionRuntime.photoCount = sample.photoCount;
        interactionRuntime.photoVisibility = photoVisibility;
        const photoDone = holdingPhoto && countdownStartedAt !== null
          && now - countdownStartedAt >= photoScrollTiming.countdownMs + photoScrollTiming.deliveryMs;
        const stageDone = holdingStage && now - stageStartedAt >= scrollHoldTiming.stageMs;
        if ((photoDone || stageDone) && completedVisit !== interactionRuntime.scrollSceneVisit) {
          completedVisit = interactionRuntime.scrollSceneVisit;
          window.dispatchEvent(new CustomEvent("mandegar:passive-complete", {
            detail: { station: photoDone ? "photo" : "stage" },
          }));
        }
        const key = `${photoProgress.toFixed(5)}:${photoVisibility.toFixed(5)}:${sample.stage.toFixed(5)}:${stageVisibility.toFixed(5)}:${interactionRuntime.stageHoldProgress === null}`;
        if (previous !== key) {
          previous = key;
          photoContext.clearRect(0, 0, photo.width, photo.height);
          if (sample.photoStep === "countdown") {
            photoContext.fillStyle = "#f7f7f4";
            photoContext.font = '600 180px "Vazirmatn Variable", sans-serif';
            photoContext.textAlign = "center";
            photoContext.textBaseline = "middle";
            photoContext.shadowColor = "#225cff";
            photoContext.shadowBlur = 8;
            photoContext.fillText(String(sample.photoCount), photo.width / 2, photo.height / 2);
          }
          photo.dataset.photoState = sample.photoStep;
          photo.dataset.photoProgress = String(nativeSample.photo);
          photo.dataset.photoAnimationProgress = String(photoProgress);
          photo.dataset.photoCount = String(sample.photoCount);
          markPhotoSurfaceDirty();
          context.clearRect(0, 0, stage.width, stage.height);
          if (image.naturalWidth) context.drawImage(image, 0, 0, stage.width, stage.height);
          else { context.fillStyle = "#f0efea"; context.fillRect(0, 0, stage.width, stage.height); }
          const { width, height } = stage;
          context.fillStyle = "#edece6";
          context.fillRect(0, 0, width, height);
          context.textAlign = "center";
          context.direction = locale === "en" ? "ltr" : "rtl";
          context.fillStyle = "#225cff";
          context.font = '700 13px "Vazirmatn Variable", sans-serif';
          context.fillText("MANDEGAR", width / 2, height * 0.09);
          context.fillStyle = "#242320";
          context.font = '600 32px "Vazirmatn Variable", sans-serif';
          context.fillText(copy.stations.stage.title, width / 2, height * 0.2);
          sample.beams.forEach((energy, index) => {
            const x = width * (0.12 + index * 0.19);
            const color = stageBeamColors[index];
            context.save();
            context.globalAlpha = 0.1 + energy * 0.9;
            const glow = context.createLinearGradient(x, height * 0.35, x, height * 0.74);
            glow.addColorStop(0, `${color}88`);
            glow.addColorStop(1, `${color}00`);
            context.fillStyle = glow;
            context.beginPath();
            context.moveTo(x - 8, height * 0.34);
            context.lineTo(x - 58, height * 0.73);
            context.lineTo(x + 58, height * 0.73);
            context.lineTo(x + 8, height * 0.34);
            context.fill();
            context.fillStyle = color;
            context.beginPath();
            context.ellipse(x, height * 0.73, 48, 10, 0, 0, Math.PI * 2);
            context.fill();
            context.font = '650 19px "Vazirmatn Variable", sans-serif';
            context.fillText(`${copy.stage.beam} ${index + 1}`, x, height * 0.85);
            context.restore();
          });
          if (stageVisibility > 0 && interactionRuntime.monitorEntries.videoWall?.canvas !== stage) {
            registerInteractionCanvas("videoWall", stage, stageVisibility);
          }
          const entry = interactionRuntime.monitorEntries.videoWall;
          if (entry?.canvas === stage) entry.blend = stageVisibility;
          stage.dataset.beamIntensities = JSON.stringify(sample.beams);
          stage.dataset.stageProgress = String(sample.stage);
          markInteractionCanvasDirty("videoWall");
          if (!savedLighting && sample.stage >= 0.74 && root?.dataset.scrollDirection === "forward") {
            savedLighting = true;
            saveLightingLook([true, true, true, true, true]);
          }
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      image.onload = null;
      registerPhotoSurface(null);
      if (interactionRuntime.monitorEntries.videoWall?.canvas === stage) registerInteractionCanvas("videoWall", null);
    };
  }, [enabled, locale]);
  return <div aria-hidden="true">
    <canvas ref={photoRef} width={800} height={520} className={styles.textureSource} data-photo-scroll />
    <canvas ref={stageRef} {...interactionSurfaceSizes.videoWall.canvas} className={styles.textureSource} data-stage-scroll />
  </div>;
}
