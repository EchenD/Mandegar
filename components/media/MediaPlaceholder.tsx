import Image from "next/image";
import type { MediaAsset } from "@/lib/content";
import type { Locale } from "@/lib/i18n";
import { getText, } from "@/lib/content";

export function MediaPlaceholder({ media, locale, priority = false, className = "" }: { media: MediaAsset; locale: Locale; priority?: boolean; className?: string }) {
  return (
    <div className={`mediaFrame ${className}`}>
      <Image src={media.src} alt={getText(media.alt, locale)} fill sizes="(max-width: 760px) 100vw, 50vw" priority={priority} />
      {media.isPlaceholder ? <span className="mediaNotice">{locale === "fa" ? "تصویر نمونه" : locale === "ar" ? "صورة نموذجية" : "Sample image"}</span> : null}
      {media.kind === "video-placeholder" ? <span className="videoMark">VIDEO / PLACEHOLDER</span> : null}
    </div>
  );
}
