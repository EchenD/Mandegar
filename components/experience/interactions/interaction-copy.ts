import type { Locale } from "@/lib/i18n";
import type { InteractionStation } from "./interaction-types";

type StationCopy = { label: string; title: string; instruction: string };

export type InteractionCopy = {
  preview: string;
  close: string;
  continue: string;
  replay: string;
  finish: string;
  reset: string;
  clear: string;
  undo: string;
  preset: string;
  stations: Record<InteractionStation, StationCopy>;
  photo: { ready: string; capture: string; captured: string };
  touch: { presets: [string, string, string] };
  stage: { beam: string; finale: string };
  game: { action: string; result: string; hit: string; missed: string };
  draw: { keyboardMark: string; local: string };
};

const english: InteractionCopy = {
  preview: "Experience preview",
  close: "Close experience",
  continue: "Continue journey",
  replay: "Replay",
  finish: "Finish",
  reset: "Reset",
  clear: "Clear",
  undo: "Undo",
  preset: "Add preset mark",
  stations: {
    photo: { label: "Open photo booth", title: "Photo booth", instruction: "Create a simulated portrait moment." },
    touch: { label: "Open visual composer", title: "Visual composer", instruction: "Drag across the pad or choose a preset." },
    stage: { label: "Open stage controls", title: "Stage beam control", instruction: "Build the stage look with five beams." },
    game: { label: "Play target game", title: "Signal timing", instruction: "Press the target as it reaches the center." },
    draw: { label: "Open drawing wall", title: "Drawing wall", instruction: "Draw a luminous mark on the live display." },
  },
  photo: { ready: "Ready for a simulated capture", capture: "Start capture", captured: "Preview created — no camera was used." },
  touch: { presets: ["Cobalt orbit", "Magenta field", "Amber pulse"] },
  stage: { beam: "Beam", finale: "Stage composition complete" },
  game: { action: "Hit target", result: "Signal session complete", hit: "In sync", missed: "Try the next pulse" },
  draw: { keyboardMark: "Add a keyboard-accessible signature mark", local: "Your drawing stays in this browser session." },
};

const persian: InteractionCopy = {
  ...english,
  preview: "پیش‌نمایش تجربه",
  close: "بستن تجربه",
  continue: "ادامه مسیر",
  replay: "تکرار",
  finish: "پایان",
  reset: "بازنشانی",
  clear: "پاک کردن",
  undo: "بازگشت",
  preset: "افزودن نشان آماده",
  stations: {
    photo: { label: "ورود به غرفه عکس", title: "غرفه عکس", instruction: "یک پرتره نمایشی و شبیه‌سازی‌شده بسازید." },
    touch: { label: "باز کردن ترکیب‌ساز", title: "ترکیب‌ساز تصویری", instruction: "روی صفحه بکشید یا یک ترکیب آماده انتخاب کنید." },
    stage: { label: "کنترل نور صحنه", title: "کنترل پرتوهای صحنه", instruction: "با پنج پرتو، نمای صحنه را کامل کنید." },
    game: { label: "شروع بازی زمان‌بندی", title: "ریتم سیگنال", instruction: "وقتی هدف به مرکز رسید آن را بزنید." },
    draw: { label: "باز کردن دیوار طراحی", title: "دیوار طراحی", instruction: "نشانی نورانی روی نمایشگر بکشید." },
  },
  photo: { ready: "آماده ثبت نمایشی", capture: "شروع ثبت", captured: "پیش‌نمایش ساخته شد؛ هیچ دوربینی استفاده نشد." },
  touch: { presets: ["مدار آبی", "میدان ارغوانی", "ضربان کهربایی"] },
  stage: { beam: "پرتو", finale: "ترکیب صحنه کامل شد" },
  game: { action: "زدن هدف", result: "تمرین سیگنال کامل شد", hit: "هم‌زمان", missed: "ضربان بعدی را امتحان کنید" },
  draw: { keyboardMark: "افزودن نشان آماده با صفحه‌کلید", local: "طراحی فقط در همین نشست مرورگر می‌ماند." },
};

const arabic: InteractionCopy = {
  ...english,
  preview: "معاينة التجربة",
  close: "إغلاق التجربة",
  continue: "متابعة الرحلة",
  replay: "إعادة",
  finish: "إنهاء",
  reset: "إعادة ضبط",
  clear: "مسح",
  undo: "تراجع",
  preset: "إضافة علامة جاهزة",
  stations: {
    photo: { label: "فتح جناح الصور", title: "جناح الصور", instruction: "أنشئ لحظة بورتريه تجريبية." },
    touch: { label: "فتح المؤلف البصري", title: "المؤلف البصري", instruction: "اسحب على اللوحة أو اختر إعداداً جاهزاً." },
    stage: { label: "فتح تحكم المسرح", title: "تحكم أشعة المسرح", instruction: "كوّن مشهد المسرح بخمسة أشعة." },
    game: { label: "لعب تحدي التوقيت", title: "توقيت الإشارة", instruction: "اضغط عندما يصل الهدف إلى المنتصف." },
    draw: { label: "فتح جدار الرسم", title: "جدار الرسم", instruction: "ارسم علامة مضيئة على الشاشة." },
  },
  photo: { ready: "جاهز لالتقاط تجريبي", capture: "بدء الالتقاط", captured: "تم إنشاء المعاينة من دون استخدام كاميرا." },
  touch: { presets: ["مدار أزرق", "حقل أرجواني", "نبض كهرماني"] },
  stage: { beam: "شعاع", finale: "اكتمل مشهد المسرح" },
  game: { action: "إصابة الهدف", result: "اكتملت جلسة الإشارة", hit: "متزامن", missed: "جرّب النبضة التالية" },
  draw: { keyboardMark: "إضافة علامة جاهزة بلوحة المفاتيح", local: "يبقى رسمك في جلسة المتصفح الحالية فقط." },
};

export function getInteractionCopy(locale: Locale) {
  if (locale === "fa") return persian;
  if (locale === "ar") return arabic;
  return english;
}
