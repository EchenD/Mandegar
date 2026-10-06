"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import type { Locale } from "@/lib/i18n";
import { publicAssetPath } from "@/lib/public-asset-path";
import { interactionSurfaceSizes } from "../scene-config";
import { interactionRuntime, markInteractionCanvasDirty, registerInteractionCanvas } from "./interaction-runtime";
import { getInstallationState, installationCopy, installationViews, selectInstallationView, subscribeInstallation } from "./installation-demo";
import styles from "./HeroInteractions.module.css";

type Point = [number, number, number];

function paintInstallation(context: CanvasRenderingContext2D, exploded: number, x: number, y: number, scale: number) {
  const project = ([px, py, pz]: Point) => [x + (px - py) * scale, y + (px + py) * scale * 0.38 - pz * scale] as const;
  const polygon = (points: Point[], color: string) => {
    context.beginPath();
    points.forEach((point, index) => { const [sx, sy] = project(point); if (index === 0) context.moveTo(sx, sy); else context.lineTo(sx, sy); });
    context.closePath();
    context.fillStyle = color;
    context.fill();
    context.strokeStyle = "rgba(192, 173, 145, .3)";
    context.lineWidth = 1;
    context.stroke();
  };
  const box = (px: number, py: number, pz: number, width: number, depth: number, height: number, top: string, side = "#c3b9a9") => {
    polygon([[px, py, pz], [px + width, py, pz], [px + width, py, pz + height], [px, py, pz + height]], side);
    polygon([[px + width, py, pz], [px + width, py + depth, pz], [px + width, py + depth, pz + height], [px + width, py, pz + height]], "#a39b90");
    polygon([[px, py, pz + height], [px + width, py, pz + height], [px + width, py + depth, pz + height], [px, py + depth, pz + height]], top);
  };
  box(-2.6, -1.5, -0.3 - exploded * 0.3, 5.2, 3.2, 0.22, "#f1e9dc");
  box(-2, -1.1, exploded * 0.25, 4, 1.4, 0.3, "#fff7e9");
  const screenLift = exploded * 0.95;
  box(-1.9, -1.05, 0.32 + screenLift, 3.8, 0.09, 1.65, "#75d8ff", "#193752");
  polygon([[-1.84, -1.055, 0.4 + screenLift], [1.84, -1.055, 0.4 + screenLift], [1.84, -1.055, 1.9 + screenLift], [-1.84, -1.055, 1.9 + screenLift]], "#225cff");
  for (const side of [-1, 1]) {
    const lampX = side * (2.25 + exploded * 0.8);
    box(lampX - 0.12, -0.6, 0.02, 0.24, 0.3, 0.12, "#8d9297");
    box(lampX - 0.035, -0.52, 0.14, 0.07, 0.07, 2.2, "#ddd6c9");
    box(lampX - 0.14, -0.58, 2.12 + exploded * 0.35, 0.28, 0.23, 0.38, "#faf6ee", "#787f86");
    box(side * (1.55 + exploded * 0.45) - 0.2, 0.85 + exploded * 0.5, 0, 0.4, 0.35, 0.75, "#f7efe2", "#d2bc9c");
  }
  for (let index = 0; index < 5; index += 1) box(-1.6 + index * 0.72, 0.65, 0.03, 0.3, 0.3, 0.28, "#e8dfd1");
}

export function TouchComposerInteraction({ locale }: { locale: Locale }) {
  const state = useSyncExternalStore(subscribeInstallation, getInstallationState, getInstallationState);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const copy = installationCopy[locale];

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const picture = new Image();
    picture.src = publicAssetPath("/media/services/events.webp");
    let frame: number;
    let explosion = 0;
    let explosionFrom = 0;
    let explosionTarget = 0;
    let explosionStartedAt = performance.now();
    let previous = "";
    const startedAt = performance.now();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const paint = () => {
      const view = getInstallationState().view;
      const target = view === "parts" || view === "details" ? 1 : 0;
      const now = performance.now();
      if (target !== explosionTarget) {
        explosionFrom = explosion;
        explosionTarget = target;
        explosionStartedAt = now;
      }
      const transition = Math.min(1, (now - explosionStartedAt) / 600);
      explosion = reduced ? target : explosionFrom + (target - explosionFrom) * (1 - Math.pow(1 - transition, 3));
      const visible = reduced ? 1 : Math.min(1, (performance.now() - startedAt) / 450);
      interactionRuntime.touchVisibility = visible;
      const key = `${view}:${explosion.toFixed(3)}:${visible.toFixed(3)}:${picture.naturalWidth}:${picture.complete}`;
      if (key !== previous) {
        previous = key;
        const { width, height } = canvas;
        context.fillStyle = "#101c28";
        context.fillRect(0, 0, width, height);
        context.textAlign = "center";
        context.direction = locale === "en" ? "ltr" : "rtl";
        context.fillStyle = "#cbbba3";
        context.font = '500 18px "Vazirmatn Variable", sans-serif';
        context.fillText(`MANDEGAR / ${copy.concept}`, width / 2, 38);
        context.fillStyle = "#faf5eb";
        context.font = '600 30px "Vazirmatn Variable", sans-serif';
        context.fillText(copy.views[view], width / 2, 83);
        if (view === "image" && picture.naturalWidth) {
          const size = Math.min(width * 0.65, height - 115);
          context.drawImage(picture, (width - size) / 2, 100, size, size);
        } else {
          paintInstallation(context, explosion, view === "details" ? width * 0.36 : width * 0.5, height * 0.79, view === "details" ? 49 : 65);
          if (view === "parts") {
            context.fillStyle = "#cbbba3";
            context.font = '500 19px "Vazirmatn Variable", sans-serif';
            context.fillText(copy.parts.join("   ·   "), width / 2, height - 22, width - 50);
          }
          if (view === "details") {
            context.textAlign = locale === "en" ? "left" : "right";
            const copyX = locale === "en" ? width * 0.65 : width * 0.94;
            copy.parts.forEach((part, index) => {
              context.fillStyle = "#75d8ff";
              context.font = '600 22px "Vazirmatn Variable", sans-serif';
              context.fillText(part, copyX, 155 + index * 84, width * 0.29);
              context.fillStyle = "#e0dbd3";
              context.font = '400 17px "Vazirmatn Variable", sans-serif';
              context.fillText(copy.descriptions[index], copyX, 181 + index * 84, width * 0.29);
            });
          }
        }
        canvas.dataset.installationView = view;
        canvas.dataset.transitionProgress = visible.toFixed(3);
        canvas.dataset.explosionProgress = explosion.toFixed(3);
        canvas.dataset.artworkStatus = picture.complete ? (picture.naturalWidth ? "ready" : "missing") : "loading";
        markInteractionCanvasDirty("interactive");
      }
      frame = requestAnimationFrame(paint);
    };
    paint();
    registerInteractionCanvas("interactive", canvas);
    return () => {
      cancelAnimationFrame(frame);
      interactionRuntime.touchVisibility = 0;
      if (interactionRuntime.monitorEntries.interactive?.canvas === canvas) registerInteractionCanvas("interactive", null);
    };
  }, [copy, locale]);

  return <div className={styles.installationControls} data-touch-spatial-controls data-installation-controls data-installation-view={state.view}>
    <canvas ref={canvasRef} {...interactionSurfaceSizes.interactive.canvas} className={styles.textureSource} data-composer-canvas />
    <div role="group" aria-label={copy.instruction} className={styles.installationButtons}>
      {installationViews.map((view, index) => <button key={view} type="button" data-installation-button={view}
        aria-pressed={state.view === view} onClick={() => selectInstallationView(view)}>
        <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>{copy.views[view]}
      </button>)}
    </div>
    <span className={styles.puzzleScreenReader} role="status" aria-live="polite">
      {copy.views[state.view]}
      {state.view === "parts" ? `. ${copy.parts.join(". ")}` : null}
      {state.view === "details" ? `. ${copy.parts.map((part, index) => `${part}: ${copy.descriptions[index]}`).join(" ")}` : null}
      {state.view === "image" ? `. ${copy.concept}` : null}
    </span>
  </div>;
}
