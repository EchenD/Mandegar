import type { Metadata } from "next";
import { ProjectFilters } from "@/components/projects/ProjectFilters";
import { getText } from "@/lib/content";
import { getEditorialPage, getProjects } from "@/lib/content-source";
import type { Locale } from "@/lib/i18n";
import { buildMetadata, pageSeo } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const editorial = await getEditorialPage(locale, "projects");
  const [fallbackTitle, fallbackDescription] = pageSeo[locale].projects;
  const title = editorial?.seo ? getText(editorial.seo.title, locale) || fallbackTitle : fallbackTitle;
  const description = editorial?.seo ? getText(editorial.seo.description, locale) || fallbackDescription : fallbackDescription;
  return buildMetadata({ locale, title, description, path: "projects" });
}

export default async function ProjectsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const [projects, editorial] = await Promise.all([getProjects(locale), getEditorialPage(locale, "projects")]);
  const text = {
    fa: { kicker: "آرشیو پروژه‌ها", title: "ایده‌ها وقتی واقعی می‌شوند، ماندگارترند.", body: "ایده‌هایی برای فضا، رویداد و مشارکت را ببینید. نمونه‌های مفهومی با برچسب روشن مشخص شده‌اند." },
    en: { kicker: "Project archive", title: "Ideas last longer when they become real.", body: "Explore ideas for spaces, events and participation. Concept studies are clearly labelled." },
    ar: { kicker: "أرشيف المشاريع", title: "تبقى الأفكار أطول عندما تصبح حقيقية.", body: "استكشف أفكاراً للمساحات والفعاليات والمشاركة. النماذج المفاهيمية موسومة بوضوح." },
  }[locale];
  if (editorial) {
    text.kicker = getText(editorial.heroKicker, locale) || text.kicker;
    text.title = getText(editorial.title, locale) || text.title;
    text.body = getText(editorial.intro, locale) || text.body;
  }

  return <div className="projectsPage"><section className="pageHero"><div className="pageWidth" data-reveal><div className="sectionKicker">01 / {text.kicker}</div><h1>{text.title}</h1><p>{text.body}</p></div></section><section className="sectionPad"><div className="pageWidth"><ProjectFilters projects={projects} locale={locale} /></div></section></div>;
}
