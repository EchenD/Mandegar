"use client";

import { useState, useSyncExternalStore } from "react";
import type { Locale } from "@/lib/i18n";
import { stageBeamColors } from "./interaction-palette";
import { getVisitorCreation } from "./visitor-creation";
import styles from "./VisitorPostcard.module.css";

const copy = {
  en: { save: "Save your postcard", title: "A space made yours", detail: "Your light. Your mark.", error: "Please try saving again." },
  fa: { save: "ذخیره کارت شما", title: "فضایی به انتخاب شما", detail: "نور شما. نشان شما.", error: "لطفاً دوباره ذخیره کنید." },
  ar: { save: "احفظ بطاقتك", title: "مكان من اختيارك", detail: "إضاءتك. بصمتك.", error: "حاول الحفظ مرة أخرى." },
} as const;

function subscribe(callback: () => void) {
  window.addEventListener("mandegar:creation-change", callback);
  return () => window.removeEventListener("mandegar:creation-change", callback);
}

function hasCreation() {
  const creation = getVisitorCreation();
  return Boolean(creation.drawing || creation.lighting.some(Boolean) || creation.composer.some(Boolean));
}

async function downloadPostcard(locale: Locale) {
  await document.fonts.ready;
  const creation = getVisitorCreation();
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 800;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  context.fillStyle = "#090d14";
  context.fillRect(0, 0, canvas.width, canvas.height);

  creation.lighting.forEach((selected, index) => {
    if (!selected) return;
    const x = 180 + index * 210;
    const gradient = context.createLinearGradient(x, 170, 600, 720);
    gradient.addColorStop(0, `${stageBeamColors[index]}00`);
    gradient.addColorStop(0.45, `${stageBeamColors[index]}38`);
    gradient.addColorStop(1, `${stageBeamColors[index]}08`);
    context.fillStyle = gradient;
    context.beginPath();
    context.moveTo(x, 160);
    context.lineTo(x - 230, 720);
    context.lineTo(x + 230, 720);
    context.closePath();
    context.fill();
  });

  if (creation.drawing) {
    const artwork = creation.drawing;
    const scale = Math.min(1000 / artwork.width, 450 / artwork.height);
    const width = artwork.width * scale;
    const height = artwork.height * scale;
    context.drawImage(artwork, (1200 - width) / 2, 220 + (450 - height) / 2, width, height);
  } else if (creation.composer.some(Boolean)) {
    context.strokeStyle = "#75d8ff";
    context.lineWidth = 3;
    creation.composer.forEach((selected, index) => {
      if (!selected) return;
      context.beginPath();
      context.arc(600, 450, 90 + index * 55, -.8, Math.PI * 1.7);
      context.stroke();
    });
  }

  context.strokeStyle = "rgba(247,247,244,.18)";
  context.lineWidth = 1;
  context.strokeRect(40, 40, 1120, 720);
  context.textAlign = "center";
  context.fillStyle = "#75d8ff";
  context.font = '700 20px "Vazirmatn Variable", Tahoma, sans-serif';
  context.fillText("MANDEGAR", 600, 92);
  context.direction = locale === "en" ? "ltr" : "rtl";
  context.fillStyle = "#f7f7f4";
  context.font = '600 44px "Vazirmatn Variable", Tahoma, sans-serif';
  context.fillText(copy[locale].title, 600, 160, 1020);
  context.fillStyle = "rgba(247,247,244,.66)";
  context.font = '400 20px "Vazirmatn Variable", Tahoma, sans-serif';
  context.fillText(copy[locale].detail, 600, 724);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Export unavailable")), "image/png");
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "mandegar-your-space.png";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function VisitorPostcard({ locale }: { locale: Locale }) {
  const available = useSyncExternalStore(subscribe, hasCreation, () => false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  if (!available) return null;
  return (
    <div className={styles.control}>
      <button type="button" data-save-postcard disabled={saving} onClick={async () => {
        setSaving(true);
        setError(false);
        try { await downloadPostcard(locale); } catch { setError(true); } finally { setSaving(false); }
      }}>
        {copy[locale].save}<span aria-hidden="true">↓</span>
      </button>
      {error && <span role="status">{copy[locale].error}</span>}
    </div>
  );
}
