import type { Locale } from "@/lib/i18n";
import { publicAssetPath } from "@/lib/public-asset-path";

export const servicesCopy = {
  en: { kicker: "Our services", scroll: "Scroll to explore" },
  fa: { kicker: "خدمات ما", scroll: "برای کشف خدمات اسکرول کنید" },
  ar: { kicker: "خدماتنا", scroll: "مرّر لاستكشاف الخدمات" },
} satisfies Record<Locale, { kicker: string; scroll: string }>;

export const serviceChapters = [
  {
    id: "events",
    image: publicAssetPath("/media/services/events.webp"),
    title: { en: "Events", fa: "رویداد", ar: "الفعاليات" },
    description: {
      en: "Planning, design and delivery of events, from the first idea to the final moment.",
      fa: "برنامه‌ریزی، طراحی و اجرای رویداد؛ از ایدهٔ اولیه تا لحظهٔ نهایی.",
      ar: "تخطيط الفعاليات وتصميمها وتنفيذها، من الفكرة الأولى إلى اللحظة الأخيرة.",
    },
  },
  {
    id: "exhibitions",
    image: publicAssetPath("/media/services/exhibitions.webp"),
    title: { en: "Exhibitions", fa: "نمایشگاه", ar: "المعارض" },
    description: {
      en: "Exhibition spaces and stands that bring a brand into a physical experience.",
      fa: "طراحی و ساخت فضاهای نمایشگاهی و غرفه‌هایی که برند را به تجربه‌ای ملموس تبدیل می‌کنند.",
      ar: "مساحات وأجنحة للمعارض تمنح العلامة التجارية تجربة ملموسة.",
    },
  },
  {
    id: "web-apps",
    image: publicAssetPath("/media/services/web-apps.webp"),
    title: { en: "Websites & applications", fa: "وب‌سایت و اپلیکیشن", ar: "المواقع والتطبيقات" },
    description: {
      en: "Design and development of websites and applications around the people who use them.",
      fa: "طراحی و توسعهٔ وب‌سایت و اپلیکیشن، با توجه به تجربهٔ کسانی که از آن‌ها استفاده می‌کنند.",
      ar: "تصميم المواقع والتطبيقات وتطويرها حول تجربة من يستخدمونها.",
    },
  },
  {
    id: "content",
    image: publicAssetPath("/media/services/content.webp"),
    title: { en: "Content creation", fa: "تولید محتوا", ar: "إنتاج المحتوى" },
    description: {
      en: "Visual direction, photography, video and motion that give an idea a clear voice.",
      fa: "طراحی بصری، عکاسی، ویدیو و موشن برای بیان روشن یک ایده.",
      ar: "إخراج بصري وتصوير وفيديو وموشن تمنح الفكرة صوتاً واضحاً.",
    },
  },
  {
    id: "advertising",
    image: publicAssetPath("/media/services/advertising.webp"),
    title: { en: "Advertising structures", fa: "سازه‌های تبلیغاتی", ar: "الهياكل الإعلانية" },
    description: {
      en: "Design and fabrication of advertising displays, signs and structures in physical spaces.",
      fa: "طراحی و ساخت نمایشگرها، تابلوها و سازه‌های تبلیغاتی برای حضور برند در فضا.",
      ar: "تصميم وتصنيع وحدات العرض واللوحات والهياكل الإعلانية في المساحات الفعلية.",
    },
  },
] as const;
