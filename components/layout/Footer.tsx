import Link from "next/link";
import { getUi, localizedPath, type Locale } from "@/lib/i18n";

export function Footer({ locale }: { locale: Locale }) {
  const copy = getUi(locale);
  return (
    <footer className="footer section-pad">
      <div className="footerTop">
        <div>
          <div className="footerBrand"><span className="footerDot" /> MANDEGAR</div>
          <p className="footerLine">{copy.footer}</p>
        </div>
        <div className="footerLinks">
          <Link href={localizedPath(locale, "projects")}>{copy.navigation.projects}</Link>
          <Link href={localizedPath(locale, "services")}>{copy.navigation.services}</Link>
          <Link href={localizedPath(locale, "about")}>{copy.navigation.about}</Link>
          <Link href={localizedPath(locale, "contact")}>{copy.navigation.contact}</Link>
        </div>
        <div className="footerMeta">
          <span>Iran-based · Ready to collaborate globally</span>
          <span>© {new Date().getFullYear()} Mandegar</span>
        </div>
      </div>
      <div className="footerBottom">
        <span>CMS-ready editorial foundation</span>
        <span>Temporary media is clearly marked until real project assets arrive.</span>
      </div>
    </footer>
  );
}
