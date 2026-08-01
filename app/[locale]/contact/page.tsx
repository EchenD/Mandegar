import Link from "next/link";
import type { Locale } from "@/lib/i18n";

export default async function ContactPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const text = {
    fa: { kicker: "شروع گفتگو", title: "پروژه بعدی شما از همین‌جا شروع می‌شود.", intro: "اطلاعات تماس واقعی و مقصدهای فروش از طریق CMS به این صفحه متصل می‌شوند. ساختار صفحه برای تماس سریع، واتساپ و فرم کوتاه آماده است.", sales: "فروش / شروع پروژه", general: "پرسش‌های عمومی", international: "همکاری بین‌المللی" },
    en: { kicker: "Start a conversation", title: "Your next project starts here.", intro: "Real contact details and sales destinations will connect through the CMS. The page is ready for direct contact, WhatsApp and a short callback form.", sales: "Sales / start a project", general: "General enquiries", international: "International collaboration" },
    ar: { kicker: "ابدأ الحوار", title: "يبدأ مشروعك القادم من هنا.", intro: "سيتم ربط بيانات التواصل ووجهات المبيعات الحقيقية عبر CMS. الصفحة جاهزة للتواصل المباشر وواتساب ونموذج اتصال مختصر.", sales: "المبيعات / ابدأ مشروعاً", general: "الاستفسارات العامة", international: "التعاون الدولي" },
  }[locale];
  return <div className="contactPage"><section className="pageHero"><div className="pageWidth"><div className="sectionKicker">01 / {text.kicker}</div><h1>{text.title}</h1><p>{text.intro}</p></div></section><section className="sectionPad"><div className="pageWidth contactGrid"><div><div className="sectionKicker">02 / {locale === "fa" ? "مسیرهای تماس" : locale === "ar" ? "قنوات التواصل" : "Contact channels"}</div><h2>{locale === "fa" ? "گفتگو را مستقیم شروع کنیم." : locale === "ar" ? "لنبدأ الحوار مباشرة." : "Let’s start the conversation directly."}</h2></div><div><ContactCard title={text.sales} locale={locale} primary /><ContactCard title={text.general} locale={locale} /><ContactCard title={text.international} locale={locale} /><p className="contactNote">{locale === "fa" ? "این اطلاعات عمداً placeholder است و عدد یا آدرس ساختگی منتشر نمی‌کند." : locale === "ar" ? "هذه المعلومات مؤقتة عمداً ولا تنشر أرقاماً أو عناوين مختلقة." : "These details are intentionally placeholder content and do not publish invented numbers or addresses."}</p></div></div></section></div>;
}

function ContactCard({ title, locale, primary = false }: { title: string; locale: Locale; primary?: boolean }) {
  return <div className="contactCard"><h3>{title}</h3><p>{locale === "fa" ? "کانال ارتباطی در CMS قابل تنظیم است." : locale === "ar" ? "يمكن ضبط قناة التواصل في CMS." : "This contact channel is configurable in the CMS."}</p><div className="contactPlaceholder">{locale === "fa" ? "در انتظار اطلاعات واقعی" : locale === "ar" ? "بانتظار البيانات الحقيقية" : "Awaiting real details"}</div>{primary ? <div className="ctaActions"><Link className="button buttonPrimary" href="#contact-details">{locale === "fa" ? "تنظیم کانال فروش" : locale === "ar" ? "ضبط قناة المبيعات" : "Configure sales channel"}</Link></div> : null}</div>;
}
