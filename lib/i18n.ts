export const locales = ["fa", "en", "ar"] as const;
export type Locale = (typeof locales)[number];

export const localeConfig: Record<Locale, { dir: "rtl" | "ltr"; label: string; nativeLabel: string }> = {
  fa: { dir: "rtl", label: "Persian", nativeLabel: "فارسی" },
  en: { dir: "ltr", label: "English", nativeLabel: "English" },
  ar: { dir: "rtl", label: "Arabic", nativeLabel: "العربية" },
};

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function ensureLocale(value: string): Locale {
  return isLocale(value) ? value : "fa";
}

export function localizedPath(locale: Locale, path = "") {
  return `/${locale}${path ? `/${path.replace(/^\//, "")}` : ""}`;
}

export const ui = {
  fa: {
    navigation: { projects: "پروژه‌ها", services: "خدمات", about: "درباره ما", contact: "تماس" },
    start: "شروع یک پروژه",
    explore: "تجربه را کشف کنید",
    viewProject: "دیدن پروژه",
    viewAll: "مشاهده همه",
    selectedWork: "منتخب کارها",
    placeholder: "تصویر موقت — جایگزین با رسانه واقعی",
    scroll: "برای کشف کردن اسکرول کنید",
    menu: "منو",
    close: "بستن",
    availableSoon: "این نسخه در CMS آماده و قابل جایگزینی است.",
    all: "همه",
    sendMessage: "ارسال پیام",
    callSales: "تماس با فروش",
    whatsapp: "پیام در واتساپ",
    readMore: "ادامه مطلب",
    backToProjects: "بازگشت به پروژه‌ها",
    emerging: "قابلیت در حال توسعه",
    noContact: "اطلاعات تماس پس از اتصال CMS اینجا قرار می‌گیرد.",
    footer: "از اولین ایده تا آخرین اثر.",
  },
  en: {
    navigation: { projects: "Projects", services: "Services", about: "About", contact: "Contact" },
    start: "Start a project",
    explore: "Explore the experience",
    viewProject: "View project",
    viewAll: "View all",
    selectedWork: "Selected work",
    placeholder: "Temporary image — replace with real media",
    scroll: "Scroll to discover",
    menu: "Menu",
    close: "Close",
    availableSoon: "This version is CMS-ready and replaceable.",
    all: "All",
    sendMessage: "Send a message",
    callSales: "Call sales",
    whatsapp: "Message on WhatsApp",
    readMore: "Read more",
    backToProjects: "Back to projects",
    emerging: "Emerging capability",
    noContact: "Contact details will appear here after CMS connection.",
    footer: "From the first idea to the lasting impact.",
  },
  ar: {
    navigation: { projects: "المشاريع", services: "الخدمات", about: "من نحن", contact: "تواصل" },
    start: "ابدأ مشروعاً",
    explore: "اكتشف التجربة",
    viewProject: "عرض المشروع",
    viewAll: "عرض الكل",
    selectedWork: "أعمال مختارة",
    placeholder: "صورة مؤقتة — استبدلها بوسائط حقيقية",
    scroll: "مرّر للاكتشاف",
    menu: "القائمة",
    close: "إغلاق",
    availableSoon: "هذه النسخة جاهزة لإدارة CMS وقابلة للاستبدال.",
    all: "الكل",
    sendMessage: "إرسال رسالة",
    callSales: "التواصل مع المبيعات",
    whatsapp: "رسالة عبر واتساب",
    readMore: "قراءة المزيد",
    backToProjects: "العودة إلى المشاريع",
    emerging: "قدرة قيد التطوير",
    noContact: "ستظهر بيانات التواصل بعد ربط CMS.",
    footer: "من الفكرة الأولى إلى الأثر الباقي.",
  },
} as const;

export function getUi(locale: Locale) {
  return ui[locale];
}
