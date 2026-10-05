import type { Locale } from "@/lib/i18n";
import type { InteractionStation } from "./interaction-types";

type StationCopy = { label: string; title: string; instruction: string };

export type InteractionCopy = {
  preview: string;
  close: string;
  skip: string;
  scrollContinue: string;
  scrollNext: string;
  continue: string;
  replay: string;
  finish: string;
  reset: string;
  clear: string;
  undo: string;
  stations: Record<InteractionStation, StationCopy>;
  photo: { ready: string; capture: string; captured: string; delivery: string; example: string };
  touch: {
    instruction: string;
    complete: string;
    keyboard: string;
    tile: string;
    moves: string;
  };
  stage: { beam: string; finale: string; play: string; showing: string; ready: string };
  game: {
    distance: string;
    crashed: string;
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
  scrollContinue: "Keep scrolling to skip",
  scrollNext: "Scroll to continue",
  continue: "Continue journey",
  replay: "Replay",
  finish: "Finish",
  reset: "Reset",
  clear: "Clear",
  undo: "Undo",
  stations: {
    photo: { label: "See event photo delivery", title: "Instant photo delivery", instruction: "Watch a moment arrive on your phone." },
    touch: { label: "Open picture puzzle", title: "Picture puzzle", instruction: "Swap two pieces to reveal the picture." },
    stage: { label: "Watch the lighting show", title: "Light brings the space to life", instruction: "Watch light bring the space to life." },
    game: { label: "Play road race", title: "Road race", instruction: "Drag to steer or use ← / →. Avoid traffic." },
    draw: { label: "Open drawing wall", title: "Leave your mark", instruction: "Draw on the wall, then finish to leave your mark." },
  },
  photo: { ready: "Capture the moment.", capture: "Watch delivery", captured: "On your phone.", delivery: "Straight to your phone.", example: "Demo · example photo" },
  touch: {
    instruction: "Drag a piece onto another, or tap two pieces, to swap them.",
    complete: "Mandegar brings every part together into one experience.",
    keyboard: "Use arrow keys to move between pieces. Press Enter or Space to select two pieces to swap. Grid directions follow the picture.",
    tile: "Piece {piece}, row {row}, column {column}",
    moves: "{count} swaps",
  },
  stage: { beam: "Beam", finale: "Your lighting look is ready", play: "Play your show", showing: "Your show is playing", ready: "Pick any lights to create your look" },
  game: {
    distance: "Distance",
    crashed: "Race over",
    action: "Start game",
    serve: "Serve ball",
    pause: "Pause",
    resume: "Resume",
    finish: "Finish round",
    left: "Steer left",
    right: "Steer right",
    lives: "Lives",
    time: "Time",
    remaining: "Lights cleared",
    keyboard: "Road race. Use left and right arrow keys to steer. Press Space to pause or resume. A crash ends the race. Scroll or press Escape to leave.",
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
  scrollContinue: "برای عبور، اسکرول را ادامه دهید",
  scrollNext: "برای ادامهٔ مسیر اسکرول کنید",
  continue: "ادامه مسیر",
  replay: "تکرار",
  finish: "پایان",
  reset: "بازنشانی",
  clear: "پاک کردن",
  undo: "بازگشت",
  stations: {
    photo: { label: "نمایش تحویل عکس رویداد", title: "تحویل فوری عکس", instruction: "رسیدن یک لحظه به گوشی خود را ببینید." },
    touch: { label: "باز کردن پازل تصویر", title: "پازل تصویر", instruction: "دو قطعه را جابه‌جا کنید تا تصویر کامل شود." },
    stage: { label: "تماشای نورپردازی", title: "نور، فضا را زنده می‌کند", instruction: "ببینید نور چگونه فضا را زنده می‌کند." },
    game: { label: "بازی مسابقه ماشین", title: "مسابقه ماشین", instruction: "برای فرمان دادن بکشید یا از ← و → استفاده کنید. از ماشین‌ها دوری کنید." },
    draw: { label: "باز کردن دیوار طراحی", title: "نشان شما", instruction: "روی دیوار بکشید و با پایان، نشانتان را باقی بگذارید." },
  },
  photo: { ready: "ثبت یک لحظه.", capture: "نمایش تحویل", captured: "روی گوشی شما.", delivery: "مستقیم روی گوشی شما.", example: "نمایش خدمات · تصویر نمونه" },
  touch: {
    instruction: "یک قطعه را روی دیگری بکشید یا دو قطعه را لمس کنید تا جابه‌جا شوند.",
    complete: "ماندگار همهٔ بخش‌ها را به یک تجربهٔ پیوسته تبدیل می‌کند.",
    keyboard: "با کلیدهای جهت میان قطعه‌ها حرکت کنید. با Enter یا فاصله دو قطعه را برای جابه‌جایی انتخاب کنید. جهت‌ها مطابق تصویر هستند.",
    tile: "قطعه {piece}، ردیف {row}، ستون {column}",
    moves: "{count} جابه‌جایی",
  },
  stage: { beam: "پرتو", finale: "نورپردازی شما آماده است", play: "پخش نمایش شما", showing: "نمایش شما در حال پخش است", ready: "نورهای دلخواه را برای ترکیب خود انتخاب کنید" },
  game: {
    distance: "مسافت",
    crashed: "پایان مسابقه",
    action: "شروع بازی",
    serve: "رها کردن توپ",
    pause: "مکث",
    resume: "ادامه بازی",
    finish: "پایان دور",
    left: "فرمان به چپ",
    right: "فرمان به راست",
    lives: "فرصت‌ها",
    time: "زمان",
    remaining: "نورهای پاک‌شده",
    keyboard: "مسابقه ماشین. با کلیدهای چپ و راست فرمان دهید. با فاصله مکث یا ادامه دهید. تصادف مسابقه را تمام می‌کند. برای خروج اسکرول کنید یا Escape را بزنید.",
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
  scrollContinue: "واصل التمرير للتخطي",
  scrollNext: "مرّر لمتابعة الرحلة",
  continue: "متابعة الرحلة",
  replay: "إعادة",
  finish: "إنهاء",
  reset: "إعادة ضبط",
  clear: "مسح",
  undo: "تراجع",
  stations: {
    photo: { label: "شاهد تسليم صور الفعالية", title: "تسليم الصور فورًا", instruction: "شاهد اللحظة تصل إلى هاتفك." },
    touch: { label: "افتح أحجية الصورة", title: "أحجية الصورة", instruction: "بدّل قطعتين لتكتمل الصورة." },
    stage: { label: "شاهد عرض الإضاءة", title: "الضوء يمنح المكان حياة", instruction: "شاهد كيف يمنح الضوء المكان حياة." },
    game: { label: "العب سباق السيارات", title: "سباق السيارات", instruction: "اسحب للتوجيه أو استخدم ← و →. تجنّب السيارات." },
    draw: { label: "فتح جدار الرسم", title: "اترك بصمتك", instruction: "ارسم على الجدار ثم أنهِ الرسم لتبقى بصمتك." },
  },
  photo: { ready: "التقط اللحظة.", capture: "شاهد التسليم", captured: "على هاتفك.", delivery: "مباشرةً إلى هاتفك.", example: "عرض تجريبي · صورة نموذجية" },
  touch: {
    instruction: "اسحب قطعة فوق أخرى أو المس قطعتين لتبديلهما.",
    complete: "تجمع ماندگار كل الأجزاء في تجربة واحدة مترابطة.",
    keyboard: "استخدم الأسهم للتنقل بين القطع. اضغط Enter أو المسافة لاختيار قطعتين وتبديلهما. تتبع الاتجاهات ترتيب الصورة.",
    tile: "القطعة {piece}، الصف {row}، العمود {column}",
    moves: "{count} تبديلات",
  },
  stage: { beam: "شعاع", finale: "إضاءتك جاهزة", play: "شغّل عرضك", showing: "عرضك قيد التشغيل", ready: "اختر الأضواء لتشكّل أجواءك" },
  game: {
    distance: "المسافة",
    crashed: "انتهى السباق",
    action: "ابدأ اللعب",
    serve: "أطلق الكرة",
    pause: "إيقاف مؤقت",
    resume: "متابعة",
    finish: "إنهاء الجولة",
    left: "التوجيه إلى اليسار",
    right: "التوجيه إلى اليمين",
    lives: "المحاولات",
    time: "الوقت",
    remaining: "الأضواء المُزالة",
    keyboard: "سباق السيارات. استخدم سهمي اليسار واليمين للتوجيه والمسافة للتوقف أو الاستئناف. ينهي الاصطدام السباق. مرّر أو اضغط Escape للخروج.",
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
