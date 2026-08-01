"use client";

import { useEffect, useRef } from "react";
import type { MediaAsset } from "@/lib/content";
import type { Locale } from "@/lib/i18n";

type NavigatorWithConnection = Navigator & {
  connection?: { saveData?: boolean };
};

export function AdaptiveVideo({ media, locale, label }: { media: MediaAsset; locale: Locale; label: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as NavigatorWithConnection).connection?.saveData === true;
    if (!reducedMotion && !saveData) void video.play().catch(() => undefined);
    return () => video.pause();
  }, []);

  return (
    <video ref={videoRef} aria-label={label} controls loop muted playsInline preload="metadata" poster={media.poster} onPlay={() => window.dispatchEvent(new CustomEvent("mandegar:media", { detail: { action: "video_play", label } }))}>
      {media.mobileSrc ? <source media="(max-width: 760px)" src={media.mobileSrc} /> : null}
      <source src={media.src} />
      {media.captionsSrc ? <track kind="captions" src={media.captionsSrc} srcLang={locale} label={label} default /> : null}
    </video>
  );
}
