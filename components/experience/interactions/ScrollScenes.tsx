"use client";

import { useEffect, useRef } from "react";
import type { Locale } from "@/lib/i18n";
import { experienceState } from "../experience-state";
import { interactionSurfaceSizes, sceneTokens } from "../scene-config";
import { getInteractionCopy } from "./interaction-copy";
import { interactionRuntime, markInteractionCanvasDirty, markPhotoSurfaceDirty, registerInteractionCanvas, registerPhotoSurface } from "./interaction-runtime";
import { getScrollScenes, syncScrollScenes } from "./scroll-scenes";
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
    image.onload = () => { previous = ""; };
    void document.fonts.ready.then(() => { if (!disposed) previous = ""; });
    registerPhotoSurface(photo);
    registerInteractionCanvas("videoWall", stage, 0);
    const tick = () => {
      if (!document.hidden) {
        const sample = getScrollScenes(experienceState.progress);
        const photoProgress = sample.photo;
        syncScrollScenes(experienceState.progress);
        const photoVisibility = sample.photoVisibility;
        const stageVisibility = sample.stageVisibility;
        interactionRuntime.photoProgress = photoProgress;
        interactionRuntime.photoStep = sample.photoStep;
        interactionRuntime.photoCount = sample.photoCount;
        interactionRuntime.photoVisibility = photoVisibility;
        const key = `${photoProgress.toFixed(5)}:${photoVisibility.toFixed(5)}:${sample.stage.toFixed(5)}:${stageVisibility.toFixed(5)}`;
        if (previous !== key) {
          previous = key;
          photoContext.clearRect(0, 0, photo.width, photo.height);
          if (sample.photoStep === "countdown") {
            photoContext.fillStyle = "#f7f7f4";
            photoContext.font = '600 180px "Vazirmatn Variable", sans-serif';
            photoContext.textAlign = "center";
            photoContext.textBaseline = "middle";
            photoContext.direction = locale === "en" ? "ltr" : "rtl";
            photoContext.shadowColor = "#225cff";
            photoContext.shadowBlur = 8;
            photoContext.fillText(copy.photo.ready, photo.width / 2, photo.height / 2, photo.width * 0.84);
          }
          photo.dataset.photoState = sample.photoStep;
          photo.dataset.photoProgress = String(sample.photo);
          photo.dataset.photoAnimationProgress = String(photoProgress);
          photo.dataset.photoCount = String(sample.photoCount);
          markPhotoSurfaceDirty();
          context.clearRect(0, 0, stage.width, stage.height);
          const { width, height } = stage;
          context.fillStyle = "#071525";
          context.fillRect(0, 0, width, height);
          if (image.naturalWidth) {
            context.drawImage(image, 0, 0, width, height);
          } else {
            context.textAlign = "center";
            context.fillStyle = "#f7f4eb";
            context.font = '500 40px "Vazirmatn Variable", sans-serif';
            context.fillText("MANDEGAR", width / 2, height * 0.26);
          }
          if (stageVisibility > 0 && interactionRuntime.monitorEntries.videoWall?.canvas !== stage) {
            registerInteractionCanvas("videoWall", stage, stageVisibility);
          }
          const entry = interactionRuntime.monitorEntries.videoWall;
          if (entry?.canvas === stage) entry.blend = stageVisibility;
          stage.dataset.beamIntensities = JSON.stringify(sample.beams);
          stage.dataset.litLamps = String(sample.beams.filter((beam) => beam > 0.99).length);
          stage.dataset.stageProgress = String(sample.stage);
          markInteractionCanvasDirty("videoWall");
          if (!savedLighting && sample.beams.every((beam) => beam === 1) && root?.dataset.scrollDirection === "forward") {
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
