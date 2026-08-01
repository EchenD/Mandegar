"use client";

import { useMemo, useState } from "react";
import type { Project } from "@/lib/content";
import { getText, } from "@/lib/content";
import { getUi, type Locale } from "@/lib/i18n";
import { ProjectCard } from "./ProjectCard";

export function ProjectFilters({ projects, locale }: { projects: Project[]; locale: Locale }) {
  const copy = getUi(locale);
  const categories = useMemo(() => [copy.all, ...Array.from(new Set(projects.map((project) => getText(project.category, locale))))], [copy.all, locale, projects]);
  const [active, setActive] = useState<string>(copy.all);
  const filtered = active === copy.all ? projects : projects.filter((project) => getText(project.category, locale) === active);

  return (
    <>
      <div className="filterBar" role="group" aria-label={locale === "fa" ? "فیلتر پروژه‌ها" : locale === "ar" ? "تصفية المشاريع" : "Project filters"}>
        {categories.map((category) => <button type="button" key={category} className={active === category ? "filterButton filterActive" : "filterButton"} onClick={() => setActive(category)}>{category}</button>)}
      </div>
      <div className="projectGrid projectGridArchive">
        {filtered.map((project) => <ProjectCard key={project.slug} project={project} locale={locale} />)}
      </div>
    </>
  );
}
