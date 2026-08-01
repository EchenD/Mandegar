import type { Metadata } from "next";
import { locales, type Locale } from "@/lib/i18n";

export const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000");

const openGraphLocale: Record<Locale, string> = {
  fa: "fa_IR",
  en: "en_US",
  ar: "ar_AE",
};

export const pageSeo = {
  fa: {
    home: ["تجربه‌ای که می‌ماند", "مندگار رویدادها، نمایشگاه‌ها و تجربه‌های تعاملی را از نخستین ایده تا اجرای نهایی طراحی و تولید می‌کند."],
    projects: ["پروژه‌ها", "آرشیو پروژه‌ها و تجربه‌های رویدادی، نمایشگاهی و تعاملی مندگار."],
    services: ["خدمات", "طراحی و تولید کامل رویداد، نمایشگاه، محتوای تعاملی و اجرای فنی."],
    about: ["درباره مندگار", "رویکرد، فلسفه تولید و مدل همکاری محلی و بین‌المللی مندگار."],
    contact: ["تماس", "برای شروع یک پروژه رویدادی یا نمایشگاهی با تیم مندگار گفتگو کنید."],
    legal: ["حریم خصوصی و شرایط", "اطلاعات حریم خصوصی، کوکی‌ها، شرایط استفاده و حقوق رسانه‌ای وب‌سایت مندگار."],
  },
  en: {
    home: ["Experiences that stay", "Mandegar designs and delivers events, exhibitions and interactive experiences from the first idea to final production."],
    projects: ["Projects", "Mandegar’s archive of event, exhibition and interactive experience work."],
    services: ["Services", "Complete event production, exhibitions, interaction, content and technical delivery."],
    about: ["About", "Mandegar’s approach, production philosophy and local-to-global collaboration model."],
    contact: ["Contact", "Start a conversation with Mandegar about an event, exhibition or experience project."],
    legal: ["Privacy and terms", "Privacy, cookies, terms of use and media rights information for the Mandegar website."],
  },
  ar: {
    home: ["تجارب تبقى", "تصمم مندگار الفعاليات والمعارض والتجارب التفاعلية وتنفذها من الفكرة الأولى حتى الإنتاج النهائي."],
    projects: ["المشاريع", "أرشيف مندگار لمشاريع الفعاليات والمعارض والتجارب التفاعلية."],
    services: ["الخدمات", "إنتاج متكامل للفعاليات والمعارض والتفاعل والمحتوى والتنفيذ التقني."],
    about: ["عن مندگار", "نهج مندگار وفلسفة الإنتاج ونموذج التعاون المحلي والدولي."],
    contact: ["تواصل", "ابدأ حواراً مع مندگار حول مشروع فعالية أو معرض أو تجربة."],
    legal: ["الخصوصية والشروط", "معلومات الخصوصية وملفات الارتباط وشروط الاستخدام وحقوق الوسائط لموقع مندگار."],
  },
} satisfies Record<Locale, Record<string, readonly [string, string]>>;

export function absoluteUrl(path: string) {
  return new URL(path, siteUrl).toString();
}

export function buildMetadata({ locale, title, description, path = "" }: { locale: Locale; title: string; description: string; path?: string }): Metadata {
  const localizedPath = path ? `/${locale}/${path}` : `/${locale}`;
  const languages = Object.fromEntries(locales.map((item) => [item, path ? `/${item}/${path}` : `/${item}`]));
  return {
    metadataBase: siteUrl,
    title,
    description,
    alternates: { canonical: localizedPath, languages: { ...languages, "x-default": path ? `/fa/${path}` : "/fa" } },
    openGraph: {
      type: "website",
      url: localizedPath,
      siteName: "Mandegar",
      title,
      description,
      locale: openGraphLocale[locale],
      alternateLocale: locales.filter((item) => item !== locale).map((item) => openGraphLocale[item]),
    },
    twitter: { card: "summary_large_image", title, description },
  };
}
