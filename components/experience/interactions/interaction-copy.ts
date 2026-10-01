import type { Locale } from "@/lib/i18n";
import type { InteractionStation } from "./interaction-types";

type StationCopy = { label: string; title: string; instruction: string };

export type InteractionCopy = {
  preview: string;
  close: string;
  skip: string;
  continue: string;
  replay: string;
  finish: string;
  reset: string;
  clear: string;
  undo: string;
  stations: Record<InteractionStation, StationCopy>;
  photo: { ready: string; capture: string; captured: string; choose: string; looks: [string, string] };
  touch: {
    elements: [string, string, string];
    instruction: string;
    complete: string;
  };
  stage: { beam: string; finale: string; play: string; showing: string; ready: string };
  game: {
    action: string;
    result: string;
    perfect: string;
    hit: string;
    outer: string;
    missed: string;
    score: string;
    best: string;
    throws: string;
  };
  draw: { local: string; complete: string; replaying: string; keyboard: string };
};

const english: InteractionCopy = {
  preview: "Experience preview",
  close: "Close experience",
  skip: "Skip interaction",
  continue: "Continue journey",
  replay: "Replay",
  finish: "Finish",
  reset: "Reset",
  clear: "Clear",
  undo: "Undo",
  stations: {
    photo: { label: "Open photo booth", title: "Photo booth", instruction: "Choose a look, then start your simulated capture." },
    touch: { label: "Open experience composer", title: "Experience composer", instruction: "Tap each ingredient and watch the space respond." },
    stage: { label: "Open stage controls", title: "Your lighting look", instruction: "Choose your lights. Play the show or finish your look." },
    game: { label: "Launch the signal", title: "Signal toss", instruction: "Pull back, aim and release toward the active gate." },
    draw: { label: "Open drawing wall", title: "Leave your mark", instruction: "Draw on the wall, then finish to leave your mark." },
  },
  photo: { ready: "Simulated portrait · choose a mood", capture: "Start capture", captured: "Simulated portrait preview", choose: "Choose a look", looks: ["Warm", "Cool"] },
  touch: {
    elements: ["Space", "Story", "People"],
    instruction: "Space lights the path. Story shapes the screen. People bring the energy.",
    complete: "Your space is alive.",
  },
  stage: { beam: "Beam", finale: "Your lighting look is ready", play: "Play your show", showing: "Your show is playing", ready: "Pick any lights to create your look" },
  game: {
    action: "Launch signal",
    result: "Signal run complete",
    perfect: "Signal network connected",
    hit: "Bullseye · 100",
    outer: "Gate hit · 50",
    missed: "Missed — adjust your aim",
    score: "Score",
    best: "Visit best",
    throws: "Throws",
  },
  draw: {
    local: "Your drawing stays in this browser session.",
    complete: "Your luminous mark is complete.",
    replaying: "Your mark comes to life",
    keyboard: "Drawing wall. Press Space to start or stop a stroke. Use arrow keys to draw.",
  },
};

const persian: InteractionCopy = {
  ...english,
  preview: "پیش‌نمایش تجربه",
  close: "بستن تجربه",
  skip: "رد کردن تعامل",
  continue: "ادامه مسیر",
  replay: "تکرار",
  finish: "پایان",
  reset: "بازنشانی",
  clear: "پاک کردن",
  undo: "بازگشت",
  stations: {
    photo: { label: "ورود به غرفه عکس", title: "غرفه عکس", instruction: "حال‌وهوا را انتخاب کنید، سپس ثبت نمایشی را شروع کنید." },
    touch: { label: "باز کردن ترکیب‌ساز تجربه", title: "ترکیب‌ساز تجربه", instruction: "هر عنصر را لمس کنید و واکنش فضا را ببینید." },
    stage: { label: "کنترل نور صحنه", title: "نورپردازی شما", instruction: "نورها را انتخاب کنید؛ نمایش را پخش کنید یا ترکیب را پایان دهید." },
    game: { label: "پرتاب سیگنال", title: "پرتاب سیگنال", instruction: "سیگنال را عقب بکشید، هدف بگیرید و رها کنید." },
    draw: { label: "باز کردن دیوار طراحی", title: "نشان شما", instruction: "روی دیوار بکشید و با پایان، نشانتان را باقی بگذارید." },
  },
  photo: { ready: "پرتره نمایشی · انتخاب حال‌وهوا", capture: "شروع ثبت", captured: "پیش‌نمایش پرتره نمایشی", choose: "انتخاب حال‌وهوا", looks: ["گرم", "سرد"] },
  touch: {
    elements: ["فضا", "روایت", "مردم"],
    instruction: "فضا مسیر را روشن می‌کند؛ روایت نمایشگر را شکل می‌دهد؛ مردم انرژی می‌آورند.",
    complete: "فضای شما زنده شد.",
  },
  stage: { beam: "پرتو", finale: "نورپردازی شما آماده است", play: "پخش نمایش شما", showing: "نمایش شما در حال پخش است", ready: "نورهای دلخواه را برای ترکیب خود انتخاب کنید" },
  game: {
    action: "پرتاب سیگنال",
    result: "دور سیگنال تمام شد",
    perfect: "شبکه سیگنال متصل شد",
    hit: "مرکز هدف · ۱۰۰",
    outer: "اصابت به دروازه · ۵۰",
    missed: "خطا — جهت را تنظیم کنید",
    score: "امتیاز",
    best: "بهترین این بازدید",
    throws: "پرتاب‌ها",
  },
  draw: {
    local: "طراحی فقط در همین نشست مرورگر می‌ماند.",
    complete: "نشان نورانی شما کامل شد.",
    replaying: "نشان شما جان می‌گیرد",
    keyboard: "دیوار طراحی. با فاصله خط را شروع یا متوقف کنید و با کلیدهای جهت طراحی کنید.",
  },
};

const arabic: InteractionCopy = {
  ...english,
  preview: "معاينة التجربة",
  close: "إغلاق التجربة",
  skip: "تخطي التفاعل",
  continue: "متابعة الرحلة",
  replay: "إعادة",
  finish: "إنهاء",
  reset: "إعادة ضبط",
  clear: "مسح",
  undo: "تراجع",
  stations: {
    photo: { label: "فتح جناح الصور", title: "جناح الصور", instruction: "اختر الأجواء ثم ابدأ الالتقاط التجريبي." },
    touch: { label: "فتح مؤلف التجربة", title: "مؤلف التجربة", instruction: "المس كل عنصر وشاهد استجابة المكان." },
    stage: { label: "فتح تحكم المسرح", title: "إضاءتك", instruction: "اختر الأضواء ثم شغّل العرض أو أنهِ تنسيقك." },
    game: { label: "إطلاق الإشارة", title: "إطلاق الإشارة", instruction: "اسحب الإشارة للخلف، صوّب ثم أطلقها." },
    draw: { label: "فتح جدار الرسم", title: "اترك بصمتك", instruction: "ارسم على الجدار ثم أنهِ الرسم لتبقى بصمتك." },
  },
  photo: { ready: "بورتريه تجريبي · اختر الأجواء", capture: "بدء الالتقاط", captured: "معاينة بورتريه تجريبية", choose: "اختر الأجواء", looks: ["دافئة", "باردة"] },
  touch: {
    elements: ["المكان", "القصة", "الناس"],
    instruction: "المكان يضيء المسار، والقصة تشكّل الشاشة، والناس يبعثون الطاقة.",
    complete: "مكانك ينبض بالحياة.",
  },
  stage: { beam: "شعاع", finale: "إضاءتك جاهزة", play: "شغّل عرضك", showing: "عرضك قيد التشغيل", ready: "اختر الأضواء لتشكّل أجواءك" },
  game: {
    action: "إطلاق الإشارة",
    result: "اكتملت جولة الإشارة",
    perfect: "تم ربط شبكة الإشارة",
    hit: "إصابة المركز · ١٠٠",
    outer: "إصابة البوابة · ٥٠",
    missed: "لم تصب — عدّل اتجاهك",
    score: "النتيجة",
    best: "أفضل هذه الزيارة",
    throws: "الرميات",
  },
  draw: {
    local: "يبقى رسمك في جلسة المتصفح الحالية فقط.",
    complete: "اكتملت علامتك المضيئة.",
    replaying: "بصمتك تنبض بالحياة",
    keyboard: "جدار الرسم. اضغط المسافة لبدء الخط أو إيقافه، واستخدم أسهم الاتجاه للرسم.",
  },
};

export function getInteractionCopy(locale: Locale) {
  if (locale === "fa") return persian;
  if (locale === "ar") return arabic;
  return english;
}
