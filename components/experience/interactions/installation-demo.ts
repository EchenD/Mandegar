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
    instruction: "Explore the Mandegar stage using the four table buttons.",
    views: { assembled: "Mandegar stage", parts: "Stage components", details: "Screen and lighting", image: "The complete experience" },
  },
  fa: {
    instruction: "با چهار دکمهٔ روی میز، صحنهٔ ماندگار را کشف کنید.",
    views: { assembled: "صحنهٔ ماندگار", parts: "اجزای صحنه", details: "نمایشگر و نورپردازی", image: "تجربهٔ کامل" },
  },
  ar: {
    instruction: "استكشف مسرح ماندگار باستخدام أزرار الطاولة الأربعة.",
    views: { assembled: "مسرح ماندگار", parts: "مكونات المسرح", details: "الشاشة والإضاءة", image: "التجربة الكاملة" },
  },
} satisfies Record<Locale, {
  instruction: string;
  views: Record<InstallationView, string>;
}>;
