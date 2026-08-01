import type { Metadata } from "next";
import { getText } from "@/lib/content";
import { getEditorialPage, getTeamPartners } from "@/lib/content-source";
import type { Locale } from "@/lib/i18n";
import { buildMetadata, pageSeo } from "@/lib/seo";

const fallback = {
  fa: {
    kicker: "درباره مندگار", title: "تجربه را از صفر می‌سازیم.", intro: "مندگار یک شرکت تجربه‌محور برای رویدادها و نمایشگاه‌هاست؛ جایی که ایده، فضا، فناوری و اجرا در یک مسیر واحد قرار می‌گیرند.",
    approachKicker: "چطور فکر می‌کنیم", approachTitle: "چطور فکر می‌کنیم", approachBody: "ما به جای اضافه کردن افکت، ابتدا دلیل حضور هر عنصر را پیدا می‌کنیم. تجربه باید روشن، انسانی، قابل اجرا و در نهایت به‌یادماندنی باشد.", principles: ["ایده قبل از ابزار", "جزئیات با دلیل", "اثبات با کار واقعی", "آماده برای همکاری"],
    geographyKicker: "مدل جغرافیایی", geographyTitle: "ساخت محلی. آماده برای همکاری جهانی.", geographyBody: "مندگار در ایران ریشه دارد و در بازارهای دیگر بر اساس نیاز پروژه، امکان همکاری مستقیم یا مشارکت با تیم‌های محلی مورد اعتماد را بررسی می‌کند.",
  },
  en: {
    kicker: "About Mandegar", title: "We build the experience from zero.", intro: "Mandegar is an experience company for events and exhibitions, connecting idea, space, technology and delivery into one journey.",
    approachKicker: "How we think", approachTitle: "How we think", approachBody: "Instead of adding effects, we first find the reason for every element. An experience should be clear, human, deliverable and ultimately memorable.", principles: ["Idea before tool", "Detail with purpose", "Proof through real work", "Ready to collaborate"],
    geographyKicker: "Geographic model", geographyTitle: "Built locally. Ready to collaborate globally.", geographyBody: "Mandegar is rooted in Iran. In other markets, we consider direct work or trusted local partnerships according to each project’s needs.",
  },
  ar: {
    kicker: "عن مندگار", title: "نبني التجربة من الصفر.", intro: "مندگار شركة تجارب للفعاليات والمعارض، تربط الفكرة والمساحة والتقنية والتنفيذ في رحلة واحدة.",
    approachKicker: "كيف نفكر", approachTitle: "كيف نفكر", approachBody: "بدلاً من إضافة المؤثرات، نبحث أولاً عن سبب كل عنصر. يجب أن تكون التجربة واضحة وإنسانية وقابلة للتنفيذ ولا تُنسى.", principles: ["الفكرة قبل الأداة", "تفصيل له هدف", "الإثبات بالعمل الحقيقي", "جاهزون للتعاون"],
    geographyKicker: "النموذج الجغرافي", geographyTitle: "بُني محلياً. جاهزون للتعاون عالمياً.", geographyBody: "مندگار متجذر في إيران، وفي الأسواق الأخرى يدرس العمل المباشر أو الشراكة مع فرق محلية موثوقة حسب متطلبات المشروع.",
  },
} satisfies Record<Locale, Record<string, string | string[]>>;

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const editorial = await getEditorialPage(locale, "about");
  const [fallbackTitle, fallbackDescription] = pageSeo[locale].about;
  const title = editorial?.seo ? getText(editorial.seo.title, locale) || fallbackTitle : fallbackTitle;
  const description = editorial?.seo ? getText(editorial.seo.description, locale) || fallbackDescription : fallbackDescription;
  return buildMetadata({ locale, title, description, path: "about" });
}

export default async function AboutPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const [editorial, people] = await Promise.all([getEditorialPage(locale, "about"), getTeamPartners()]);
  const text = { ...fallback[locale], principles: [...fallback[locale].principles] };
  const approach = editorial?.sections.find((section) => section.key === "approach");
  const geography = editorial?.sections.find((section) => section.key === "geography");
  if (editorial) {
    text.kicker = getText(editorial.heroKicker, locale) || text.kicker;
    text.title = getText(editorial.title, locale) || text.title;
    text.intro = getText(editorial.intro, locale) || text.intro;
  }
  if (approach) {
    text.approachKicker = approach.kicker ? getText(approach.kicker, locale) || text.approachKicker : text.approachKicker;
    text.approachTitle = approach.title ? getText(approach.title, locale) || text.approachTitle : text.approachTitle;
    text.approachBody = approach.body ? getText(approach.body, locale) || text.approachBody : text.approachBody;
    if (approach.items.length) text.principles = approach.items.map((item) => getText(item, locale)).filter(Boolean);
  }
  if (geography) {
    text.geographyKicker = geography.kicker ? getText(geography.kicker, locale) || text.geographyKicker : text.geographyKicker;
    text.geographyTitle = geography.title ? getText(geography.title, locale) || text.geographyTitle : text.geographyTitle;
    text.geographyBody = geography.body ? getText(geography.body, locale) || text.geographyBody : text.geographyBody;
  }

  return (
    <div className="aboutPage">
      <section className="pageHero"><div className="pageWidth"><div className="sectionKicker">01 / {text.kicker}</div><h1>{text.title}</h1><p>{text.intro}</p></div></section>
      <section className="sectionPad"><div className="pageWidth aboutGrid"><div><div className="sectionKicker">02 / {text.approachKicker}</div><h2 className="aboutStatement">{text.approachTitle}</h2></div><div><p className="sectionLeadText">{text.approachBody}</p><div className="principles">{text.principles.map((principle, index) => <div className="principle" key={principle}><strong>0{index + 1}</strong><p>{principle}</p></div>)}</div></div></div></section>
      <section className="sectionPad trustSection"><div className="pageWidth splitIntro"><div className="sectionKicker">03 / {text.geographyKicker}</div><div><h2>{text.geographyTitle}</h2><p>{text.geographyBody}</p></div></div></section>
      {people.length ? <section className="sectionPad"><div className="pageWidth"><div className="sectionKicker">04 / {locale === "fa" ? "تیم و همکاران" : locale === "ar" ? "الفريق والشركاء" : "Team and partners"}</div><div className="teamGrid">{people.map((person) => <article className="teamCard" key={`${person.name}-${person.partnerType}`}><span>{person.partnerType}</span><h2>{person.name}</h2><strong>{getText(person.role, locale)}</strong><p>{getText(person.biography, locale)}</p><small>{person.location}</small></article>)}</div></div></section> : null}
    </div>
  );
}
