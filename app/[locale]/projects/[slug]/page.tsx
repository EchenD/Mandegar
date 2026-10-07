import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/editorial/Breadcrumbs";
import { PageCta } from "@/components/editorial/PageCta";
import { MediaPlaceholder } from "@/components/media/MediaPlaceholder";
import { ProjectCard } from "@/components/projects/ProjectCard";
import styles from "@/components/projects/Portfolio.module.css";
import { JsonLd } from "@/components/seo/JsonLd";
import { getText } from "@/lib/content";
import { getPageCopy, getProject, getProjects, getServices } from "@/lib/content-source";
import { getUi, locales, localizedPath, type Locale } from "@/lib/i18n";
import { absoluteUrl, buildMetadata } from "@/lib/seo";

export async function generateStaticParams() {
  const params = await Promise.all(locales.map(async (locale) => {
    const projects = await getProjects(locale, { publishedOnly: true });
    return projects.map((project) => ({ locale, slug: project.slug }));
  }));
  return params.flat();
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
  const [project, projects, services] = await Promise.all([getProject(locale, slug), getProjects(locale), getServices(locale)]);
  if (!project) notFound();
  const ui = getUi(locale);
  const copy = getPageCopy(locale);
  const title = getText(project.title, locale);
  const summary = getText(project.summary, locale);
  const categories = (project.categories || [project.category]).map((category) => getText(category, locale)).filter(Boolean);
  const serviceLabels = project.services.map((service) => getText(service, locale)).filter(Boolean);
  const linkedServices = services.filter((service) => project.serviceSlugs?.includes(service.slug));
  const sections = [
    { id: "challenge", title: copy.challenge, body: getText(project.challenge, locale) },
    { id: "approach", title: copy.approach, body: getText(project.approach, locale) },
    { id: "scope", title: copy.scope, body: getText(project.scope, locale) },
    { id: "outcome", title: copy.outcome, body: getText(project.outcome, locale) },
    ...(project.credits && getText(project.credits, locale) ? [{ id: "credits", title: copy.credits, body: getText(project.credits, locale) }] : []),
  ].filter((section) => section.body);
  const candidates = projects.filter((entry) => entry.slug !== project.slug);
  const specifiedSlugs = project.relatedProjectSlugs || project.relatedProjects?.map((entry) => entry.slug) || [];
  const specified = specifiedSlugs.flatMap((relatedSlug) => candidates.find((entry) => entry.slug === relatedSlug) || []);
  const related = [...specified, ...candidates.filter((entry) => !specifiedSlugs.includes(entry.slug))].slice(0, 2);
  const index = projects.findIndex((entry) => entry.slug === project.slug);
  const previous = index > 0 ? projects[index - 1] : undefined;
  const next = index >= 0 && index < projects.length - 1 ? projects[index + 1] : undefined;

  return (
    <div className={`projectDetail ${styles.portfolioPage}`}>
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
            { "@type": "ListItem", position: 1, name: copy.home, item: absoluteUrl(`/${locale}`) },
            { "@type": "ListItem", position: 2, name: ui.navigation.projects, item: absoluteUrl(`/${locale}/projects`) },
            { "@type": "ListItem", position: 3, name: title, item: absoluteUrl(`/${locale}/projects/${slug}`) },
          ],
        },
      ]} />
      <section className={`detailHero ${styles.detailHero}`}>
        <div className="pageWidth">
          <Breadcrumbs locale={locale} items={[{ label: ui.navigation.projects, href: localizedPath(locale, "projects") }, { label: title }]} />
          <div className={styles.detailHeading}>
            <div>
              <div className={`sectionKicker ${styles.kicker}`}>{getText(project.eyebrow, locale) || categories.join(" / ")}</div>
              <h1>{title}</h1>
              <p className={styles.detailSummary}>{summary}</p>
            </div>
            <div className={styles.projectFacts}>
              {project.isPlaceholder ? <span className={styles.statusBadge}>{copy.conceptLabel}</span> : null}
              <dl>
                <div><dt>{copy.category}</dt><dd>{categories.join(" · ")}</dd></div>
                {project.client && getText(project.client, locale) ? <div><dt>{copy.client}</dt><dd>{getText(project.client, locale)}</dd></div> : null}
                {!project.isPlaceholder ? <div><dt>{copy.year}</dt><dd>{project.year}</dd></div> : null}
                <div><dt>{copy.location}</dt><dd>{getText(project.location, locale)}</dd></div>
              </dl>
            </div>
          </div>
          {project.isPlaceholder ? <p className={styles.conceptNotice}>{copy.conceptNotice}</p> : null}
          <div className={`detailHeroMedia ${styles.heroMedia}`}><MediaPlaceholder media={project.media} locale={locale} sizes="(max-width: 760px) 100vw, calc(100vw - 2.5rem)" priority /></div>
        </div>
      </section>
      <section className={`detailBody ${styles.detailBody}`} aria-label={title}>
        <div className={`pageWidth detailBodyGrid ${styles.detailGrid}`}>
          <aside className={styles.detailAside}>
            <nav className={styles.contentsNav} aria-label={copy.projectContents}>
              <h2>{copy.projectContents}</h2>
              <ol>{sections.map((section, sectionIndex) => <li key={section.id}><a href={`#${section.id}`}><span aria-hidden="true">{new Intl.NumberFormat(locale, { minimumIntegerDigits: 2 }).format(sectionIndex + 1)}</span>{section.title}</a></li>)}{project.gallery.length ? <li><a href="#gallery">{copy.projectGallery}</a></li> : null}</ol>
            </nav>
            {serviceLabels.length ? <div className={styles.roleList}><h2>{copy.services}</h2><ul>{serviceLabels.map((label) => <li key={label}>{label}</li>)}</ul></div> : null}
            {linkedServices.length ? <div className={styles.relatedServiceLinks}>{linkedServices.map((service) => <Link prefetch={false} key={service.slug} href={localizedPath(locale, `services/${service.slug}`)}>{getText(service.title, locale)}<span aria-hidden="true">↗</span></Link>)}</div> : null}
          </aside>
          <div className={styles.caseContent}>
            {sections.map((section, sectionIndex) => <section key={section.id} id={section.id} className={styles.caseSection}><span className={styles.sectionNumber} aria-hidden="true">{new Intl.NumberFormat(locale, { minimumIntegerDigits: 2 }).format(sectionIndex + 1)}</span><h2>{section.title}</h2><p>{section.body}</p></section>)}
          </div>
        </div>
      </section>
      {project.gallery.length ? <section id="gallery" className={styles.gallerySection} aria-labelledby="gallery-title"><div className="pageWidth"><div className={styles.sectionHeading}><h2 id="gallery-title">{copy.projectGallery}</h2><p>{copy.projectGalleryBody}</p></div><div className={`detailGallery ${styles.galleryGrid}`}>{project.gallery.map((media, galleryIndex) => <MediaPlaceholder key={`${project.slug}-${galleryIndex}`} media={media} locale={locale} sizes={galleryIndex === 0 ? "(max-width: 760px) 100vw, calc(100vw - 2.5rem)" : "(max-width: 760px) 100vw, 50vw"} />)}</div></div></section> : null}
      {related.length ? <section className={`relatedSection ${styles.relatedSection}`} aria-labelledby="related-title"><div className="pageWidth"><div className={styles.sectionHeading}><div><span className={styles.kicker}>{copy.projectIndex}</span><h2 id="related-title">{copy.relatedProjects}</h2></div><p>{copy.relatedProjectsBody}</p></div><div className={styles.relatedGrid}>{related.map((entry) => <ProjectCard key={entry.slug} project={entry} locale={locale} variant="archive" labels={copy} />)}</div></div></section> : null}
      <nav className={styles.projectPagination} aria-label={copy.projectIndex}>
        <div className="pageWidth">
          {previous ? <Link prefetch={false} href={localizedPath(locale, `projects/${previous.slug}`)} className={styles.previousProject}><span>{copy.previousProject}</span><strong>{getText(previous.title, locale)}</strong><span aria-hidden="true">←</span></Link> : <span />}
          <Link prefetch={false} href={localizedPath(locale, "projects")} className={styles.indexLink}>{copy.showAllProjects}<span aria-hidden="true">↗</span></Link>
          {next ? <Link prefetch={false} href={localizedPath(locale, `projects/${next.slug}`)} className={styles.nextProject}><span>{copy.nextProject}</span><strong>{getText(next.title, locale)}</strong><span aria-hidden="true">→</span></Link> : <span />}
        </div>
      </nav>
      <PageCta locale={locale} title={copy.projectCtaTitle} body={copy.projectCtaBody} primaryLabel={copy.startProject} secondaryLabel={copy.exploreServices} secondaryHref={localizedPath(locale, "services")} />
    </div>
  );
}
