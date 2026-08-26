import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MediaPlaceholder } from "@/components/media/MediaPlaceholder";
import { JsonLd } from "@/components/seo/JsonLd";
import { getText, projects } from "@/lib/content";
import { getProject } from "@/lib/content-source";
import { getUi, localizedPath, type Locale } from "@/lib/i18n";
import { absoluteUrl, buildMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return projects.flatMap((project) => ["fa", "en", "ar"].map((locale) => ({ locale, slug: project.slug })));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const project = await getProject(locale, slug);
  if (!project) return {};
  const title = getText(project.title, locale);
  const description = getText(project.summary, locale);
  const metadata = buildMetadata({ locale, title, description, path: `projects/${slug}` });
  return {
    ...metadata,
    openGraph: {
      ...metadata.openGraph,
      type: "article",
      images: [{ url: absoluteUrl(project.media.poster || project.media.src), alt: getText(project.media.alt, locale) }],
    },
  };
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ locale: Locale; slug: string }> }) {
  const { locale, slug } = await params;
  const project = await getProject(locale, slug);
  if (!project) notFound();
  const ui = getUi(locale);
  const title = getText(project.title, locale);
  const summary = getText(project.summary, locale);
  const categories = (project.categories || [project.category]).map((category) => getText(category, locale));
  const serviceLabels = project.services.map((service) => getText(service, locale)).filter(Boolean);
  const labels = {
    challenge: locale === "fa" ? "چالش" : locale === "ar" ? "التحدي" : "Challenge",
    approach: locale === "fa" ? "رویکرد" : locale === "ar" ? "النهج" : "Approach",
    scope: locale === "fa" ? "دامنه کار" : locale === "ar" ? "النطاق" : "Scope",
    outcome: locale === "fa" ? "نتیجه" : locale === "ar" ? "النتيجة" : "Outcome",
    services: locale === "fa" ? "خدمات ارائه‌شده" : locale === "ar" ? "الخدمات المقدمة" : "Services provided",
    credits: locale === "fa" ? "عوامل و همکاران" : locale === "ar" ? "الفريق والشركاء" : "Credits and collaborators",
    related: locale === "fa" ? "پروژه‌های مرتبط" : locale === "ar" ? "مشاريع ذات صلة" : "Related projects",
  };

  return (
    <div className="projectDetail">
      <JsonLd data={[
        {
          "@context": "https://schema.org",
          "@type": "CreativeWork",
          name: title,
          description: summary,
          url: absoluteUrl(`/${locale}/projects/${slug}`),
          image: absoluteUrl(project.media.poster || project.media.src),
          inLanguage: locale,
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: ui.navigation.projects, item: absoluteUrl(`/${locale}/projects`) },
            { "@type": "ListItem", position: 2, name: title, item: absoluteUrl(`/${locale}/projects/${slug}`) },
          ],
        },
      ]} />
      <section className="detailHero">
        <div className="pageWidth">
          <Link prefetch={false} className="backLink" href={localizedPath(locale, "projects")}>← {ui.backToProjects}</Link>
          <div className="detailMeta"><span>{categories.join(" · ")}</span><span>{project.year}</span><span>{getText(project.location, locale)}</span></div>
          <h1>{title}</h1>
          <p>{summary}</p>
          <div className="detailHeroMedia"><MediaPlaceholder media={project.media} locale={locale} priority /></div>
        </div>
      </section>
      <section className="detailBody">
        <div className="pageWidth detailBodyGrid">
          <aside className="detailLabels">
            <span>{categories.join(" · ")}</span>
            <span>{serviceLabels.join(" · ") || (locale === "fa" ? "نقش مندگار" : locale === "ar" ? "دور مندگار" : "Mandegar role")}</span>
            <span>{getText(project.location, locale)}</span>
          </aside>
          <div className="detailContent">
            <h2>{labels.challenge}</h2><p>{getText(project.challenge, locale)}</p>
            <h2>{labels.approach}</h2><p>{getText(project.approach, locale)}</p>
            <h2>{labels.scope}</h2><p>{getText(project.scope, locale)}</p>
            {serviceLabels.length ? <><h2>{labels.services}</h2><div className="detailTags">{serviceLabels.map((service) => <span key={service}>{service}</span>)}</div></> : null}
            <h2>{labels.outcome}</h2><p>{getText(project.outcome, locale)}</p>
            {project.credits && getText(project.credits, locale) ? <><h2>{labels.credits}</h2><p>{getText(project.credits, locale)}</p></> : null}
            <div className="detailGallery">{project.gallery.map((media, index) => <MediaPlaceholder key={`${project.slug}-${index}`} media={media} locale={locale} />)}</div>
          </div>
        </div>
      </section>
      {project.relatedProjects?.length ? <section className="sectionPad relatedSection"><div className="pageWidth"><div className="sectionKicker">{labels.related}</div><div className="relatedGrid">{project.relatedProjects.map((related) => <Link prefetch={false} key={related.slug} href={localizedPath(locale, `projects/${related.slug}`)} data-analytics="related_project_view" data-analytics-label={related.slug}><MediaPlaceholder media={related.media} locale={locale} /><div><span>{getText(related.category, locale)} · {related.year}</span><h2>{getText(related.title, locale)}</h2><p>{getText(related.summary, locale)}</p></div></Link>)}</div></div></section> : null}
    </div>
  );
}
