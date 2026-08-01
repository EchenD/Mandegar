import { notFound } from "next/navigation";
import { MediaPlaceholder } from "@/components/media/MediaPlaceholder";
import { getText, projects } from "@/lib/content";
import { getProject } from "@/lib/content-source";
import { getUi, localizedPath, type Locale } from "@/lib/i18n";
import Link from "next/link";

export function generateStaticParams() {
  return projects.flatMap((project) => ["fa", "en", "ar"].map((locale) => ({ locale, slug: project.slug })));
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ locale: Locale; slug: string }> }) {
  const { locale, slug } = await params;
  const project = await getProject(locale, slug);
  if (!project) notFound();
  const ui = getUi(locale);
  return <div className="projectDetail"><section className="detailHero"><div className="pageWidth"><Link className="backLink" href={localizedPath(locale, "projects")}>← {ui.backToProjects}</Link><div className="detailMeta"><span>{getText(project.category, locale)}</span><span>{project.year}</span><span>{getText(project.location, locale)}</span></div><h1>{getText(project.title, locale)}</h1><p>{getText(project.summary, locale)}</p><div className="detailHeroMedia"><MediaPlaceholder media={project.media} locale={locale} priority /></div></div></section><section className="detailBody"><div className="pageWidth detailBodyGrid"><aside className="detailLabels"><span>{getText(project.category, locale)}</span><span>{locale === "fa" ? "نقش مندگار" : locale === "ar" ? "دور مندگار" : "Mandegar role"}</span><span>{getText(project.location, locale)}</span></aside><div className="detailContent"><h2>{locale === "fa" ? "چالش" : locale === "ar" ? "التحدي" : "Challenge"}</h2><p>{getText(project.challenge, locale)}</p><h2>{locale === "fa" ? "رویکرد" : locale === "ar" ? "النهج" : "Approach"}</h2><p>{getText(project.approach, locale)}</p><h2>{locale === "fa" ? "دامنه کار" : locale === "ar" ? "النطاق" : "Scope"}</h2><p>{getText(project.scope, locale)}</p><h2>{locale === "fa" ? "نتیجه" : locale === "ar" ? "النتيجة" : "Outcome"}</h2><p>{getText(project.outcome, locale)}</p><div className="detailGallery">{project.gallery.map((media, index) => <MediaPlaceholder key={`${project.slug}-${index}`} media={media} locale={locale} />)}</div></div></div></section></div>;
}
