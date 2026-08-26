import type { Metadata } from "next";
import Link from "next/link";
import { getText, type Localized } from "@/lib/content";
import { getLegalPage } from "@/lib/content-source";
import { localizedPath, type Locale } from "@/lib/i18n";
import { buildMetadata, pageSeo } from "@/lib/seo";

const fallback: Record<Locale, { title: string; intro: string; notice: string; sections: Array<{ heading: string; body: string }> }> = {
  fa: {
    title: "حریم خصوصی، کوکی‌ها و شرایط استفاده",
    intro: "این صفحه چارچوب حقوقی اولیه وب‌سایت مندگار را توضیح می‌دهد و باید پیش از انتشار عمومی با اطلاعات نهایی شرکت، ابزارهای اندازه‌گیری و بازارهای هدف تأیید شود.",
    notice: "پیش‌نویس برای بررسی — متن حقوقی نهایی هنوز از طرف مندگار تأیید نشده است.",
    sections: [
      { heading: "حریم خصوصی", body: "در نسخه فعلی هیچ ابزار تحلیل عمومی یا رهگیری بازاریابی پیکربندی نشده است. میزبان و شبکه توزیع محتوا ممکن است داده‌های فنی درخواست‌ها را طبق شرایط خود پردازش کنند. فهرست نهایی ارائه‌دهندگان و دوره نگهداری داده باید پیش از راه‌اندازی افزوده شود." },
      { heading: "کوکی‌ها", body: "کوکی‌های ضروری ممکن است برای پیش‌نمایش امن محتوای CMS و عملکردهای پایه استفاده شوند. اگر ابزار تحلیل یا بازاریابی در آینده فعال شود، سازوکار رضایت متناسب با بازارهای انتشار نیز باید فعال شود." },
      { heading: "شرایط و حقوق رسانه", body: "تصاویر نمونه در وب‌سایت به‌روشنی مشخص شده‌اند و ادعای پروژه یا مشتری واقعی محسوب نمی‌شوند. انتشار تصاویر، ویدیوها، نشان‌ها و نقل‌قول‌های واقعی فقط پس از ثبت مجوز و وضعیت حقوقی در CMS مجاز است." },
    ],
  },
  en: {
    title: "Privacy, cookies and terms of use",
    intro: "This page explains the initial legal framework for the Mandegar website. It must be approved with the company’s final details, measurement tools and launch markets before public release.",
    notice: "Draft for review — Mandegar has not yet approved the final legal wording.",
    sections: [
      { heading: "Privacy", body: "No public analytics or marketing tracking is configured in this foundation. The hosting provider and content delivery network may process technical request data under their own terms. The final provider list and retention periods must be added before launch." },
      { heading: "Cookies", body: "Essential cookies may be used for secure CMS preview and basic website operation. If analytics or marketing tools are enabled later, consent controls appropriate to the launch markets must be enabled at the same time." },
      { heading: "Terms and media rights", body: "Sample media is clearly marked and does not represent a claim about a real project or client. Real images, video, logos and testimonials may be published only after their approval and rights status are recorded in the CMS." },
    ],
  },
  ar: {
    title: "الخصوصية وملفات الارتباط وشروط الاستخدام",
    intro: "توضح هذه الصفحة الإطار القانوني الأولي لموقع مندگار، ويجب اعتماده مع بيانات الشركة النهائية وأدوات القياس وأسواق الإطلاق قبل النشر العام.",
    notice: "مسودة للمراجعة — لم تعتمد مندگار الصياغة القانونية النهائية بعد.",
    sections: [
      { heading: "الخصوصية", body: "لا توجد حالياً أدوات تحليل عامة أو تتبع تسويقي مهيأة في هذا الإصدار. قد يعالج مزود الاستضافة وشبكة توزيع المحتوى بيانات الطلبات التقنية وفقاً لشروطهما. يجب إضافة قائمة المزودين وفترات الاحتفاظ قبل الإطلاق." },
      { heading: "ملفات الارتباط", body: "قد تستخدم ملفات ضرورية لمعاينة محتوى CMS بأمان ولتشغيل الموقع الأساسي. إذا تم تفعيل أدوات التحليل أو التسويق لاحقاً، فيجب تفعيل ضوابط الموافقة المناسبة لأسواق الإطلاق في الوقت نفسه." },
      { heading: "الشروط وحقوق الوسائط", body: "الوسائط النموذجية مميزة بوضوح ولا تمثل ادعاءً عن مشروع أو عميل حقيقي. لا تنشر الصور والفيديوهات والشعارات والشهادات الحقيقية إلا بعد تسجيل الموافقة وحالة الحقوق في CMS." },
    ],
  },
};

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const [title, description] = pageSeo[locale].legal;
  return buildMetadata({ locale, title, description, path: "legal" });
}

export default async function LegalPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const cms = await getLegalPage(locale);
  const local = fallback[locale];
  const title = cms ? getText(cms.title, locale) : local.title;
  const intro = cms ? getText(cms.intro, locale) : local.intro;
  const sections = cms?.sections.length ? cms.sections.map((section) => ({ heading: getText(section.heading, locale), body: getText(section.body, locale) })) : local.sections;
  const isApproved = cms?.status === "approved";

  return (
    <div className="legalPage">
      <section className="pageHero">
        <div className="pageWidth">
          <div className="sectionKicker">01 / Legal</div>
          <h1>{title}</h1>
          <p>{intro}</p>
          {!isApproved ? <p className="legalNotice">{local.notice}</p> : null}
        </div>
      </section>
      <section className="detailBody">
        <div className="pageWidth legalContent">
          {sections.map((section, index) => <section key={section.heading} aria-labelledby={`legal-${index}`}><h2 id={`legal-${index}`}>{section.heading}</h2><p>{section.body}</p></section>)}
          <Link prefetch={false} className="textLink" href={localizedPath(locale, "contact")}>{locale === "fa" ? "پرسش درباره این صفحه" : locale === "ar" ? "استفسار حول هذه الصفحة" : "Ask about this page"}<span aria-hidden="true">↗</span></Link>
        </div>
      </section>
    </div>
  );
}
