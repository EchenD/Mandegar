"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { InteractionCopy } from "./interaction-copy";
import { interactionRuntime } from "./interaction-runtime";
import styles from "./HeroInteractions.module.css";

type PhotoStep = "ready" | "countdown" | "captured";

export function PhotoBoothInteraction({
  copy,
  reducedMotion,
  onComplete,
}: {
  copy: InteractionCopy;
  reducedMotion: boolean;
  onComplete: () => void;
}) {
  const [step, setStep] = useState<PhotoStep>("ready");
  const [count, setCount] = useState(3);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  };

  useEffect(() => clearTimers, []);

  useEffect(() => {
    interactionRuntime.photoStep = step;
    return () => {
      interactionRuntime.photoStep = "idle";
    };
  }, [step]);

  const capture = () => {
    clearTimers();
    if (reducedMotion) {
      setStep("captured");
      onComplete();
      return;
    }
    setStep("countdown");
    setCount(3);
    [2, 1].forEach((value, index) => {
      timers.current.push(window.setTimeout(() => setCount(value), (index + 1) * 620));
    });
    timers.current.push(window.setTimeout(() => {
      setStep("captured");
      onComplete();
    }, 1900));
  };

  return (
    <div className={styles.photoExperience} data-photo-state={step}>
      <div className={styles.photoFrame}>
        {step === "captured" ? (
          <div className={styles.photoResult} data-photo-result>
            <Image
              src="/media/placeholders/photo-experience.webp"
              alt=""
              fill
              sizes="(max-width: 760px) 72vw, 26rem"
              priority={false}
            />
            <span>{copy.preview}</span>
          </div>
        ) : (
          <div className={styles.photoReady}>
            <i aria-hidden="true" />
            <p>{step === "countdown" ? count : copy.photo.ready}</p>
          </div>
        )}
        {step === "captured" && <div className={styles.phoneResult} aria-hidden="true"><span /></div>}
        {step === "captured" && !reducedMotion && <div className={styles.photoFlash} data-photo-flash aria-hidden="true" />}
      </div>
      <p className={styles.statusText} role="status">{step === "captured" ? copy.photo.captured : copy.photo.ready}</p>
      <div className={styles.actionRow}>
        {step === "ready" && <button type="button" onClick={capture}>{copy.photo.capture}</button>}
        {step === "captured" && <button type="button" onClick={() => setStep("ready")}>{copy.replay}</button>}
      </div>
    </div>
  );
}
