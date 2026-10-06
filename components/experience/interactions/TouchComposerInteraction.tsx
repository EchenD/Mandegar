"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import type { Locale } from "@/lib/i18n";
import { publicAssetPath } from "@/lib/public-asset-path";
import { interactionSurfaceSizes } from "../scene-config";
import { interactionRuntime, markInteractionCanvasDirty, registerInteractionCanvas } from "./interaction-runtime";
import { getInstallationState, installationCopy, installationViews, selectInstallationView, subscribeInstallation, type InstallationView } from "./installation-demo";
import styles from "./HeroInteractions.module.css";

const ease = (amount: number) => amount * amount * (3 - 2 * amount);

export function TouchComposerInteraction({ locale }: { locale: Locale }) {
  const state = useSyncExternalStore(subscribeInstallation, getInstallationState, getInstallationState);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const copy = installationCopy[locale];

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const images = {} as Record<InstallationView, HTMLImageElement>;
    const statuses = {} as Record<InstallationView, string>;
    const snapshot = document.createElement("canvas");
    snapshot.width = canvas.width;
    snapshot.height = canvas.height;
    const snapshotContext = snapshot.getContext("2d")!;
    let disposed = false;
    let registered = false;
    let frame: number;
    let startedAt: number | null = null;
    let departingAt: number | null = null;
    let paintedKey = "";
    let targetKey = "";
    let transitionStartedAt = -Infinity;
    let hasSnapshot = false;
    installationViews.forEach((view) => {
      const image = new Image();
      images[view] = image;
      statuses[view] = "loading";
      image.onload = () => { statuses[view] = "ready"; };
      image.onerror = () => { statuses[view] = "missing"; };
      image.src = publicAssetPath(`/media/hero/touch/${view}.webp`);
    });
    const departure = (event: Event) => {
      if ((event as CustomEvent<{ station?: string }>).detail?.station !== "touch") return;
      departingAt = performance.now();
      canvas.dataset.departing = "true";
    };
    window.addEventListener("mandegar:interaction-departure", departure);
    const paint = (now: number) => {
      if (disposed) return;
      const view = getInstallationState().view;
      const selected = images[view];
      const picture = selected.naturalWidth ? selected
        : images.assembled.naturalWidth ? images.assembled
          : installationViews.map((item) => images[item]).find((image) => image.naturalWidth > 0);
      canvas.dataset.installationView = view;
      canvas.dataset.artworkStatus = statuses[view];
      if (picture) {
        startedAt ??= now;
        const nextKey = `${view}:${picture.src}`;
        if (nextKey !== targetKey) {
          hasSnapshot = registered;
          if (hasSnapshot) snapshotContext.drawImage(canvas, 0, 0);
          targetKey = nextKey;
          transitionStartedAt = registered ? now : -Infinity;
        }
        const amount = motion.matches ? 1 : Math.min(1, (now - transitionStartedAt) / 750);
        const blend = ease(amount);
        const entrance = motion.matches ? 1 : ease(Math.min(1, (now - startedAt) / 800));
        const departureAmount = departingAt === null ? 0
          : motion.matches ? 1 : ease(Math.min(1, (now - departingAt) / 400));
        interactionRuntime.touchVisibility = entrance * (1 - departureAmount);
        canvas.dataset.transitionProgress = entrance.toFixed(3);
        canvas.dataset.viewTransitionProgress = blend.toFixed(3);
        canvas.dataset.explosionProgress = ((view === "parts" || view === "details") ? blend : 0).toFixed(3);
        const key = `${targetKey}:${blend.toFixed(3)}`;
        if (key !== paintedKey) {
          paintedKey = key;
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.globalAlpha = 1;
          if (hasSnapshot && blend < 1) context.drawImage(snapshot, 0, 0);
          context.globalAlpha = hasSnapshot ? blend : 1;
          context.drawImage(picture, 0, 0, canvas.width, canvas.height);
          context.globalAlpha = 1;
          if (!registered) {
            // The controller sees a finished first paint, never an empty canvas.
            registerInteractionCanvas("interactive", canvas);
            registered = true;
          } else markInteractionCanvasDirty("interactive");
        }
      }
      frame = requestAnimationFrame(paint);
    };
    frame = requestAnimationFrame(paint);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("mandegar:interaction-departure", departure);
      installationViews.forEach((view) => { images[view].onload = null; images[view].onerror = null; });
      interactionRuntime.touchVisibility = 0;
      if (interactionRuntime.monitorEntries.interactive?.canvas === canvas) registerInteractionCanvas("interactive", null);
    };
  }, [locale]);

  return <div className={styles.installationControls} data-touch-spatial-controls data-installation-controls data-installation-view={state.view}>
    <canvas ref={canvasRef} {...interactionSurfaceSizes.interactive.canvas} className={styles.textureSource} data-composer-canvas />
    <div role="group" aria-label={copy.instruction} className={styles.installationButtons}>
      {installationViews.map((view) => <button key={view} type="button" aria-disabled="true" data-installation-button={view}
        className={styles.installationPhysicalControl} aria-label={copy.views[view]} aria-pressed={state.view === view}
        onClick={(event) => { if (event.currentTarget.dataset.physicalEnabled === "true") selectInstallationView(view); }} />)}
    </div>
    <span className={styles.puzzleScreenReader} role="status" aria-live="polite">
      {copy.views[state.view]}
    </span>
  </div>;
}
