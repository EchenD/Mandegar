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
  photo: { ready: string; capture: string; captured: string; delivery: string; example: string };
  touch: {
    elements: [string, string, string];
    instruction: string;
    complete: string;
    keyboard: string;
  };
  stage: { beam: string; finale: string; play: string; showing: string; ready: string };
  game: {
    action: string;
    serve: string;
    pause: string;
    resume: string;
    finish: string;
    left: string;
    right: string;
    lives: string;
    time: string;
    remaining: string;
    keyboard: string;
    result: string;
    win: string;
    score: string;
    best: string;
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
    photo: { label: "See event photo delivery", title: "Instant photo delivery", instruction: "Watch a moment arrive on your phone." },
    touch: { label: "Shape the experience", title: "Shape the experience.", instruction: "Move the forms. Watch the screen change." },
    stage: { label: "Open stage controls", title: "Your lighting look", instruction: "Choose your lights. Play the show or finish your look." },
    game: { label: "Play Breakout", title: "Breakout", instruction: "Drag the paddle or use ← / → to clear the lights." },
    draw: { label: "Open drawing wall", title: "Leave your mark", instruction: "Draw on the wall, then finish to leave your mark." },
  },
  photo: { ready: "Capture the moment.", capture: "Watch delivery", captured: "On your phone.", delivery: "Straight to your phone.", example: "Demo · example photo" },
  touch: {
    elements: ["Space", "Story", "People"],
    instruction: "Move the forms to shape your experience.",
    complete: "Your space is alive.",
    keyboard: "Press Enter to select. Use arrow keys to move this form.",
  },
  stage: { beam: "Beam", finale: "Your lighting look is ready", play: "Play your show", showing: "Your show is playing", ready: "Pick any lights to create your look" },
  game: {
    action: "Start game",
    serve: "Serve ball",
    pause: "Pause",
    resume: "Resume",
    finish: "Finish round",
    left: "Move paddle left",
    right: "Move paddle right",
    lives: "Lives",
    time: "Time",
    remaining: "Lights cleared",
    keyboard: "Breakout. Use left and right arrow keys to move the paddle. Press Space to serve, pause or resume.",
    result: "Round complete",
    win: "You cleared every light",
    score: "Score",
    best: "Visit best",
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
    photo: { label: "نمایش تحویل عکس رویداد", title: "تحویل فوری عکس", instruction: "رسیدن یک لحظه به گوشی خود را ببینید." },
    touch: { label: "تجربه را بسازید", title: "تجربه را بسازید.", instruction: "شکل‌ها را حرکت دهید؛ تغییر نمایشگر را ببینید." },
    stage: { label: "کنترل نور صحنه", title: "نورپردازی شما", instruction: "نورها را انتخاب کنید؛ نمایش را پخش کنید یا ترکیب را پایان دهید." },
    game: { label: "بازی آجرشکن", title: "آجرشکن", instruction: "سکو را بکشید یا با ← و → حرکت دهید و نورها را پاک کنید." },
    draw: { label: "باز کردن دیوار طراحی", title: "نشان شما", instruction: "روی دیوار بکشید و با پایان، نشانتان را باقی بگذارید." },
  },
  photo: { ready: "ثبت یک لحظه.", capture: "نمایش تحویل", captured: "روی گوشی شما.", delivery: "مستقیم روی گوشی شما.", example: "نمایش خدمات · تصویر نمونه" },
  touch: {
    elements: ["فضا", "روایت", "مردم"],
    instruction: "با حرکت شکل‌ها، تجربه‌تان را بسازید.",
    complete: "فضای شما زنده شد.",
    keyboard: "با Enter انتخاب کنید و با کلیدهای جهت شکل را حرکت دهید.",
  },
  stage: { beam: "پرتو", finale: "نورپردازی شما آماده است", play: "پخش نمایش شما", showing: "نمایش شما در حال پخش است", ready: "نورهای دلخواه را برای ترکیب خود انتخاب کنید" },
  game: {
    action: "شروع بازی",
    serve: "رها کردن توپ",
    pause: "مکث",
    resume: "ادامه بازی",
    finish: "پایان دور",
    left: "حرکت سکو به چپ",
    right: "حرکت سکو به راست",
    lives: "فرصت‌ها",
    time: "زمان",
    remaining: "نورهای پاک‌شده",
    keyboard: "آجرشکن. با کلیدهای جهت چپ و راست، سکو را حرکت دهید. با فاصله، توپ را رها کنید یا بازی را متوقف و ادامه دهید.",
    result: "دور بازی تمام شد",
    win: "همه نورها را پاک کردید",
    score: "امتیاز",
    best: "بهترین این بازدید",
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
    photo: { label: "شاهد تسليم صور الفعالية", title: "تسليم الصور فورًا", instruction: "شاهد اللحظة تصل إلى هاتفك." },
    touch: { label: "شكّل التجربة", title: "شكّل التجربة.", instruction: "حرّك الأشكال وشاهد الشاشة تتغيّر." },
    stage: { label: "فتح تحكم المسرح", title: "إضاءتك", instruction: "اختر الأضواء ثم شغّل العرض أو أنهِ تنسيقك." },
    game: { label: "العب كاسر الطوب", title: "كاسر الطوب", instruction: "اسحب المضرب أو استخدم ← و → لإزالة الأضواء." },
    draw: { label: "فتح جدار الرسم", title: "اترك بصمتك", instruction: "ارسم على الجدار ثم أنهِ الرسم لتبقى بصمتك." },
  },
  photo: { ready: "التقط اللحظة.", capture: "شاهد التسليم", captured: "على هاتفك.", delivery: "مباشرةً إلى هاتفك.", example: "عرض تجريبي · صورة نموذجية" },
  touch: {
    elements: ["المكان", "القصة", "الناس"],
    instruction: "حرّك الأشكال لتشكّل تجربتك.",
    complete: "مكانك ينبض بالحياة.",
    keyboard: "اضغط Enter للاختيار واستخدم الأسهم لتحريك هذا الشكل.",
  },
  stage: { beam: "شعاع", finale: "إضاءتك جاهزة", play: "شغّل عرضك", showing: "عرضك قيد التشغيل", ready: "اختر الأضواء لتشكّل أجواءك" },
  game: {
    action: "ابدأ اللعب",
    serve: "أطلق الكرة",
    pause: "إيقاف مؤقت",
    resume: "متابعة",
    finish: "إنهاء الجولة",
    left: "حرّك المضرب يسارًا",
    right: "حرّك المضرب يمينًا",
    lives: "المحاولات",
    time: "الوقت",
    remaining: "الأضواء المُزالة",
    keyboard: "كاسر الطوب. استخدم سهمي اليسار واليمين لتحريك المضرب. اضغط المسافة لإطلاق الكرة أو إيقاف اللعب ومتابعته.",
    result: "اكتملت الجولة",
    win: "أزلت جميع الأضواء",
    score: "النتيجة",
    best: "أفضل هذه الزيارة",
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
