import Link from "next/link";
import { notFound } from "next/navigation";
import { MediaPlaceholder } from "@/components/media/MediaPlaceholder";
import { getText, services } from "@/lib/content";
import { getService } from "@/lib/content-source";
import { getUi, localizedPath, type Locale } from "@/lib/i18n";

export function generateStaticParams() {
  return services.flatMap((service) => ["fa", "en", "ar"].map((locale) => ({ locale, slug: service.slug })));
}

export default async function ServiceDetailPage({ params }: { params: Promise<{ locale: Locale; slug: string }> }) {
  const { locale, slug } = await params;
  const service = await getService(locale, slug);
  if (!service) notFound();
  const ui = getUi(locale);
  return <div className="serviceDetail"><section className="detailHero"><div className="pageWidth"><Link className="backLink" href={localizedPath(locale, "services")}>← {locale === "fa" ? "بازگشت به خدمات" : locale === "ar" ? "العودة إلى الخدمات" : "Back to services"}</Link>{service.status === "emerging" ? <span className="emergingNotice">{ui.emerging}</span> : null}<div className="detailMeta"><span>{service.number}</span><span>{service.status === "emerging" ? ui.emerging : locale === "fa" ? "فعال" : locale === "ar" ? "متاح" : "Current"}</span></div><h1>{getText(service.title, locale)}</h1><p>{getText(service.summary, locale)}</p><div className="detailHeroMedia"><MediaPlaceholder media={service.media} locale={locale} priority /></div></div></section><section className="detailBody"><div className="pageWidth detailBodyGrid"><aside className="detailLabels"><span>{service.number}</span><span>{locale === "fa" ? "قابلیت‌ها" : locale === "ar" ? "القدرات" : "Capabilities"}</span></aside><div className="detailContent"><p>{getText(service.detail, locale)}</p><div className="serviceDetailCapabilities">{service.capabilities.map((capability) => <div className="capabilityCard" key={getText(capability, locale)}>{getText(capability, locale)}</div>)}</div></div></div></section></div>;
}
