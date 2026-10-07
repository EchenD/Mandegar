import type { Metadata } from "next";
import { PageCta } from "@/components/editorial/PageCta";
import { PageIntro } from "@/components/editorial/PageIntro";
import { ServiceCard } from "@/components/projects/ServiceCard";
import styles from "@/components/projects/Portfolio.module.css";
import { getText } from "@/lib/content";
import { getEditorialPage, getPageCopy, getServices } from "@/lib/content-source";
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
  const copy = getPageCopy(locale);

  return (
    <div className={`servicesPage ${styles.portfolioPage}`}>
      <PageIntro locale={locale} number="02" eyebrow={text.kicker} title={text.title} intro={text.body} aside={<div className={styles.introAside}><span className={styles.asideMark} aria-hidden="true" /><h2>{copy.serviceArchiveAsideTitle}</h2><p>{copy.serviceArchiveAsideBody}</p></div>} />
      <section className={styles.archiveSection} aria-label={text.kicker}>
        <div className={`pageWidth serviceList ${styles.serviceGrid}`}>{services.map((service, index) => <ServiceCard key={service.slug} service={service} locale={locale} variant="archive" priority={index === 0} viewLabel={copy.viewService} emergingLabel={copy.emergingLabel} />)}</div>
      </section>
      <PageCta locale={locale} title={copy.serviceCtaTitle} body={copy.serviceCtaBody} primaryLabel={copy.startProject} secondaryLabel={copy.viewProjects} secondaryHref={`/${locale}/projects`} />
    </div>
  );
}
