import { MandegarExperience, type ExperienceCopy } from "@/components/experience/MandegarExperience";
import { getHomeModel, getSiteSettings } from "@/lib/content-source";
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
    invitationEyebrow: "حلقه کامل می‌شود",
    invitationTitle: "بیایید رویداد بعدی شما را با هم تصور کنیم.",
    invitationBody: "از اولین ایده تا لحظه‌ای که در ذهن مخاطب می‌ماند، تجربه را یکپارچه طراحی و اجرا می‌کنیم.",
    startProject: "شروع یک پروژه",
    scroll: "برای فعال‌کردن فضا اسکرول کنید",
    replay: "تکرار تجربه",
    enableSound: "فعال‌کردن صدا",
    muteSound: "قطع صدا",
    loading: "آماده‌سازی فضای نمایشگاه",
    phases: { arrival: "ورود", discovery: "کشف", activation: "فعال‌سازی", reveal: "آشکارسازی", loop: "دعوت" },
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
    invitationEyebrow: "The loop completes",
    invitationTitle: "Let’s imagine your next event together.",
    invitationBody: "From the first idea to the moment people remember, we design and deliver the experience as one system.",
    startProject: "Start a project",
    scroll: "Scroll to activate the space",
    replay: "Replay experience",
    enableSound: "Enable sound",
    muteSound: "Mute sound",
    loading: "Preparing the exhibition world",
    phases: { arrival: "Arrival", discovery: "Discovery", activation: "Activation", reveal: "Reveal", loop: "Invitation" },
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
    invitationEyebrow: "تكتمل الحلقة",
    invitationTitle: "لنتخيل فعاليتك القادمة معاً.",
    invitationBody: "من الفكرة الأولى إلى اللحظة التي يتذكرها الناس، نصمم التجربة وننفذها كنظام واحد.",
    startProject: "ابدأ مشروعاً",
    scroll: "مرّر لتفعيل المساحة",
    replay: "إعادة التجربة",
    enableSound: "تفعيل الصوت",
    muteSound: "كتم الصوت",
    loading: "تجهيز عالم المعرض",
    phases: { arrival: "الوصول", discovery: "الاكتشاف", activation: "التفعيل", reveal: "الكشف", loop: "الدعوة" },
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
  const [{ copy: cmsCopy, ctaOverrides, fromCms }, settings] = await Promise.all([getHomeModel(locale), getSiteSettings()]);
  const base = fallbackCopy[locale];
  const copy: ExperienceCopy = {
    ...base,
    discoveryTitle: fromCms ? usable(cmsCopy.spaceTitle, base.discoveryTitle) : base.discoveryTitle,
    discoveryBody: fromCms ? usable(cmsCopy.spaceBody, base.discoveryBody) : base.discoveryBody,
    activationTitle: fromCms ? usable(cmsCopy.systemTitle, base.activationTitle) : base.activationTitle,
    activationBody: fromCms ? usable(cmsCopy.systemBody, base.activationBody) : base.activationBody,
    revealTitle: fromCms ? usable(cmsCopy.interactiveTitle, base.revealTitle) : base.revealTitle,
    revealBody: fromCms ? usable(cmsCopy.interactiveBody, base.revealBody) : base.revealBody,
    invitationTitle: fromCms ? usable(cmsCopy.ctaTitle, base.invitationTitle) : base.invitationTitle,
    invitationBody: fromCms ? usable(cmsCopy.ctaBody, base.invitationBody) : base.invitationBody,
  };
  const requestedHref = ctaOverrides.conversion?.href;
  const ctaHref = requestedHref?.startsWith("/") ? requestedHref : localizedPath(locale, "contact");

  return (
    <MandegarExperience
      locale={locale}
      copy={copy}
      ctaHref={ctaHref}
      enabledByCms={settings.featureFlags.immersiveCanvas}
      lenisEnabled={settings.featureFlags.lenis}
    />
  );
}
