import { MandegarExperience, type ExperienceCopy } from "@/components/experience/MandegarExperience";
import { getText } from "@/lib/content";
import { getHomeModel, getProjects, getSiteSettings, getTrustContent } from "@/lib/content-source";
import { ensureLocale, localizedPath, type Locale } from "@/lib/i18n";

const fallbackCopy: Record<Locale, ExperienceCopy> = {
  fa: {
    arrivalLabel: "فضا زنده می‌شود.",
    arrivalBody: "طراحی و اجرای رویداد، نمایشگاه و تجربه‌های تعاملی.",
    discoveryEyebrow: "کشف / ۰۲",
    discoveryTitle: "ایده شکل می‌گیرد.",
    discoveryBody: "نور، مسیر ورود به فضای ماندگار را نشان می‌دهد.",
    activationEyebrow: "فعال‌سازی / ۰۳",
    activationTitle: "لحظه‌ای برای همراه داشتن.",
    activationBody: "نمونه‌ای از مسیر عکس رویداد تا گوشی مهمان.",
    engagementEyebrow: "درگیرشدن / ۰۴",
    engagementTitle: "تجربه را به هم پیوند دهید.",
    engagementBody: "فضا، روایت و مردم را به هم متصل کنید.",
    revealEyebrow: "آشکارسازی / ۰۵",
    revealTitle: "صحنه را روشن کنید.",
    revealBody: "نورها را انتخاب کنید و نمایش کوتاه خود را بسازید.",
    experiencesEyebrow: "تجربه‌ها / ۰۶",
    experiencesTitle: "لحظه‌ای برای بازی.",
    experiencesBody: "سکو را حرکت دهید و توپ را در بازی نگه دارید.",
    connectionEyebrow: "پیوند / ۰۷",
    connectionTitle: "نشان خود را بگذارید.",
    connectionBody: "روی دیوار بکشید؛ طرح شما در ادامه مسیر می‌ماند.",
    proofEyebrow: "رد پروژه / ۰۸",
    proofTitle: "ایده‌ها در قاب.",
    proofBody: "پروژه‌ها و نمونه‌های مفهومیِ مشخص‌شده را ببینید.",
    intelligenceEyebrow: "هوشمندی رویداد / ۰۹",
    intelligenceTitle: "مشارکت را بهتر بشناسید.",
    intelligenceBody: "برای دیدن داده نمونه، روی یک نفر بروید یا او را لمس کنید.",
    invitationEyebrow: "دعوت / ۱۰",
    invitationTitle: "رویداد بعدی، از اینجا.",
    invitationBody: "از ایده تا اجرا، تجربه بعدی را با هم می‌سازیم.",
    startProject: "شروع یک پروژه",
    scroll: "برای فعال‌کردن فضا اسکرول کنید",
    replay: "تکرار تجربه",
    enableSound: "فعال‌کردن صدا",
    muteSound: "قطع صدا",
    loading: "آماده‌سازی فضای نمایشگاه",
    zones: { photo: "تصویر", game: "بازی", touch: "لمس" },
    phases: { arrival: "ورود", discovery: "کشف", activation: "فعال‌سازی", engagement: "درگیرشدن", reveal: "آشکارسازی", experiences: "تجربه‌ها", connection: "پیوند", proof: "پروژه‌ها", intelligence: "هوشمندی", invitation: "دعوت", loop: "حلقه" },
    navigation: { projects: "پروژه‌ها", services: "خدمات", about: "درباره ما", contact: "تماس" },
  },
  en: {
    arrivalLabel: "A space comes alive.",
    arrivalBody: "Events, exhibitions and interactive experiences.",
    discoveryEyebrow: "02 / Discovery",
    discoveryTitle: "An idea takes shape.",
    discoveryBody: "Light leads you into the Mandegar space.",
    activationEyebrow: "03 / Activation",
    activationTitle: "Your moment, delivered.",
    activationBody: "An example photo follows the journey to a visitor’s phone.",
    engagementEyebrow: "04 / Engagement",
    engagementTitle: "Connect the experience.",
    engagementBody: "Bring space, story and people together.",
    revealEyebrow: "05 / Full reveal",
    revealTitle: "Set the stage.",
    revealBody: "Choose the lights and play your own short show.",
    experiencesEyebrow: "06 / Experiences",
    experiencesTitle: "A moment of play.",
    experiencesBody: "Move the paddle and keep the ball in play.",
    connectionEyebrow: "07 / Connection",
    connectionTitle: "Leave your mark.",
    connectionBody: "Draw on the wall; your mark stays with the journey.",
    proofEyebrow: "08 / Project proof",
    proofTitle: "Ideas made visible.",
    proofBody: "Explore the work and clearly labelled concept studies.",
    intelligenceEyebrow: "09 / Event intelligence",
    intelligenceTitle: "Understand the response.",
    intelligenceBody: "Hover or tap a person to explore example participation.",
    invitationEyebrow: "10 / Invitation",
    invitationTitle: "Your next event starts here.",
    invitationBody: "From idea to experience, we build it together.",
    startProject: "Start a project",
    scroll: "Scroll to activate the space",
    replay: "Replay experience",
    enableSound: "Enable sound",
    muteSound: "Mute sound",
    loading: "Preparing the exhibition world",
    zones: { photo: "Photo", game: "Game", touch: "Touch" },
    phases: { arrival: "Arrival", discovery: "Discovery", activation: "Activation", engagement: "Engagement", reveal: "Reveal", experiences: "Experiences", connection: "Connection", proof: "Proof", intelligence: "Intelligence", invitation: "Invitation", loop: "Loop" },
    navigation: { projects: "Projects", services: "Services", about: "About", contact: "Contact" },
  },
  ar: {
    arrivalLabel: "مساحة تنبض بالحياة.",
    arrivalBody: "نصمم وننفذ الفعاليات والمعارض والتجارب التفاعلية.",
    discoveryEyebrow: "٠٢ / الاكتشاف",
    discoveryTitle: "الفكرة تأخذ شكلها.",
    discoveryBody: "الضوء يقودك إلى مساحة ماندگار.",
    activationEyebrow: "٠٣ / التفعيل",
    activationTitle: "لحظتك، معك.",
    activationBody: "صورة نموذجية تُظهر انتقال الصورة إلى هاتف الزائر.",
    engagementEyebrow: "٠٤ / المشاركة",
    engagementTitle: "اربط عناصر التجربة.",
    engagementBody: "اجمع المكان والقصة والناس.",
    revealEyebrow: "٠٥ / الكشف الكامل",
    revealTitle: "أضئ المسرح.",
    revealBody: "اختر الإضاءة وشغّل عرضك القصير.",
    experiencesEyebrow: "٠٦ / التجارب",
    experiencesTitle: "لحظة للّعب.",
    experiencesBody: "حرّك المضرب وأبقِ الكرة في اللعب.",
    connectionEyebrow: "٠٧ / الترابط",
    connectionTitle: "اترك بصمتك.",
    connectionBody: "ارسم على الجدار؛ تبقى بصمتك مع الرحلة.",
    proofEyebrow: "٠٨ / دليل المشاريع",
    proofTitle: "أفكار ترى النور.",
    proofBody: "استكشف الأعمال والنماذج المفاهيمية المعلّمة بوضوح.",
    intelligenceEyebrow: "٠٩ / ذكاء الفعاليات",
    intelligenceTitle: "افهم التفاعل.",
    intelligenceBody: "مرّر على شخص أو المسه لاستكشاف نموذج المشاركة.",
    invitationEyebrow: "١٠ / الدعوة",
    invitationTitle: "فعاليتك القادمة تبدأ هنا.",
    invitationBody: "من الفكرة إلى التنفيذ، نبني التجربة معاً.",
    startProject: "ابدأ مشروعاً",
    scroll: "مرّر لتفعيل المساحة",
    replay: "إعادة التجربة",
    enableSound: "تفعيل الصوت",
    muteSound: "كتم الصوت",
    loading: "تجهيز عالم المعرض",
    zones: { photo: "الصورة", game: "اللعب", touch: "اللمس" },
    phases: { arrival: "الوصول", discovery: "الاكتشاف", activation: "التفعيل", engagement: "المشاركة", reveal: "الكشف", experiences: "التجارب", connection: "الترابط", proof: "المشاريع", intelligence: "الذكاء", invitation: "الدعوة", loop: "الحلقة" },
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
  const projects = (featuredProjects.length ? featuredProjects : availableProjects).slice(0, 8).map((project) => ({
    slug: project.slug,
    title: getText(project.title, locale),
    eyebrow: getText(project.eyebrow, locale),
    category: getText(project.category, locale),
    summary: getText(project.summary, locale),
    mediaSrc: project.media.src,
    mediaKind: project.media.kind,
    mediaPoster: project.media.poster,
    gallery: (project.gallery || []).map((item) => ({
      src: item.src,
      kind: item.kind,
      poster: item.poster,
    })),
    year: project.year,
    location: getText(project.location, locale),
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
