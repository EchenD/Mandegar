import Link from "next/link";
import { getText, type Project } from "@/lib/content";
import { getUi, localizedPath, type Locale } from "@/lib/i18n";
import { MediaPlaceholder } from "@/components/media/MediaPlaceholder";

export function ProjectCard({ project, locale, featured = false }: { project: Project; locale: Locale; featured?: boolean }) {
  const ui = getUi(locale);
  return (
    <article className={`projectCard ${featured ? "projectCardFeatured" : ""}`}>
      <Link href={localizedPath(locale, `projects/${project.slug}`)} className="projectCardLink">
        <MediaPlaceholder media={project.media} locale={locale} className="projectMedia" />
        <div className="projectCardBody">
          <div className="projectCardMeta"><span>{getText(project.category, locale)}</span><span>{project.year}</span></div>
          <h3>{getText(project.title, locale)}</h3>
          <p>{getText(project.summary, locale)}</p>
          <span className="textLink">{ui.viewProject}<span aria-hidden="true">↗</span></span>
        </div>
      </Link>
    </article>
  );
}
