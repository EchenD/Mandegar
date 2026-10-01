import { MandegarExperience, type ExperienceCopy } from "@/components/experience/MandegarExperience";
import { getText } from "@/lib/content";
import { getHomeModel, getProjects, getSiteSettings, getTrustContent } from "@/lib/content-source";
import { ensureLocale, localizedPath, type Locale } from "@/lib/i18n";

const fallbackCopy: Record<Locale, ExperienceCopy> = {
  fa: {
    arrivalLabel: "فضایی آرام، در انتظار زنده‌شدن.",
    arrivalBody: "رویدادها، نمایشگاه‌ها و تجربه‌های تعاملی را طراحی و اجرا می‌کنیم.",
    discoveryEyebrow: "کشف / ۰۲",
    discoveryTitle: "از فضای خالی تا لحظه‌ای که شکل می‌گیرد.",
    discoveryBody: "نور، مسیر را نشان می‌دهد و هسته‌ی منـدگار آرام‌آرام از دل نمایشگاه نمایان می‌شود.",
    activationEyebrow: "فعال‌سازی / ۰۳",
    activationTitle: "وارد یک لحظه‌ی شبیه‌سازی‌شده‌ی عکاسی شوید.",
    activationBody: "حال‌وهوای نور را انتخاب کنید و شمارش معکوس را برای دیدن پرتره‌ی نمایشی شروع کنید؛ هیچ دوربین یا بارگذاری‌ای استفاده نمی‌شود.",
    engagementEyebrow: "درگیرشدن / ۰۴",
    engagementTitle: "فضا، روایت و مردم را به هم متصل کنید.",
    engagementBody: "سه عنصر تجربه را در نمایشگر غرفه به هم برسانید و ببینید چگونه سیگنال آن‌ها در فضای سه‌بعدی جریان پیدا می‌کند.",
    revealEyebrow: "آشکارسازی / ۰۵",
    revealTitle: "کنترل صحنه‌ی مرکزی را به دست بگیرید.",
    revealBody: "نورهای دلخواهتان را ترکیب کنید، نمایش کوتاه خود را ببینید و نمای صحنه را به سلیقه خود بسازید.",
    experiencesEyebrow: "تجربه‌ها / ۰۶",
    experiencesTitle: "ریتم سیگنال را پیدا کنید.",
    experiencesBody: "هدف بگیرید، سیگنال را پرتاب کنید و بهترین امتیاز همین بازدید را به چالش بکشید.",
    connectionEyebrow: "پیوند / ۰۷",
    connectionTitle: "نشانی نورانی روی نمایشگر بگذارید.",
    connectionBody: "آزادانه روی نمایشگر بکشید؛ با پایان کار، طرح شما یک بار زنده می‌شود و در ادامه مسیر روی دیوار می‌ماند.",
    proofEyebrow: "رد پروژه / ۰۸",
    proofTitle: "هر پروژه، بخشی از این جهان را واقعی می‌کند.",
    proofBody: "ایده‌هایی برای فضا، رویداد و مشارکت را ببینید. نمونه‌های مفهومی با برچسب روشن مشخص شده‌اند.",
    intelligenceEyebrow: "هوشمندی رویداد / ۰۹",
    intelligenceTitle: "از حرکت‌های انسانی، بینش‌های نرم شکل می‌گیرند.",
    intelligenceBody: "خطوط و نقاط، امکان یک لایه‌ی هوشمند آینده‌نگر را نشان می‌دهند؛ بدون داشبورد و بدون ادعای داده‌ی تأییدنشده.",
    invitationEyebrow: "دعوت / ۱۰",
    invitationTitle: "بیایید رویداد بعدی شما را با هم تصور کنیم.",
    invitationBody: "از اولین ایده تا لحظه‌ای که در ذهن مخاطب می‌ماند، تجربه را یکپارچه طراحی و اجرا می‌کنیم.",
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
    arrivalLabel: "A quiet space, waiting to come alive.",
    arrivalBody: "We design and deliver events, exhibitions and interactive experiences.",
    discoveryEyebrow: "02 / Discovery",
    discoveryTitle: "From empty space to a moment taking shape.",
    discoveryBody: "A light path reveals the Mandegar zone and draws the hall toward one clear centre.",
    activationEyebrow: "03 / Activation",
    activationTitle: "Step into a simulated photo moment.",
    activationBody: "Choose the lighting mood and start the countdown for a simulated portrait preview — no camera or upload is used.",
    engagementEyebrow: "04 / Engagement",
    engagementTitle: "Connect space, story and people.",
    engagementBody: "Bring the three elements together on the exhibition screen and watch their signal travel through the 3D space.",
    revealEyebrow: "05 / Full reveal",
    revealTitle: "Take control of the central stage.",
    revealBody: "Combine your favourite lights, play your short show and make the stage look yours.",
    experiencesEyebrow: "06 / Experiences",
    experiencesTitle: "Find the rhythm of the signal.",
    experiencesBody: "Aim, launch the signal and challenge your best score for this visit.",
    connectionEyebrow: "07 / Connection",
    connectionTitle: "Leave a luminous mark on the display.",
    connectionBody: "Draw freely on the display. Finish to replay your mark and leave it on the wall as you continue.",
    proofEyebrow: "08 / Project proof",
    proofTitle: "Every project makes part of this world real.",
    proofBody: "Explore ideas for spaces, events and participation. Concept studies are clearly labelled.",
    intelligenceEyebrow: "09 / Event intelligence",
    intelligenceTitle: "Human movement can become a softer kind of insight.",
    intelligenceBody: "Lines and nodes suggest a future-facing intelligence layer without dashboards or unverified data claims.",
    invitationEyebrow: "10 / Invitation",
    invitationTitle: "Let’s imagine your next event together.",
    invitationBody: "From the first idea to the moment people remember, we design and deliver the experience as one system.",
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
    arrivalLabel: "مساحة هادئة تنتظر أن تنبض بالحياة.",
    arrivalBody: "نصمم الفعاليات والمعارض والتجارب التفاعلية وننفذها.",
    discoveryEyebrow: "٠٢ / الاكتشاف",
    discoveryTitle: "من مساحة فارغة إلى لحظة تتشكل.",
    discoveryBody: "يكشف مسار الضوء منطقة منـدگار ويقود المعرض نحو مركز واضح.",
    activationEyebrow: "٠٣ / التفعيل",
    activationTitle: "ادخل لحظة تصوير محاكاة.",
    activationBody: "اختر أجواء الإضاءة وابدأ العدّ التنازلي لمعاينة صورة محاكاة — من دون كاميرا أو رفع ملفات.",
    engagementEyebrow: "٠٤ / المشاركة",
    engagementTitle: "اربط المكان والقصة والناس.",
    engagementBody: "اجمع عناصر التجربة الثلاثة على شاشة الجناح وشاهد إشارتها تتحرك عبر المساحة ثلاثية الأبعاد.",
    revealEyebrow: "٠٥ / الكشف الكامل",
    revealTitle: "تحكّم في المسرح المركزي.",
    revealBody: "اجمع أضواءك المفضلة، وشغّل عرضك القصير، واجعل مشهد المسرح يعكس ذوقك.",
    experiencesEyebrow: "٠٦ / التجارب",
    experiencesTitle: "اعثر على إيقاع الإشارة.",
    experiencesBody: "صوّب وأطلق الإشارة وتحدَّ أفضل نتيجة لك في هذه الزيارة.",
    connectionEyebrow: "٠٧ / الترابط",
    connectionTitle: "اترك علامة مضيئة على الشاشة.",
    connectionBody: "ارسم بحرية على الشاشة. أنهِ الرسم لتراه ينبض مرةً، واترك علامتك على الجدار وأنت تتابع الرحلة.",
    proofEyebrow: "٠٨ / دليل المشاريع",
    proofTitle: "كل مشروع يحوّل جزءاً من هذا العالم إلى واقع.",
    proofBody: "استكشف أفكاراً للمساحات والفعاليات والمشاركة. النماذج المفاهيمية موسومة بوضوح.",
    intelligenceEyebrow: "٠٩ / ذكاء الفعاليات",
    intelligenceTitle: "يمكن لحركة الناس أن تتحول إلى رؤى أكثر هدوءاً.",
    intelligenceBody: "تقترح الخطوط والعُقد طبقة ذكاء مستقبلية بلا لوحات معلومات أو ادعاءات بيانات غير موثقة.",
    invitationEyebrow: "١٠ / الدعوة",
    invitationTitle: "لنتخيل فعاليتك القادمة معاً.",
    invitationBody: "من الفكرة الأولى إلى اللحظة التي يتذكرها الناس، نصمم التجربة وننفذها كنظام واحد.",
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
