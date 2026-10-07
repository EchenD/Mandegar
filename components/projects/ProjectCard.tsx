import Link from "next/link";
import type { Project } from "@/lib/content";
import { getText } from "@/lib/localized-text";
import { getUi, localizedPath, type Locale } from "@/lib/i18n";
import { MediaPlaceholder } from "@/components/media/MediaPlaceholder";
import styles from "./Portfolio.module.css";

export function ProjectCard({ project, locale, featured = false, variant = "default", headingLevel = 3, priority = false, labels }: {
  project: Project;
  locale: Locale;
  featured?: boolean;
  variant?: "default" | "archive";
  headingLevel?: 2 | 3;
  priority?: boolean;
  labels?: { conceptLabel: string; viewProject: string };
}) {
  const ui = getUi(locale);
  const categories = (project.categories || [project.category]).map((category) => getText(category, locale)).join(" · ");
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const preview = project.media.kind === "video" ? { ...project.media, kind: "image" as const, src: project.media.poster || project.media.src, mobileSrc: undefined } : project.media;
  if (variant === "default") {
    return (
      <article className={`projectCard ${featured ? "projectCardFeatured" : ""}`}>
        <Link prefetch={false} href={localizedPath(locale, `projects/${project.slug}`)} className="projectCardLink" data-analytics="project_view" data-analytics-label={project.slug}>
          <MediaPlaceholder media={preview} locale={locale} className="projectMedia" />
          <div className="projectCardBody">
            <div className="projectCardMeta"><span>{categories}</span><span>{project.year}</span><span>{getText(project.location, locale)}</span></div>
            <Heading>{getText(project.title, locale)}</Heading>
            <p>{getText(project.summary, locale)}</p>
            <span className="textLink">{labels?.viewProject || ui.viewProject}<span aria-hidden="true">↗</span></span>
          </div>
        </Link>
      </article>
    );
  }
  return (
    <article className={`projectCard ${styles.projectCard}`}>
      <Link prefetch={false} href={localizedPath(locale, `projects/${project.slug}`)} className={`projectCardLink ${styles.projectLink}`} data-analytics="project_view" data-analytics-label={project.slug}>
        <div className={styles.cardMedia}>
          <MediaPlaceholder media={preview} locale={locale} className="projectMedia" priority={priority} />
          {project.isPlaceholder && labels ? <span className={styles.conceptBadge}>{labels.conceptLabel}</span> : null}
        </div>
        <div className={`projectCardBody ${styles.cardBody}`}>
          <div className={`projectCardMeta ${styles.cardMeta}`}><span>{categories}</span>{project.isPlaceholder ? null : <span>{project.year}</span>}</div>
          <Heading>{getText(project.title, locale)}</Heading>
          <p>{getText(project.summary, locale)}</p>
          <span className="textLink">{labels?.viewProject || ui.viewProject}<span aria-hidden="true">↗</span></span>
        </div>
      </Link>
    </article>
  );
}
