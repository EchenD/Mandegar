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
  stations: Record<InteractionStation, StationCopy>;
  photo: { ready: string; capture: string; captured: string };
  touch: {
    elements: [string, string, string];
    instruction: string;
    complete: string;
  };
  stage: { beam: string; finale: string };
  game: {
    action: string;
    result: string;
    perfect: string;
    hit: string;
    outer: string;
    missed: string;
  };
  draw: { local: string; complete: string };
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
  stations: {
    photo: { label: "Open photo booth", title: "Photo booth", instruction: "Create a simulated portrait moment." },
    touch: { label: "Open experience composer", title: "Experience composer", instruction: "Connect space, story and people." },
    stage: { label: "Open stage controls", title: "Stage beam control", instruction: "Build the stage look with five beams." },
    game: { label: "Launch the signal", title: "Signal toss", instruction: "Pull back, aim and release toward the active gate." },
    draw: { label: "Open drawing wall", title: "Drawing wall", instruction: "Draw a luminous mark on the live display." },
  },
  photo: { ready: "Ready for a simulated capture", capture: "Start capture", captured: "Preview created — no camera was used." },
  touch: {
    elements: ["Space", "Story", "People"],
    instruction: "Connect the elements. Shape the experience.",
    complete: "The experience is connected.",
  },
  stage: { beam: "Beam", finale: "Stage composition complete" },
  game: {
    action: "Launch signal",
    result: "Signal run complete",
    perfect: "Signal network connected",
    hit: "Bullseye · 100",
    outer: "Gate hit · 50",
    missed: "Missed — adjust your aim",
  },
  draw: {
    local: "Your drawing stays in this browser session.",
    complete: "Your luminous mark is complete.",
  },
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
  stations: {
    photo: { label: "ورود به غرفه عکس", title: "غرفه عکس", instruction: "یک پرتره نمایشی و شبیه‌سازی‌شده بسازید." },
    touch: { label: "باز کردن ترکیب‌ساز تجربه", title: "ترکیب‌ساز تجربه", instruction: "فضا، روایت و مردم را به هم متصل کنید." },
    stage: { label: "کنترل نور صحنه", title: "کنترل پرتوهای صحنه", instruction: "با پنج پرتو، نمای صحنه را کامل کنید." },
    game: { label: "پرتاب سیگنال", title: "پرتاب سیگنال", instruction: "سیگنال را عقب بکشید، هدف بگیرید و رها کنید." },
    draw: { label: "باز کردن دیوار طراحی", title: "دیوار طراحی", instruction: "نشانی نورانی روی نمایشگر بکشید." },
  },
  photo: { ready: "آماده ثبت نمایشی", capture: "شروع ثبت", captured: "پیش‌نمایش ساخته شد؛ هیچ دوربینی استفاده نشد." },
  touch: {
    elements: ["فضا", "روایت", "مردم"],
    instruction: "عناصر را به هم متصل کنید و تجربه را شکل دهید.",
    complete: "تجربه به هم پیوست.",
  },
  stage: { beam: "پرتو", finale: "ترکیب صحنه کامل شد" },
  game: {
    action: "پرتاب سیگنال",
    result: "دور سیگنال تمام شد",
    perfect: "شبکه سیگنال متصل شد",
    hit: "مرکز هدف · ۱۰۰",
    outer: "اصابت به دروازه · ۵۰",
    missed: "خطا — جهت را تنظیم کنید",
  },
  draw: {
    local: "طراحی فقط در همین نشست مرورگر می‌ماند.",
    complete: "نشان نورانی شما کامل شد.",
  },
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
  stations: {
    photo: { label: "فتح جناح الصور", title: "جناح الصور", instruction: "أنشئ لحظة بورتريه تجريبية." },
    touch: { label: "فتح مؤلف التجربة", title: "مؤلف التجربة", instruction: "اربط المكان والقصة والناس." },
    stage: { label: "فتح تحكم المسرح", title: "تحكم أشعة المسرح", instruction: "كوّن مشهد المسرح بخمسة أشعة." },
    game: { label: "إطلاق الإشارة", title: "إطلاق الإشارة", instruction: "اسحب الإشارة للخلف، صوّب ثم أطلقها." },
    draw: { label: "فتح جدار الرسم", title: "جدار الرسم", instruction: "ارسم علامة مضيئة على الشاشة." },
  },
  photo: { ready: "جاهز لالتقاط تجريبي", capture: "بدء الالتقاط", captured: "تم إنشاء المعاينة من دون استخدام كاميرا." },
  touch: {
    elements: ["المكان", "القصة", "الناس"],
    instruction: "اربط العناصر وشكّل التجربة.",
    complete: "اكتمل اتصال التجربة.",
  },
  stage: { beam: "شعاع", finale: "اكتمل مشهد المسرح" },
  game: {
    action: "إطلاق الإشارة",
    result: "اكتملت جولة الإشارة",
    perfect: "تم ربط شبكة الإشارة",
    hit: "إصابة المركز · ١٠٠",
    outer: "إصابة البوابة · ٥٠",
    missed: "لم تصب — عدّل اتجاهك",
  },
  draw: {
    local: "يبقى رسمك في جلسة المتصفح الحالية فقط.",
    complete: "اكتملت علامتك المضيئة.",
  },
};

export function getInteractionCopy(locale: Locale) {
  if (locale === "fa") return persian;
  if (locale === "ar") return arabic;
  return english;
}
