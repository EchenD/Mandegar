"use client";

import { useEffect, useRef, useState } from "react";
import { completeIntro, directIntro } from "./intro-director";
import styles from "./ExperienceIntro.module.css";

const INTRO_SESSION_KEY = "mandegar:intro-seen:v1";
const INTRO_DURATION_MS = 3400;

export function ExperienceIntro({
  ready,
  enabled,
  skipLabel,
  onComplete,
}: {
  ready: boolean;
  enabled: boolean;
  skipLabel: string;
  onComplete: () => void;
}) {
  const [active, setActive] = useState(false);
  const finishRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    if (!ready) {
      return () => {
        document.documentElement.style.overflow = previousOverflow;
      };
    }

    const parameters = new URLSearchParams(window.location.search);
    const introPreference = parameters.get("intro");
    const forceIntro = introPreference === "1";
    const skipIntro = introPreference === "0" || parameters.has("phase");
    const requestedDuration = Number(parameters.get("introDuration"));
    const duration = process.env.NODE_ENV !== "production" && Number.isFinite(requestedDuration)
      ? Math.min(30_000, Math.max(1_000, requestedDuration))
      : INTRO_DURATION_MS;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
    let hasSeenIntro = false;
    try {
      hasSeenIntro = window.sessionStorage.getItem(INTRO_SESSION_KEY) === "true";
    } catch {
      hasSeenIntro = false;
    }
    const shouldPlay = enabled && !skipIntro && !reduced && !saveData && (forceIntro || !hasSeenIntro);
    let animationFrame: number | undefined;
    let startedAt: number | undefined;
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame);
      if (shouldPlay) {
        try {
          window.sessionStorage.setItem(INTRO_SESSION_KEY, "true");
        } catch {
          // Storage can be unavailable in privacy-restricted contexts.
        }
      }
      completeIntro();
      document.documentElement.style.overflow = previousOverflow;
      setActive(false);
      onComplete();
    };
    finishRef.current = finish;

    if (!shouldPlay) {
      finish();
      return () => {
        document.documentElement.style.overflow = previousOverflow;
      };
    }

    directIntro(0);
    const tick = (time: number) => {
      startedAt ??= time;
      const progress = Math.min(1, (time - startedAt) / duration);
      directIntro(progress);
      if (progress >= 1) {
        finish();
        return;
      }
      animationFrame = window.requestAnimationFrame(tick);
    };
    animationFrame = window.requestAnimationFrame((time) => {
      setActive(true);
      tick(time);
    });

    return () => {
      finished = true;
      if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame);
      document.documentElement.style.overflow = previousOverflow;
      finishRef.current = () => undefined;
    };
  }, [enabled, onComplete, ready]);

  if (!active) return null;
  return (
    <div className={styles.root} data-experience-intro="active">
      <button className={styles.skip} type="button" onClick={() => finishRef.current()}>
        {skipLabel}
      </button>
    </div>
  );
}
