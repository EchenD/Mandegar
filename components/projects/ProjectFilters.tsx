"use client";

import { useMemo, useState } from "react";
import type { Project } from "@/lib/content";
import { getText } from "@/lib/localized-text";
import type { Locale } from "@/lib/i18n";
import { ProjectCard } from "./ProjectCard";
import styles from "./Portfolio.module.css";

type FilterCopy = {
  allCategories: string;
  results: string;
  emptyProjects: string;
  emptyProjectsBody: string;
  clearFilters: string;
  filterProjects: string;
  conceptLabel: string;
  viewProject: string;
};

export function ProjectFilters({ projects, locale, copy }: { projects: Project[]; locale: Locale; copy: FilterCopy }) {
  const categories = useMemo(() => Array.from(new Set(projects.flatMap((project) => (project.categories || [project.category]).map((category) => getText(category, locale))))).filter(Boolean), [locale, projects]);
  const [active, setActive] = useState<string | null>(null);
  const filtered = active === null ? projects : projects.filter((project) => (project.categories || [project.category]).some((category) => getText(category, locale) === active));
  const count = new Intl.NumberFormat(locale).format(filtered.length);

  return (
    <>
      <div className={styles.filterHeading}>
        <div className={`filterBar ${styles.filterBar}`} role="group" aria-label={copy.filterProjects}>
          {[null, ...categories].map((category) => <button type="button" key={category ?? "all"} className={`filterButton ${styles.filterButton} ${active === category ? `filterActive ${styles.filterActive}` : ""}`} aria-pressed={active === category} aria-controls="project-results" data-analytics="project_filter" data-analytics-label={category || "all"} onClick={() => setActive(category)}>{category ?? copy.allCategories}</button>)}
        </div>
        <p className={styles.resultsCount} role="status" aria-live="polite" aria-atomic="true">{copy.results.replace("{count}", count)}</p>
      </div>
      <div id="project-results" className={`projectGrid projectGridArchive ${styles.archiveGrid}`}>
        {filtered.map((project, index) => <ProjectCard key={project.slug} project={project} locale={locale} variant="archive" headingLevel={2} priority={index === 0} labels={copy} />)}
      </div>
      {filtered.length === 0 ? <div className={styles.emptyState}><h2>{copy.emptyProjects}</h2><p>{copy.emptyProjectsBody}</p>{active !== null ? <button type="button" className={styles.outlineButton} onClick={() => setActive(null)}>{copy.clearFilters}</button> : null}</div> : null}
    </>
  );
}
