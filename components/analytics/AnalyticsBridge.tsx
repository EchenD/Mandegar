"use client";

import { useEffect } from "react";
import type { Locale } from "@/lib/i18n";

type AnalyticsWindow = Window & { dataLayer?: Array<Record<string, unknown>> };

export function AnalyticsBridge({ locale }: { locale: Locale }) {
  useEffect(() => {
    const track = (action: string, label?: string) => {
      const detail = { event: "mandegar_interaction", action, label, locale, path: window.location.pathname };
      window.dispatchEvent(new CustomEvent("mandegar:analytics", { detail }));
      if (window.localStorage.getItem("mandegar-analytics-consent") === "granted") (window as AnalyticsWindow).dataLayer?.push(detail);
    };
    const handleClick = (event: MouseEvent) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-analytics]");
      if (target) track(target.dataset.analytics || "interaction", target.dataset.analyticsLabel);
    };
    const handleMedia = (event: Event) => {
      const detail = (event as CustomEvent<{ action: string; label?: string }>).detail;
      if (detail?.action) track(detail.action, detail.label);
    };
    document.addEventListener("click", handleClick);
    window.addEventListener("mandegar:media", handleMedia);
    return () => {
      document.removeEventListener("click", handleClick);
      window.removeEventListener("mandegar:media", handleMedia);
    };
  }, [locale]);

  return null;
}
