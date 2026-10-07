import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MediaPlaceholder } from "@/components/media/MediaPlaceholder";
import { JsonLd } from "@/components/seo/JsonLd";
import { getText } from "@/lib/content";
import { getService, getServices } from "@/lib/content-source";
import { getUi, locales, localizedPath, type Locale } from "@/lib/i18n";
import { absoluteUrl, buildMetadata } from "@/lib/seo";

export async function generateStaticParams() {
  const params = await Promise.all(locales.map(async (locale) => {
    const services = await getServices(locale, { publishedOnly: true });
    return services.map((service) => ({ locale, slug: service.slug }));
  }));
  return params.flat();
}

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const service = await getService(locale, slug);
  if (!service) return {};
  return buildMetadata({ locale, title: getText(service.title, locale), description: getText(service.summary, locale), path: `services/${slug}` });
}

export default async function ServiceDetailPage({ params }: { params: Promise<{ locale: Locale; slug: string }> }) {
  const { locale, slug } = await params;
  const service = await getService(locale, slug);
  if (!service) notFound();
  const ui = getUi(locale);
  const title = getText(service.title, locale);
  const summary = getText(service.summary, locale);
  const back = locale === "fa" ? "بازگشت به خدمات" : locale === "ar" ? "العودة إلى الخدمات" : "Back to services";
  const capabilities = locale === "fa" ? "قابلیت‌ها" : locale === "ar" ? "القدرات" : "Capabilities";
  const current = locale === "fa" ? "فعال" : locale === "ar" ? "متاح" : "Current";

  return (
    <div className="serviceDetail">
      <JsonLd data={[
        {
          "@context": "https://schema.org",
          "@type": "Service",
          name: title,
          description: summary,
          url: absoluteUrl(`/${locale}/services/${slug}`),
          provider: { "@type": "Organization", name: "Mandegar", url: absoluteUrl(`/${locale}`) },
          areaServed: "Iran",
          inLanguage: locale,
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: ui.navigation.services, item: absoluteUrl(`/${locale}/services`) },
            { "@type": "ListItem", position: 2, name: title, item: absoluteUrl(`/${locale}/services/${slug}`) },
          ],
        },
      ]} />
      <section className="detailHero">
        <div className="pageWidth">
          <Link prefetch={false} className="backLink" href={localizedPath(locale, "services")}>← {back}</Link>
          {service.status === "emerging" ? <span className="emergingNotice">{ui.emerging}</span> : null}
          <div className="detailMeta"><span>{service.number}</span><span>{service.status === "emerging" ? ui.emerging : current}</span></div>
          <h1>{title}</h1>
          <p>{summary}</p>
          <div className="detailHeroMedia"><MediaPlaceholder media={service.media} locale={locale} priority /></div>
        </div>
      </section>
      <section className="detailBody">
        <div className="pageWidth detailBodyGrid">
          <aside className="detailLabels"><span>{service.number}</span><span>{capabilities}</span></aside>
          <div className="detailContent">
            <p>{getText(service.detail, locale)}</p>
            <div className="serviceDetailCapabilities">{service.capabilities.map((capability) => <div className="capabilityCard" key={getText(capability, locale)}>{getText(capability, locale)}</div>)}</div>
          </div>
        </div>
      </section>
    </div>
  );
}
