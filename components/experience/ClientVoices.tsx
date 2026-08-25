"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import type { Locale } from "@/lib/i18n";
import styles from "./ClientVoices.module.css";

export type ClientVoice = {
  quote: string;
  person: string;
  role: string;
  organization: string;
  isPlaceholder?: boolean;
};

export type ClientMark = {
  name: string;
  logo?: string;
};

type ClientVoicesProps = {
  locale: Locale;
  kicker: string;
  title: string;
  placeholder: string;
  voices: ClientVoice[];
  clients: ClientMark[];
};

const interfaceCopy: Record<Locale, {
  approved: string;
  ready: string;
  cmsNote: string;
  clients: string;
  previous: string;
  next: string;
  choose: string;
}> = {
  fa: {
    approved: "فقط روایت‌های تأییدشده",
    ready: "آماده برای محتوای واقعی",
    cmsNote: "این بخش مستقیماً به نقل‌قول‌های تأییدشده در CMS متصل است و محتوای نمونه را به‌جای نظر مشتری نمایش نمی‌دهد.",
    clients: "مشتریان منتشرشده",
    previous: "روایت قبلی",
    next: "روایت بعدی",
    choose: "انتخاب روایت",
  },
  en: {
    approved: "Approved voices only",
    ready: "Ready for real content",
    cmsNote: "This section is connected directly to approved CMS testimonials and never presents sample copy as a client endorsement.",
    clients: "Published clients",
    previous: "Previous voice",
    next: "Next voice",
    choose: "Choose a client voice",
  },
  ar: {
    approved: "آراء معتمدة فقط",
    ready: "جاهز للمحتوى الحقيقي",
    cmsNote: "يرتبط هذا القسم مباشرة بشهادات العملاء المعتمدة في نظام المحتوى، ولا يعرض نصاً تجريبياً كتوصية حقيقية.",
    clients: "العملاء المنشورون",
    previous: "الرأي السابق",
    next: "الرأي التالي",
    choose: "اختر رأي عميل",
  },
};

const sampleVoices: Record<Locale, ClientVoice[]> = {
  fa: [
    {
      quote: "در این قاب، یک نقل‌قول تأییدشده درباره وضوح ایده و مسیر خلاق قرار می‌گیرد.",
      person: "",
      role: "پیش‌نمایش چیدمان / ۰۱",
      organization: "",
      isPlaceholder: true,
    },
    {
      quote: "این قاب برای روایت واقعی مشتری از همکاری، ارتباط و روند تصمیم‌گیری آماده شده است.",
      person: "",
      role: "پیش‌نمایش چیدمان / ۰۲",
      organization: "",
      isPlaceholder: true,
    },
    {
      quote: "اینجا نتیجه‌ای که مشتری اجازه انتشار آن را داده است، با نام و جایگاه واقعی او نمایش داده می‌شود.",
      person: "",
      role: "پیش‌نمایش چیدمان / ۰۳",
      organization: "",
      isPlaceholder: true,
    },
  ],
  en: [
    {
      quote: "An approved quote about creative clarity will take this position in the final content.",
      person: "",
      role: "Layout preview / 01",
      organization: "",
      isPlaceholder: true,
    },
    {
      quote: "This frame is ready for a real client’s account of collaboration, communication and decisions.",
      person: "",
      role: "Layout preview / 02",
      organization: "",
      isPlaceholder: true,
    },
    {
      quote: "A client-approved outcome will appear here with the real person, role and organisation.",
      person: "",
      role: "Layout preview / 03",
      organization: "",
      isPlaceholder: true,
    },
  ],
  ar: [
    {
      quote: "سيظهر هنا اقتباس معتمد عن وضوح الفكرة والاتجاه الإبداعي.",
      person: "",
      role: "معاينة التخطيط / ٠١",
      organization: "",
      isPlaceholder: true,
    },
    {
      quote: "هذا الإطار جاهز لرواية عميل حقيقية عن التعاون والتواصل واتخاذ القرار.",
      person: "",
      role: "معاينة التخطيط / ٠٢",
      organization: "",
      isPlaceholder: true,
    },
    {
      quote: "ستظهر هنا نتيجة وافق العميل على نشرها مع الاسم والدور والجهة الحقيقية.",
      person: "",
      role: "معاينة التخطيط / ٠٣",
      organization: "",
      isPlaceholder: true,
    },
  ],
};

type SignalStyle = CSSProperties & { "--signal-index": number };

export function ClientVoices({ locale, kicker, title, placeholder, voices, clients }: ClientVoicesProps) {
  const root = useRef<HTMLElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const copy = interfaceCopy[locale];
  const hasApprovedVoices = voices.length > 0;
  const displayVoices = hasApprovedVoices ? voices : sampleVoices[locale];
  const safeActiveIndex = Math.min(activeIndex, displayVoices.length - 1);
  const activeVoice = displayVoices[safeActiveIndex];

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisible(true);
        observer.disconnect();
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const move = (direction: number) => {
    if (displayVoices.length < 2) return;
    setActiveIndex((current) => (current + direction + displayVoices.length) % displayVoices.length);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const node = root.current;
    if (!node) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    node.style.setProperty("--voice-x", `${x * 100}%`);
    node.style.setProperty("--voice-y", `${y * 100}%`);
    node.style.setProperty("--voice-tilt-x", String((x - 0.5) * 2));
    node.style.setProperty("--voice-tilt-y", String((y - 0.5) * 2));
  };

  const resetPointer = () => {
    const node = root.current;
    if (!node) return;
    node.style.setProperty("--voice-x", "50%");
    node.style.setProperty("--voice-y", "50%");
    node.style.setProperty("--voice-tilt-x", "0");
    node.style.setProperty("--voice-tilt-y", "0");
  };

  return (
    <section
      ref={root}
      className={styles.root}
      aria-labelledby="home-testimonials-title"
      data-client-voices
      data-visible={visible ? "true" : "false"}
      data-empty={hasApprovedVoices ? "false" : "true"}
    >
      <div className={styles.contentWidth}>
        <header className={styles.header}>
          <span>{kicker}</span>
          <div>
            <h2 id="home-testimonials-title">{title}</h2>
            <small><i /> {copy.approved}</small>
          </div>
        </header>

        <div className={styles.voiceStage} onPointerMove={handlePointerMove} onPointerLeave={resetPointer}>
          <div className={styles.stageGlow} aria-hidden="true" />
          <div className={styles.signal} aria-hidden="true">
            {Array.from({ length: 18 }, (_, index) => (
              <i key={index} style={{ "--signal-index": index } as SignalStyle} />
            ))}
          </div>
          <div className={styles.ghostCard} aria-hidden="true" />
          <div className={styles.ghostCard} aria-hidden="true" />

          <article key={`${activeVoice.role}-${safeActiveIndex}`} className={styles.voiceCard} data-sample={activeVoice.isPlaceholder ? "true" : "false"}>
            <div className={styles.quoteMark} aria-hidden="true">“</div>
            {!activeVoice.isPlaceholder ? (
              <>
                <blockquote>{activeVoice.quote}</blockquote>
                <footer>
                  <span>{activeVoice.person}</span>
                  <small>{[activeVoice.role, activeVoice.organization].filter(Boolean).join(" / ")}</small>
                </footer>
              </>
            ) : (
              <div className={styles.emptyVoice}>
                <span>{activeVoice.role || copy.ready}</span>
                <blockquote>{activeVoice.quote || placeholder}</blockquote>
                <p>{copy.cmsNote}</p>
              </div>
            )}
          </article>

          <div className={styles.stageIndex} aria-hidden="true">
            <strong>{String(safeActiveIndex + 1).padStart(2, "0")}</strong>
            <span>/ {String(displayVoices.length).padStart(2, "0")}</span>
          </div>

          {displayVoices.length > 1 ? (
            <div className={styles.controls}>
              <button type="button" onClick={() => move(-1)} aria-label={copy.previous}>←</button>
              <div role="group" aria-label={copy.choose}>
                {displayVoices.map((voice, index) => (
                  <button
                    key={`${voice.person}-${index}`}
                    type="button"
                    data-active={index === safeActiveIndex ? "true" : "false"}
                    aria-label={voice.person || `${index + 1}`}
                    onClick={() => setActiveIndex(index)}
                  />
                ))}
              </div>
              <button type="button" onClick={() => move(1)} aria-label={copy.next}>→</button>
            </div>
          ) : null}
        </div>

        {clients.length ? (
          <div className={styles.clientRail} aria-label={copy.clients}>
            <span>{copy.clients}</span>
            <div>
              {clients.map((client) => (
                <div key={client.name} className={styles.clientMark}>
                  {client.logo ? (
                    <Image src={client.logo} alt={client.name} width={132} height={48} sizes="132px" />
                  ) : (
                    <strong>{client.name}</strong>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
