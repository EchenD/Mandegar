import type { Metadata } from "next";
import { ServiceCard } from "@/components/projects/ServiceCard";
import { getText } from "@/lib/content";
import { getEditorialPage, getServices } from "@/lib/content-source";
import type { Locale } from "@/lib/i18n";
import { buildMetadata, pageSeo } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const editorial = await getEditorialPage(locale, "services");
  const [fallbackTitle, fallbackDescription] = pageSeo[locale].services;
  const title = editorial?.seo ? getText(editorial.seo.title, locale) || fallbackTitle : fallbackTitle;
  const description = editorial?.seo ? getText(editorial.seo.description, locale) || fallbackDescription : fallbackDescription;
  return buildMetadata({ locale, title, description, path: "services" });
}

export default async function ServicesPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const [services, editorial] = await Promise.all([getServices(locale), getEditorialPage(locale, "services")]);
  const text = {
    fa: { kicker: "سیستم تولید", title: "هر لایه‌ای که تجربه را کامل می‌کند.", body: "خدمات مندگار از ایده و طراحی تا محتوا، فناوری، اجرا و پشتیبانی را در یک سیستم واحد جمع می‌کند." },
    en: { kicker: "Production system", title: "Every layer that completes an experience.", body: "Mandegar brings idea, design, content, technology, delivery and support into one connected system." },
    ar: { kicker: "نظام الإنتاج", title: "كل طبقة تكمل التجربة.", body: "تجمع مندگار الفكرة والتصميم والمحتوى والتقنية والتنفيذ والدعم في نظام واحد متصل." },
  }[locale];
  if (editorial) {
    text.kicker = getText(editorial.heroKicker, locale) || text.kicker;
    text.title = getText(editorial.title, locale) || text.title;
    text.body = getText(editorial.intro, locale) || text.body;
  }
  return <div className="servicesPage"><section className="pageHero"><div className="pageWidth"><div className="sectionKicker">01 / {text.kicker}</div><h1>{text.title}</h1><p>{text.body}</p></div></section><section className="sectionPad"><div className="pageWidth serviceList">{services.map((service) => <ServiceCard key={service.slug} service={service} locale={locale} />)}</div></section></div>;
}
