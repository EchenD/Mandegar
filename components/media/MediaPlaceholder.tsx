import Image from "next/image";
import type { MediaAsset } from "@/lib/content";
import type { Locale } from "@/lib/i18n";
import { getText, } from "@/lib/content";
import { AdaptiveVideo } from "./AdaptiveVideo";

export function MediaPlaceholder({ media, locale, priority = false, className = "" }: { media: MediaAsset; locale: Locale; priority?: boolean; className?: string }) {
  const alt = getText(media.alt, locale);
  const caption = media.caption ? getText(media.caption, locale) : "";
  return (
    <figure className={`mediaFrame ${className}`}>
      {media.kind === "video" ? (
        <AdaptiveVideo media={media} locale={locale} label={alt} />
      ) : (
        <>
          <Image className={media.mobileSrc ? "mediaDesktop" : undefined} src={media.src} alt={alt} fill sizes="(max-width: 760px) 100vw, 50vw" priority={priority} />
          {media.mobileSrc ? <Image className="mediaMobile" src={media.mobileSrc} alt={alt} fill sizes="100vw" priority={priority} /> : null}
        </>
      )}
      {media.isPlaceholder ? <span className="mediaNotice">{locale === "fa" ? "رسانه مفهومی" : locale === "ar" ? "وسائط مفاهيمية" : "Concept media"}</span> : null}
      {media.kind === "video-placeholder" ? <span className="videoMark">{locale === "fa" ? "طرح مفهومی ویدیو" : locale === "ar" ? "تصور للفيديو" : "Video concept"}</span> : null}
      {caption ? <figcaption className="mediaCaption">{caption}</figcaption> : null}
    </figure>
  );
}
