import type { Locale } from "@/lib/i18n";

const copy = {
  en: {
    example: "Audience insight",
    signal: "Participation signal",
    explore: "Explore interactions",
    activities: "Activities tried",
    time: "Participation time",
    previous: "Previous person",
    next: "Next person",
    close: "Close audience insight",
    minute: "min",
    second: "sec",
    stations: { photo: "Photo booth", game: "Road race", draw: "Drawing wall", touch: "Interactive monitor", stage: "Stage lighting" },
  },
  fa: {
    example: "شناخت مخاطب",
    signal: "سیگنال مشارکت",
    explore: "کاوش تعامل‌ها",
    activities: "تجربه‌های انجام‌شده",
    time: "زمان مشارکت",
    previous: "نفر قبلی",
    next: "نفر بعدی",
    close: "بستن اطلاعات مخاطب",
    minute: "دقیقه",
    second: "ثانیه",
    stations: { photo: "غرفه عکس", game: "مسابقه ماشین", draw: "دیوار طراحی", touch: "نمایشگر تعاملی", stage: "نورپردازی صحنه" },
  },
  ar: {
    example: "فهم الجمهور",
    signal: "إشارة المشاركة",
    explore: "استكشف التفاعل",
    activities: "التجارب التي تمت",
    time: "وقت المشاركة",
    previous: "الشخص السابق",
    next: "الشخص التالي",
    close: "إغلاق معلومات الجمهور",
    minute: "دقيقة",
    second: "ثانية",
    stations: { photo: "ركن التصوير", game: "سباق السيارات", draw: "جدار الرسم", touch: "الشاشة التفاعلية", stage: "إضاءة المسرح" },
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
