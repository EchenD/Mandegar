import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "@fontsource-variable/vazirmatn";
import "@/styles/globals.css";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { AnalyticsBridge } from "@/components/analytics/AnalyticsBridge";
import { JsonLd } from "@/components/seo/JsonLd";
import { getSiteSettings } from "@/lib/content-source";
import { ensureLocale, localeConfig, locales, type Locale } from "@/lib/i18n";
import { absoluteUrl, buildMetadata, pageSeo } from "@/lib/seo";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = ensureLocale(rawLocale);
  if (rawLocale !== locale) return {};
  const [title, description] = pageSeo[locale].home;
  return buildMetadata({ locale, title, description });
}

export default async function LocaleLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale: rawLocale } = await params;
  if (!locales.includes(rawLocale as Locale)) notFound();
  const locale = rawLocale as Locale;
  const config = localeConfig[locale];
  const settings = await getSiteSettings();
  const homeScrollResetScript = `(() => {
    const path = location.pathname.replace(/\\/+$/, "") || "/";
    if (path !== "/${locale}") return;
    const root = document.documentElement;
    root.dataset.mandegarPreviousScrollRestoration = history.scrollRestoration;
    history.scrollRestoration = "manual";
    root.setAttribute("data-experience-scroll-lock", "");
    const previousBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    scrollTo(0, 0);
    root.style.scrollBehavior = previousBehavior;
  })();`;
  return (
    <html lang={locale} dir={config.dir} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: homeScrollResetScript }} />
      </head>
      <body>
        <div className="siteShell" lang={locale} dir={config.dir} data-locale={locale}>
          <JsonLd data={[
            { "@context": "https://schema.org", "@type": "Organization", name: "Mandegar", url: absoluteUrl(`/${locale}`), areaServed: "Iran" },
            { "@context": "https://schema.org", "@type": "WebSite", name: "Mandegar", url: absoluteUrl(`/${locale}`), inLanguage: locale },
          ]} />
          <AnalyticsBridge locale={locale} />
          <a className="skipLink" href="#main-content">{locale === "fa" ? "رفتن به محتوای اصلی" : locale === "ar" ? "انتقل إلى المحتوى الرئيسي" : "Skip to main content"}</a>
          <Header locale={locale} settings={settings} />
          <main id="main-content">{children}</main>
          <Footer locale={locale} settings={settings} />
        </div>
      </body>
    </html>
  );
}
