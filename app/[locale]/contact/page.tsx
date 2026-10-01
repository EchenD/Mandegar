import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { getText } from "@/lib/content";
import { getContactChannels, getEditorialPage, type ContactChannel } from "@/lib/content-source";
import { buildMetadata, pageSeo } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const editorial = await getEditorialPage(locale, "contact");
  const [fallbackTitle, fallbackDescription] = pageSeo[locale].contact;
  const title = editorial?.seo ? getText(editorial.seo.title, locale) || fallbackTitle : fallbackTitle;
  const description = editorial?.seo ? getText(editorial.seo.description, locale) || fallbackDescription : fallbackDescription;
  return buildMetadata({ locale, title, description, path: "contact" });
}

export default async function ContactPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const [channels, editorial] = await Promise.all([getContactChannels(), getEditorialPage(locale, "contact")]);
  const text = {
    fa: { kicker: "شروع گفتگو", title: "پروژه بعدی شما از همین‌جا شروع می‌شود.", intro: "از ایده، مخاطب و زمان پروژه‌تان بگویید تا قدم بعدی را با هم شکل دهیم.", sales: "شروع یک پروژه", general: "پرسش‌های عمومی", international: "همکاری بین‌المللی" },
    en: { kicker: "Start a conversation", title: "Your next project starts here.", intro: "Tell us your idea, who it’s for and when it happens. We’ll shape the next step together.", sales: "Start a project", general: "General enquiries", international: "International collaboration" },
    ar: { kicker: "ابدأ الحوار", title: "يبدأ مشروعك القادم من هنا.", intro: "أخبرنا بفكرتك وجمهورها وموعدها، لنشكّل الخطوة التالية معاً.", sales: "ابدأ مشروعاً", general: "الاستفسارات العامة", international: "التعاون الدولي" },
  }[locale];
  if (editorial) {
    text.kicker = getText(editorial.heroKicker, locale) || text.kicker;
    text.title = getText(editorial.title, locale) || text.title;
    text.intro = getText(editorial.intro, locale) || text.intro;
  }
  const channel = (purpose: ContactChannel["purpose"]) => channels.find((item) => item.purpose === purpose);
  return <div className="contactPage"><section className="pageHero"><div className="pageWidth"><div className="sectionKicker">01 / {text.kicker}</div><h1>{text.title}</h1><p>{text.intro}</p></div></section><section className="sectionPad"><div className="pageWidth contactGrid"><div><div className="sectionKicker">02 / {locale === "fa" ? "مسیرهای تماس" : locale === "ar" ? "قنوات التواصل" : "Contact channels"}</div><h2>{locale === "fa" ? "مسیر مناسب گفتگوی شما." : locale === "ar" ? "القناة المناسبة لاستفسارك." : "The right channel for your enquiry."}</h2></div><div><ContactCard title={text.sales} locale={locale} channel={channel("sales")} /><ContactCard title={text.general} locale={locale} channel={channel("general")} /><ContactCard title={text.international} locale={locale} channel={channel("international")} />{channels.length === 0 ? <p className="contactNote">{locale === "fa" ? "اطلاعات تماس پس از تأیید در این صفحه قرار می‌گیرد." : locale === "ar" ? "ستظهر بيانات التواصل هنا بعد تأكيدها." : "Contact information will appear here once confirmed."}</p> : null}</div></div></section></div>;
}

function ContactCard({ title, locale, channel }: { title: string; locale: Locale; channel?: ContactChannel }) {
  const details = channel ? [channel.phone && <a key="phone" href={`tel:${channel.phone}`} data-analytics="phone_click" data-analytics-label={channel.purpose}>{channel.phone}</a>, channel.whatsapp && <a key="whatsapp" href={channel.whatsapp.startsWith("http") ? channel.whatsapp : `https://wa.me/${channel.whatsapp.replace(/\D/g, "")}`} data-analytics="whatsapp_click" data-analytics-label={channel.purpose}>WhatsApp</a>, channel.email && <a key="email" href={`mailto:${channel.email}`} data-analytics="email_click" data-analytics-label={channel.purpose}>{channel.email}</a>].filter(Boolean) : [];
  return <div className="contactCard"><h3>{channel ? getText(channel.label, locale) : title}</h3>{channel?.availability ? <p>{channel.availability}</p> : null}{details.length ? <div className="contactDetails">{details}</div> : <div className="contactPlaceholder">{locale === "fa" ? "اطلاعات تماس هنوز در دسترس نیست." : locale === "ar" ? "بيانات التواصل غير متاحة بعد." : "Contact details are not available yet."}</div>}</div>;
}
