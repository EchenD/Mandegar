import type { Locale } from "@/lib/i18n";
import { reportInteractionParticipation } from "./interaction-participation";

export const installationViews = ["assembled", "parts", "details", "image"] as const;
export type InstallationView = typeof installationViews[number];
let state = { view: "assembled" as InstallationView, revision: 0 };
const listeners = new Set<() => void>();
export const getInstallationState = () => state;
export function subscribeInstallation(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function selectInstallationView(view: InstallationView) {
  state = { view, revision: state.revision + 1 };
  listeners.forEach((listener) => listener());
  reportInteractionParticipation("touch");
}
export function resetInstallation() {
  state = { view: "assembled", revision: 0 };
  listeners.forEach((listener) => listener());
}

export const installationCopy = {
  en: {
    instruction: "Four buttons, one Mandegar story: idea, space, participation and memory. Select a chapter to play or replay it.",
    views: { assembled: "01 — Idea", parts: "02 — Space", details: "03 — Participation", image: "04 — Memory" },
  },
  fa: {
    instruction: "چهار دکمه، یک داستان ماندگار: ایده، فضا، مشارکت و خاطره. هر فصل را انتخاب کنید تا پخش یا تکرار شود.",
    views: { assembled: "۰۱ — ایده", parts: "۰۲ — فضا", details: "۰۳ — مشارکت", image: "۰۴ — خاطره" },
  },
  ar: {
    instruction: "أربعة أزرار، قصة ماندگار واحدة: فكرة، مساحة، مشاركة وذكرى. اختر فصلاً لتشغيله أو إعادته.",
    views: { assembled: "٠١ — فكرة", parts: "٠٢ — مساحة", details: "٠٣ — مشاركة", image: "٠٤ — ذكرى" },
  },
} satisfies Record<Locale, {
  instruction: string;
  views: Record<InstallationView, string>;
}>;
