import { MandegarExperience, type ExperienceCopy } from "@/components/experience/MandegarExperience";
import { getText } from "@/lib/content";
import { getHomeModel, getProjects, getSiteSettings, getTrustContent } from "@/lib/content-source";
import { ensureLocale, localizedPath, type Locale } from "@/lib/i18n";

const fallbackCopy: Record<Locale, ExperienceCopy> = {
  fa: {
    arrivalLabel: "فضایی آرام، در انتظار زنده‌شدن.",
    discoveryEyebrow: "کشف / ۰۲",
    discoveryTitle: "از فضای خالی تا لحظه‌ای که شکل می‌گیرد.",
    discoveryBody: "نور، مسیر را نشان می‌دهد و هسته‌ی منـدگار آرام‌آرام از دل نمایشگاه نمایان می‌شود.",
    activationEyebrow: "فعال‌سازی / ۰۳",
    activationTitle: "نور، تصویر و تعامل با یک ریتم بیدار می‌شوند.",
    activationBody: "نمایشگرها، دیواره‌ی رسانه‌ای و ایستگاه‌های تجربه، یکی پس از دیگری به یک سیستم زنده تبدیل می‌شوند.",
    revealEyebrow: "آشکارسازی / ۰۴",
    revealTitle: "تجربه‌ای که مرکز توجه می‌شود.",
    revealBody: "منـدگار فضای معمولی رویداد را به مغناطیسی‌ترین و به‌یادماندنی‌ترین نقطه‌ی آن تبدیل می‌کند.",
    experiencesEyebrow: "تجربه‌ها / ۰۵",
    experiencesTitle: "فضا فقط دیده نمی‌شود؛ پاسخ می‌دهد.",
    experiencesBody: "ایستگاه تصویر، بازی و میز لمسی را انتخاب کنید تا واکنش هر بخش را در همان جهان ببینید.",
    proofEyebrow: "رد پروژه / ۰۶",
    proofTitle: "هر پروژه، بخشی از این جهان را واقعی می‌کند.",
    proofBody: "سه جایگاه زنده از CMS؛ نمونه‌های دمو تا زمان ورود پروژه‌های تأییدشده با برچسب روشن نمایش داده می‌شوند.",
    intelligenceEyebrow: "هوشمندی رویداد / ۰۷",
    intelligenceTitle: "از حرکت‌های انسانی، بینش‌های نرم شکل می‌گیرند.",
    intelligenceBody: "خطوط و نقاط، امکان یک لایه‌ی هوشمند آینده‌نگر را نشان می‌دهند؛ بدون داشبورد و بدون ادعای داده‌ی تأییدنشده.",
    invitationEyebrow: "دعوت / ۰۸",
    invitationTitle: "بیایید رویداد بعدی شما را با هم تصور کنیم.",
    invitationBody: "از اولین ایده تا لحظه‌ای که در ذهن مخاطب می‌ماند، تجربه را یکپارچه طراحی و اجرا می‌کنیم.",
    startProject: "شروع یک پروژه",
    scroll: "برای فعال‌کردن فضا اسکرول کنید",
    replay: "تکرار تجربه",
    enableSound: "فعال‌کردن صدا",
    muteSound: "قطع صدا",
    loading: "آماده‌سازی فضای نمایشگاه",
    zones: { photo: "تصویر", game: "بازی", touch: "لمس" },
    phases: { arrival: "ورود", discovery: "کشف", activation: "فعال‌سازی", reveal: "آشکارسازی", experiences: "تجربه‌ها", proof: "پروژه‌ها", intelligence: "هوشمندی", invitation: "دعوت", loop: "حلقه" },
    navigation: { projects: "پروژه‌ها", services: "خدمات", about: "درباره ما", contact: "تماس" },
  },
  en: {
    arrivalLabel: "A quiet space, waiting to come alive.",
    discoveryEyebrow: "02 / Discovery",
    discoveryTitle: "From empty space to a moment taking shape.",
    discoveryBody: "A light path reveals the Mandegar zone and draws the hall toward one clear centre.",
    activationEyebrow: "03 / Activation",
    activationTitle: "Light, media and interaction wake in rhythm.",
    activationBody: "Screens, media architecture and experience stations come online one by one as a single live system.",
    revealEyebrow: "04 / Full reveal",
    revealTitle: "The experience becomes the centre of attention.",
    revealBody: "Mandegar turns an ordinary event space into its most magnetic and memorable destination.",
    experiencesEyebrow: "05 / Experiences",
    experiencesTitle: "The space does not just present. It responds.",
    experiencesBody: "Choose the photo, game or touch station and see each zone respond inside the same world.",
    proofEyebrow: "06 / Project proof",
    proofTitle: "Every project makes part of this world real.",
    proofBody: "Three live CMS slots; clearly labelled demos remain in place until approved projects arrive.",
    intelligenceEyebrow: "07 / Event intelligence",
    intelligenceTitle: "Human movement can become a softer kind of insight.",
    intelligenceBody: "Lines and nodes suggest a future-facing intelligence layer without dashboards or unverified data claims.",
    invitationEyebrow: "08 / Invitation",
    invitationTitle: "Let’s imagine your next event together.",
    invitationBody: "From the first idea to the moment people remember, we design and deliver the experience as one system.",
    startProject: "Start a project",
    scroll: "Scroll to activate the space",
    replay: "Replay experience",
    enableSound: "Enable sound",
    muteSound: "Mute sound",
    loading: "Preparing the exhibition world",
    zones: { photo: "Photo", game: "Game", touch: "Touch" },
    phases: { arrival: "Arrival", discovery: "Discovery", activation: "Activation", reveal: "Reveal", experiences: "Experiences", proof: "Proof", intelligence: "Intelligence", invitation: "Invitation", loop: "Loop" },
    navigation: { projects: "Projects", services: "Services", about: "About", contact: "Contact" },
  },
  ar: {
    arrivalLabel: "مساحة هادئة تنتظر أن تنبض بالحياة.",
    discoveryEyebrow: "٠٢ / الاكتشاف",
    discoveryTitle: "من مساحة فارغة إلى لحظة تتشكل.",
    discoveryBody: "يكشف مسار الضوء منطقة منـدگار ويقود المعرض نحو مركز واضح.",
    activationEyebrow: "٠٣ / التفعيل",
    activationTitle: "يستيقظ الضوء والمحتوى والتفاعل بإيقاع واحد.",
    activationBody: "تعمل الشاشات والواجهات الإعلامية ومحطات التجربة تباعاً كنظام حي متكامل.",
    revealEyebrow: "٠٤ / الكشف الكامل",
    revealTitle: "تصبح التجربة مركز الاهتمام.",
    revealBody: "تحوّل منـدگار مساحة الفعالية العادية إلى أكثر نقاطها جذباً وبقاءً في الذاكرة.",
    experiencesEyebrow: "٠٥ / التجارب",
    experiencesTitle: "المساحة لا تعرض فقط؛ بل تستجيب.",
    experiencesBody: "اختر محطة الصورة أو اللعب أو اللمس وشاهد استجابة كل منطقة داخل العالم نفسه.",
    proofEyebrow: "٠٦ / دليل المشاريع",
    proofTitle: "كل مشروع يحوّل جزءاً من هذا العالم إلى واقع.",
    proofBody: "ثلاث خانات حية من CMS؛ تبقى النماذج المؤقتة موسومة بوضوح حتى وصول المشاريع المعتمدة.",
    intelligenceEyebrow: "٠٧ / ذكاء الفعاليات",
    intelligenceTitle: "يمكن لحركة الناس أن تتحول إلى رؤى أكثر هدوءاً.",
    intelligenceBody: "تقترح الخطوط والعُقد طبقة ذكاء مستقبلية بلا لوحات معلومات أو ادعاءات بيانات غير موثقة.",
    invitationEyebrow: "٠٨ / الدعوة",
    invitationTitle: "لنتخيل فعاليتك القادمة معاً.",
    invitationBody: "من الفكرة الأولى إلى اللحظة التي يتذكرها الناس، نصمم التجربة وننفذها كنظام واحد.",
    startProject: "ابدأ مشروعاً",
    scroll: "مرّر لتفعيل المساحة",
    replay: "إعادة التجربة",
    enableSound: "تفعيل الصوت",
    muteSound: "كتم الصوت",
    loading: "تجهيز عالم المعرض",
    zones: { photo: "الصورة", game: "اللعب", touch: "اللمس" },
    phases: { arrival: "الوصول", discovery: "الاكتشاف", activation: "التفعيل", reveal: "الكشف", experiences: "التجارب", proof: "المشاريع", intelligence: "الذكاء", invitation: "الدعوة", loop: "الحلقة" },
    navigation: { projects: "المشاريع", services: "الخدمات", about: "من نحن", contact: "تواصل" },
  },
};

function usable(value: string | undefined, fallback: string) {
  if (!value || /[ØÙÛ]|â€|ï¿½/.test(value)) return fallback;
  return value;
}

export default async function HomePage({ params }: { params: Promise<{ locale?: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = ensureLocale(rawLocale || "fa");
  const [home, settings, availableProjects, trust] = await Promise.all([
    getHomeModel(locale),
    getSiteSettings(),
    getProjects(locale),
    getTrustContent(locale),
  ]);
  const { copy: cmsCopy, ctaOverrides, featuredProjects, fromCms } = home;
  const base = fallbackCopy[locale];
  const copy: ExperienceCopy = {
    ...base,
    discoveryTitle: fromCms ? usable(cmsCopy.spaceTitle, base.discoveryTitle) : base.discoveryTitle,
    discoveryBody: fromCms ? usable(cmsCopy.spaceBody, base.discoveryBody) : base.discoveryBody,
    activationTitle: fromCms ? usable(cmsCopy.systemTitle, base.activationTitle) : base.activationTitle,
    activationBody: fromCms ? usable(cmsCopy.systemBody, base.activationBody) : base.activationBody,
    revealTitle: fromCms ? usable(cmsCopy.interactiveTitle, base.revealTitle) : base.revealTitle,
    revealBody: fromCms ? usable(cmsCopy.interactiveBody, base.revealBody) : base.revealBody,
    experiencesTitle: fromCms ? usable(cmsCopy.interactiveTitle, base.experiencesTitle) : base.experiencesTitle,
    experiencesBody: fromCms ? usable(cmsCopy.interactiveBody, base.experiencesBody) : base.experiencesBody,
    proofTitle: fromCms ? usable(cmsCopy.proofTitle, base.proofTitle) : base.proofTitle,
    proofBody: fromCms ? usable(cmsCopy.proofBody, base.proofBody) : base.proofBody,
    intelligenceTitle: fromCms ? usable(cmsCopy.intelligenceTitle, base.intelligenceTitle) : base.intelligenceTitle,
    intelligenceBody: fromCms ? usable(cmsCopy.intelligenceBody, base.intelligenceBody) : base.intelligenceBody,
    invitationTitle: fromCms ? usable(cmsCopy.ctaTitle, base.invitationTitle) : base.invitationTitle,
    invitationBody: fromCms ? usable(cmsCopy.ctaBody, base.invitationBody) : base.invitationBody,
  };
  const requestedHref = ctaOverrides.conversion?.href;
  const ctaHref = requestedHref?.startsWith("/") ? requestedHref : localizedPath(locale, "contact");
  const projects = (featuredProjects.length ? featuredProjects : availableProjects).slice(0, 6).map((project) => ({
    slug: project.slug,
    title: getText(project.title, locale),
    eyebrow: getText(project.eyebrow, locale),
    summary: getText(project.summary, locale),
    mediaSrc: project.media.src,
    isPlaceholder: Boolean(project.isPlaceholder),
  }));
  const testimonials = trust.testimonials.map((testimonial) => ({
    quote: getText(testimonial.quote, locale),
    person: getText(testimonial.person, locale),
    role: getText(testimonial.role, locale),
    organization: getText(testimonial.organization, locale),
    isPlaceholder: false,
  }));
  const clients = trust.clients.map((client) => ({ name: client.name, logo: client.logo }));

  return (
    <MandegarExperience
      locale={locale}
      copy={copy}
      ctaHref={ctaHref}
      projects={projects}
      testimonials={testimonials}
      clients={clients}
      enabledByCms={settings.featureFlags.immersiveCanvas}
      lenisEnabled={settings.featureFlags.lenis}
    />
  );
}
