import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { getText } from "@/lib/content";
import { getContactChannels, type ContactChannel } from "@/lib/content-source";

export default async function ContactPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const channels = await getContactChannels();
  const text = {
    fa: { kicker: "شروع گفتگو", title: "پروژه بعدی شما از همین‌جا شروع می‌شود.", intro: "اطلاعات تماس واقعی و مقصدهای فروش از طریق CMS به این صفحه متصل می‌شوند. ساختار صفحه برای تماس سریع، واتساپ و فرم کوتاه آماده است.", sales: "فروش / شروع پروژه", general: "پرسش‌های عمومی", international: "همکاری بین‌المللی" },
    en: { kicker: "Start a conversation", title: "Your next project starts here.", intro: "Real contact details and sales destinations will connect through the CMS. The page is ready for direct contact, WhatsApp and a short callback form.", sales: "Sales / start a project", general: "General enquiries", international: "International collaboration" },
    ar: { kicker: "ابدأ الحوار", title: "يبدأ مشروعك القادم من هنا.", intro: "سيتم ربط بيانات التواصل ووجهات المبيعات الحقيقية عبر CMS. الصفحة جاهزة للتواصل المباشر وواتساب ونموذج اتصال مختصر.", sales: "المبيعات / ابدأ مشروعاً", general: "الاستفسارات العامة", international: "التعاون الدولي" },
  }[locale];
  const channel = (purpose: ContactChannel["purpose"]) => channels.find((item) => item.purpose === purpose);
  return <div className="contactPage"><section className="pageHero"><div className="pageWidth"><div className="sectionKicker">01 / {text.kicker}</div><h1>{text.title}</h1><p>{text.intro}</p></div></section><section className="sectionPad"><div className="pageWidth contactGrid"><div><div className="sectionKicker">02 / {locale === "fa" ? "مسیرهای تماس" : locale === "ar" ? "قنوات التواصل" : "Contact channels"}</div><h2>{locale === "fa" ? "گفتگو را مستقیم شروع کنیم." : locale === "ar" ? "لنبدأ الحوار مباشرة." : "Let’s start the conversation directly."}</h2></div><div><ContactCard title={text.sales} locale={locale} primary channel={channel("sales")} /><ContactCard title={text.general} locale={locale} channel={channel("general")} /><ContactCard title={text.international} locale={locale} channel={channel("international")} /><p className="contactNote">{channels.length === 0 ? (locale === "fa" ? "این اطلاعات عمداً placeholder است و عدد یا آدرس ساختگی منتشر نمی‌کند." : locale === "ar" ? "هذه المعلومات مؤقتة عمداً ولا تنشر أرقاماً أو عناوين مختلقة." : "These details are intentionally placeholder content and do not publish invented numbers or addresses.") : (locale === "fa" ? "کانال‌های تماس از Sanity مدیریت می‌شوند." : locale === "ar" ? "تتم إدارة قنوات التواصل من Sanity." : "Contact channels are managed from Sanity.")}</p></div></div></section></div>;
}

function ContactCard({ title, locale, primary = false, channel }: { title: string; locale: Locale; primary?: boolean; channel?: ContactChannel }) {
  const details = channel ? [channel.phone && <a key="phone" href={`tel:${channel.phone}`}>{channel.phone}</a>, channel.whatsapp && <a key="whatsapp" href={channel.whatsapp.startsWith("http") ? channel.whatsapp : `https://wa.me/${channel.whatsapp.replace(/\D/g, "")}`}>WhatsApp</a>, channel.email && <a key="email" href={`mailto:${channel.email}`}>{channel.email}</a>].filter(Boolean) : [];
  return <div className="contactCard"><h3>{channel ? getText(channel.label, locale) : title}</h3><p>{channel?.availability || (locale === "fa" ? "کانال ارتباطی در CMS قابل تنظیم است." : locale === "ar" ? "يمكن ضبط قناة التواصل في CMS." : "This contact channel is configurable in the CMS.")}</p>{details.length ? <div className="contactDetails">{details}</div> : <div className="contactPlaceholder">{locale === "fa" ? "در انتظار اطلاعات واقعی" : locale === "ar" ? "بانتظار البيانات الحقيقية" : "Awaiting real details"}</div>}{primary && details.length === 0 ? <div className="ctaActions"><Link className="button buttonPrimary" href="#contact-details">{locale === "fa" ? "تنظیم کانال فروش" : locale === "ar" ? "ضبط قناة المبيعات" : "Configure sales channel"}</Link></div> : null}</div>;
}
