import { ProjectFilters } from "@/components/projects/ProjectFilters";
import { getProjects } from "@/lib/content-source";
import type { Locale } from "@/lib/i18n";

export default async function ProjectsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const projects = await getProjects(locale);
  const text = {
    fa: { kicker: "آرشیو پروژه‌ها", title: "ایده‌ها وقتی واقعی می‌شوند، ماندگارترند.", body: "این آرشیو به‌صورت کامل از CMS تغذیه می‌شود. نمونه‌های فعلی placeholder هستند تا ساختار جایگزینی رسانه و محتوا آماده باشد." },
    en: { kicker: "Project archive", title: "Ideas last longer when they become real.", body: "This archive is designed to be fully CMS-driven. Current entries are placeholders so the media and content replacement system is ready." },
    ar: { kicker: "أرشيف المشاريع", title: "تبقى الأفكار أطول عندما تصبح حقيقية.", body: "تم تصميم هذا الأرشيف ليعمل بالكامل عبر CMS. الإدخالات الحالية مؤقتة حتى يصبح نظام استبدال الوسائط والمحتوى جاهزاً." },
  }[locale];

  return <div className="projectsPage"><section className="pageHero"><div className="pageWidth" data-reveal><div className="sectionKicker">01 / {text.kicker}</div><h1>{text.title}</h1><p>{text.body}</p></div></section><section className="sectionPad"><div className="pageWidth"><ProjectFilters projects={projects} locale={locale} /></div></section></div>;
}
