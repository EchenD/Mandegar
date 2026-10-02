import type { Locale } from "@/lib/i18n";

const copy = {
  en: {
    example: "Example data · simulated",
    explore: "Explore example activity",
    activities: "Activities tried",
    time: "Participation time",
    previous: "Previous example",
    next: "Next example",
    close: "Close example data",
    minute: "min",
    second: "sec",
    stations: { photo: "Photo booth", game: "Breakout", draw: "Drawing wall", touch: "Interactive monitor", stage: "Stage lighting" },
  },
  fa: {
    example: "داده نمونه · شبیه‌سازی‌شده",
    explore: "دیدن نمونه مشارکت",
    activities: "تجربه‌های انجام‌شده",
    time: "زمان مشارکت",
    previous: "نمونه قبلی",
    next: "نمونه بعدی",
    close: "بستن داده نمونه",
    minute: "دقیقه",
    second: "ثانیه",
    stations: { photo: "غرفه عکس", game: "آجرشکن", draw: "دیوار طراحی", touch: "نمایشگر تعاملی", stage: "نورپردازی صحنه" },
  },
  ar: {
    example: "بيانات نموذجية · محاكاة",
    explore: "استكشف نموذج المشاركة",
    activities: "التجارب التي تمت",
    time: "وقت المشاركة",
    previous: "المثال السابق",
    next: "المثال التالي",
    close: "إغلاق البيانات النموذجية",
    minute: "دقيقة",
    second: "ثانية",
    stations: { photo: "ركن التصوير", game: "كاسر الطوب", draw: "جدار الرسم", touch: "الشاشة التفاعلية", stage: "إضاءة المسرح" },
  },
} as const;

type SampleStation = keyof typeof copy.en.stations;
const examples: readonly { activities: readonly SampleStation[]; seconds: number }[] = [
  { activities: ["photo", "game", "draw"], seconds: 150 },
  { activities: ["touch", "stage"], seconds: 95 },
  { activities: ["photo", "draw"], seconds: 125 },
  { activities: ["game", "touch", "stage"], seconds: 180 },
  { activities: ["draw", "stage"], seconds: 110 },
];

export function getIntelligenceCopy(locale: Locale) { return copy[locale]; }

/** Fixed illustrative records describe the demo figures, never this site's visitors. */
export function getIntelligenceExample(id: string, locale: Locale) {
  const index = Number(id.replace("Human_", ""));
  const example = examples[(Number.isFinite(index) ? index : 0) % examples.length];
  const labels = copy[locale];
  const number = new Intl.NumberFormat(locale);
  const minutes = Math.floor(example.seconds / 60);
  const seconds = example.seconds % 60;
  return {
    activities: example.activities.map((activity) => labels.stations[activity]).join(" · "),
    activityNames: example.activities.map((activity) => labels.stations[activity]),
    time: `${number.format(minutes)} ${labels.minute}${seconds ? ` ${number.format(seconds)} ${labels.second}` : ""}`,
  };
}
