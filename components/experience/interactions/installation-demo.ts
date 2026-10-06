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
    title: "Every part, one experience",
    concept: "Concept event installation",
    instruction: "Press the table buttons to explore a Mandegar installation.",
    views: { assembled: "Installation", parts: "Components", details: "How it works", image: "Final visual" },
    parts: ["Stage and space", "Content screens", "Lighting", "Visitor interaction"],
    descriptions: ["The setting brings people together.", "Content gives the idea a voice.", "Light shapes the atmosphere.", "Participation connects visitors to the experience."],
  },
  fa: {
    title: "همهٔ بخش‌ها، یک تجربه",
    concept: "نمونهٔ مفهومی یک فضای رویداد",
    instruction: "با دکمه‌های روی میز، بخش‌های یک فضای رویداد ماندگار را کشف کنید.",
    views: { assembled: "فضای رویداد", parts: "اجزای تشکیل‌دهنده", details: "شرح بخش‌ها", image: "تصویر نهایی" },
    parts: ["صحنه و فضا", "نمایشگر و محتوا", "نورپردازی", "تعامل مخاطب"],
    descriptions: ["فضا، افراد را کنار هم جمع می‌کند.", "محتوا به ایده بیان می‌دهد.", "نور، حال‌وهوای فضا را می‌سازد.", "مشارکت، مخاطب را به تجربه پیوند می‌دهد."],
  },
  ar: {
    title: "كل الأجزاء، تجربة واحدة",
    concept: "نموذج مفاهيمي لمساحة فعالية",
    instruction: "اضغط أزرار الطاولة لاستكشاف أجزاء فعالية ماندگار.",
    views: { assembled: "الفعالية", parts: "المكونات", details: "شرح الأجزاء", image: "الصورة النهائية" },
    parts: ["المسرح والمساحة", "الشاشات والمحتوى", "الإضاءة", "تفاعل الزوار"],
    descriptions: ["المكان يجمع الناس معاً.", "المحتوى يمنح الفكرة صوتاً.", "الضوء يرسم أجواء المكان.", "المشاركة تربط الزوار بالتجربة."],
  },
} satisfies Record<Locale, {
  title: string;
  concept: string;
  instruction: string;
  views: Record<InstallationView, string>;
  parts: string[];
  descriptions: string[];
}>;
