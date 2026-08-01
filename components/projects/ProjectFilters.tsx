"use client";

import { useMemo, useState } from "react";
import type { Project } from "@/lib/content";
import { getText, } from "@/lib/content";
import { getUi, type Locale } from "@/lib/i18n";
import { ProjectCard } from "./ProjectCard";

export function ProjectFilters({ projects, locale }: { projects: Project[]; locale: Locale }) {
  const copy = getUi(locale);
  const categories = useMemo(() => [copy.all, ...Array.from(new Set(projects.flatMap((project) => (project.categories || [project.category]).map((category) => getText(category, locale)))))], [copy.all, locale, projects]);
  const [active, setActive] = useState<string>(copy.all);
  const filtered = active === copy.all ? projects : projects.filter((project) => (project.categories || [project.category]).some((category) => getText(category, locale) === active));

  return (
    <>
      <div className="filterBar" role="group" aria-label={locale === "fa" ? "فیلتر پروژه‌ها" : locale === "ar" ? "تصفية المشاريع" : "Project filters"}>
        {categories.map((category) => <button type="button" key={category} className={active === category ? "filterButton filterActive" : "filterButton"} data-analytics="project_filter" data-analytics-label={category} onClick={() => setActive(category)}>{category}</button>)}
      </div>
      <div className="projectGrid projectGridArchive">
        {filtered.map((project) => <ProjectCard key={project.slug} project={project} locale={locale} />)}
      </div>
    </>
  );
}
