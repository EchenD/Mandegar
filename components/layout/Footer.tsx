import Link from "next/link";
import { getText } from "@/lib/content";
import type { SiteSettings } from "@/lib/content-source";
import { getUi, localizedPath, type Locale } from "@/lib/i18n";

export function Footer({ locale, settings }: { locale: Locale; settings?: SiteSettings }) {
  const copy = getUi(locale);
  const globalLine = settings?.globalLine ? getText(settings.globalLine, locale) : locale === "fa" ? "ریشه در ایران · آماده همکاری جهانی" : locale === "ar" ? "متجذرون في إيران · جاهزون للتعاون عالمياً" : "Iran-based · Ready to collaborate globally";
  const legal = locale === "fa" ? "حریم خصوصی و شرایط" : locale === "ar" ? "الخصوصية والشروط" : "Privacy and terms";
  const mediaNote = locale === "fa" ? "رسانه‌های موقت تا ورود پروژه‌های تأییدشده مشخص شده‌اند." : locale === "ar" ? "تم تمييز الوسائط المؤقتة حتى إضافة المشاريع المعتمدة." : "Temporary media remains labelled until approved project assets arrive.";
  const navigation = settings?.navigation.length ? settings.navigation.map((item) => ({ href: cmsPath(locale, item.path), label: getText(item.label, locale) })).filter((item) => item.label) : [
    { href: localizedPath(locale, "projects"), label: copy.navigation.projects },
    { href: localizedPath(locale, "services"), label: copy.navigation.services },
    { href: localizedPath(locale, "about"), label: copy.navigation.about },
    { href: localizedPath(locale, "contact"), label: copy.navigation.contact },
  ];
  return (
    <footer className="footer">
      <div className="pageWidth footerTop">
        <div>
          <div className="footerBrand"><span className="footerDot" /> MANDEGAR</div>
          <p className="footerLine">{settings?.footerLine ? getText(settings.footerLine, locale) : copy.footer}</p>
        </div>
        <div className="footerLinks">
          {navigation.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}
          {settings?.socialLinks.map((item) => <a key={item.url} href={item.url} target="_blank" rel="noreferrer">{item.label}</a>)}
        </div>
        <div className="footerMeta">
          <span>{globalLine}</span>
          <span>© {new Date().getFullYear()} Mandegar</span>
        </div>
      </div>
      <div className="pageWidth footerBottom">
        <Link href={localizedPath(locale, "legal")}>{legal}</Link>
        <span>{mediaNote}</span>
      </div>
    </footer>
  );
}

function cmsPath(locale: Locale, path: string) {
  const cleanPath = path.replace(/^\/+/, "").replace(/^(fa|en|ar)(\/|$)/, "");
  return localizedPath(locale, cleanPath);
}
