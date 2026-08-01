import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { LocaleDocument } from "@/components/layout/LocaleDocument";
import { ensureLocale, localeConfig, locales, type Locale } from "@/lib/i18n";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = ensureLocale(rawLocale);
  if (rawLocale !== locale) return {};
  const titles = {
    fa: "مندگار — تجربه‌ای که می‌ماند",
    en: "Mandegar — Experiences that stay",
    ar: "مندگار — تجارب تبقى",
  };
  return { title: titles[locale], alternates: { languages: { fa: "/fa", en: "/en", ar: "/ar" } } };
}

export default async function LocaleLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale: rawLocale } = await params;
  if (!locales.includes(rawLocale as Locale)) notFound();
  const locale = rawLocale as Locale;
  const config = localeConfig[locale];
  return (
    <div className="siteShell" lang={locale} dir={config.dir} data-locale={locale}>
      <LocaleDocument locale={locale} />
      <a className="skipLink" href="#main-content">{locale === "fa" ? "رفتن به محتوای اصلی" : locale === "ar" ? "انتقل إلى المحتوى الرئيسي" : "Skip to main content"}</a>
      <Header locale={locale} />
      <main id="main-content">{children}</main>
      <Footer locale={locale} />
    </div>
  );
}
