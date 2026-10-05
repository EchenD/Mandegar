import type { Locale } from "@/lib/i18n";
import { getIntelligenceCopy } from "./intelligence-inspector-copy";
import type { IntelligenceStationId } from "./intelligence-inspector-store";

// Authored event records illustrate the scene's activities, independent of this site's visitors.
const records = {
  photo: { participants: 128, result: 113, seconds: 24 },
  touch: { participants: 96, result: 82, seconds: 54 },
  game: { participants: 142, result: 1840, seconds: 47 },
  draw: { participants: 84, result: 67, seconds: 78 },
  stage: { participants: 218, result: 204, seconds: 18 },
} as const;

const copy = {
  en: {
    title: "Participation", explore: "Explore participation", previous: "Previous activity", next: "Next activity", close: "Close participation insight",
    participants: "Participants", averageTime: "Average time", minute: "min", second: "sec", meters: "m",
    result: { photo: "Photos captured", touch: "Puzzles completed", game: "Longest run", draw: "Drawings created", stage: "Light sequences" },
  },
  fa: {
    title: "مشارکت", explore: "کاوش مشارکت‌ها", previous: "تجربه قبلی", next: "تجربه بعدی", close: "بستن اطلاعات مشارکت",
    participants: "مشارکت‌کنندگان", averageTime: "میانگین زمان", minute: "دقیقه", second: "ثانیه", meters: "متر",
    result: { photo: "عکس‌های ثبت‌شده", touch: "پازل‌های کامل‌شده", game: "طولانی‌ترین مسیر", draw: "طرح‌های خلق‌شده", stage: "اجراهای نور" },
  },
  ar: {
    title: "المشاركة", explore: "استكشف المشاركة", previous: "التجربة السابقة", next: "التجربة التالية", close: "إغلاق معلومات المشاركة",
    participants: "المشاركون", averageTime: "متوسط الوقت", minute: "دقيقة", second: "ثانية", meters: "م",
    result: { photo: "الصور الملتقطة", touch: "الألغاز المكتملة", game: "أطول مسافة", draw: "الرسومات المنجزة", stage: "عروض الإضاءة" },
  },
} as const;

export function getIntelligenceParticipationCopy(locale: Locale) { return copy[locale]; }

export function getIntelligenceParticipation(station: IntelligenceStationId, locale: Locale) {
  const record = records[station];
  const labels = copy[locale];
  const number = new Intl.NumberFormat(locale);
  const minutes = Math.floor(record.seconds / 60);
  const seconds = record.seconds % 60;
  return {
    station,
    title: getIntelligenceCopy(locale).stations[station],
    copy: labels,
    metrics: [
      { label: labels.participants, value: number.format(record.participants), key: "participants" },
      { label: labels.result[station], value: `${number.format(record.result)}${station === "game" ? ` ${labels.meters}` : ""}`, key: "result" },
      { label: labels.averageTime, value: `${minutes ? `${number.format(minutes)} ${labels.minute} ` : ""}${number.format(seconds)} ${labels.second}`, key: "time" },
    ],
  };
}
