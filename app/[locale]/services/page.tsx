import { ServiceCard } from "@/components/projects/ServiceCard";
import { getServices } from "@/lib/content-source";
import type { Locale } from "@/lib/i18n";

export default async function ServicesPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const services = await getServices(locale);
  const text = {
    fa: { kicker: "سیستم تولید", title: "هر لایه‌ای که تجربه را کامل می‌کند.", body: "خدمات مندگار از ایده و طراحی تا محتوا، فناوری، اجرا و پشتیبانی را در یک سیستم واحد جمع می‌کند." },
    en: { kicker: "Production system", title: "Every layer that completes an experience.", body: "Mandegar brings idea, design, content, technology, delivery and support into one connected system." },
    ar: { kicker: "نظام الإنتاج", title: "كل طبقة تكمل التجربة.", body: "تجمع مندگار الفكرة والتصميم والمحتوى والتقنية والتنفيذ والدعم في نظام واحد متصل." },
  }[locale];
  return <div className="servicesPage"><section className="pageHero"><div className="pageWidth"><div className="sectionKicker">01 / {text.kicker}</div><h1>{text.title}</h1><p>{text.body}</p></div></section><section className="sectionPad"><div className="pageWidth serviceList">{services.map((service) => <ServiceCard key={service.slug} service={service} locale={locale} />)}</div></section></div>;
}
