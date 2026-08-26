"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import type { Locale } from "@/lib/i18n";
import styles from "./AboutSystem.module.css";

type AboutSystemProps = {
  locale: Locale;
  kicker: string;
  title: string;
  body: string;
  linkLabel: string;
  href: string;
};

type ProcessItem = {
  label: string;
  shortLabel: string;
  description: string;
};

const processCopy: Record<Locale, { system: string; instruction: string; items: ProcessItem[] }> = {
  fa: {
    system: "یک مسیر یکپارچه",
    instruction: "برای کشف مسیر، روی هر بخش حرکت کنید",
    items: [
      { label: "ایده", shortLabel: "جهت", description: "تعریف ایده‌ای روشن که تمام تصمیم‌های تجربه را هم‌جهت می‌کند." },
      { label: "فضا", shortLabel: "محیط", description: "تبدیل مکان به روایتی که مخاطب آن را قدم‌به‌قدم تجربه می‌کند." },
      { label: "فناوری", shortLabel: "تعامل", description: "به‌کارگیری رسانه و فناوری در خدمت مشارکت، نه صرفاً نمایش." },
      { label: "اجرا", shortLabel: "تحویل", description: "رساندن همان ایده از طراحی تا لحظه‌ای که در فضای واقعی زنده می‌شود." },
    ],
  },
  en: {
    system: "One connected process",
    instruction: "Move through each part of the process",
    items: [
      { label: "Idea", shortLabel: "Direction", description: "A clear creative idea aligns every decision that follows." },
      { label: "Space", shortLabel: "Environment", description: "The venue becomes a story people experience one step at a time." },
      { label: "Technology", shortLabel: "Interaction", description: "Media and technology serve participation, not spectacle alone." },
      { label: "Delivery", shortLabel: "Realisation", description: "The original idea remains intact through production and the live moment." },
    ],
  },
  ar: {
    system: "مسار واحد متكامل",
    instruction: "تنقّل بين أجزاء المسار",
    items: [
      { label: "الفكرة", shortLabel: "الاتجاه", description: "فكرة إبداعية واضحة توحّد كل القرارات التي تليها." },
      { label: "المكان", shortLabel: "البيئة", description: "يتحوّل المكان إلى قصة يعيشها الجمهور خطوة بعد خطوة." },
      { label: "التقنية", shortLabel: "التفاعل", description: "تخدم الوسائط والتقنية المشاركة، لا الاستعراض وحده." },
      { label: "التنفيذ", shortLabel: "التحقيق", description: "تبقى الفكرة الأصلية حاضرة من التصميم حتى اللحظة الحية." },
    ],
  },
};

const nodePositions = [
  { x: "50%", y: "7%" },
  { x: "91%", y: "50%" },
  { x: "50%", y: "93%" },
  { x: "9%", y: "50%" },
];

type NodeStyle = CSSProperties & {
  "--node-x": string;
  "--node-y": string;
};

export function AboutSystem({ locale, kicker, title, body, linkLabel, href }: AboutSystemProps) {
  const root = useRef<HTMLElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const copy = processCopy[locale];
  const activeItem = copy.items[activeIndex];

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisible(true);
        observer.disconnect();
      },
      { threshold: 0.18 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const node = root.current;
    if (!node) return;
    const bounds = node.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    node.style.setProperty("--pointer-x", `${x * 100}%`);
    node.style.setProperty("--pointer-y", `${y * 100}%`);
    node.style.setProperty("--tilt-x", String((x - 0.5) * 2));
    node.style.setProperty("--tilt-y", String((y - 0.5) * 2));
  };

  const resetPointer = () => {
    const node = root.current;
    if (!node) return;
    node.style.setProperty("--pointer-x", "50%");
    node.style.setProperty("--pointer-y", "50%");
    node.style.setProperty("--tilt-x", "0");
    node.style.setProperty("--tilt-y", "0");
  };

  return (
    <section
      ref={root}
      className={styles.root}
      aria-labelledby="home-about-title"
      data-about-system
      data-visible={visible ? "true" : "false"}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointer}
    >
      <div className={styles.spotlight} aria-hidden="true" />
      <div className={styles.wordmark} aria-hidden="true">CONNECTED</div>

      <div className={styles.contentWidth}>
        <div className={styles.intro}>
          <span className={styles.kicker}>{kicker}</span>
          <div className={styles.heading}>
            <h2 id="home-about-title">{title}</h2>
            <div>
              <p>{body}</p>
              <Link prefetch={false} href={href}>{linkLabel} <span aria-hidden="true">↗</span></Link>
            </div>
          </div>
        </div>

        <div className={styles.systemStage}>
          <span className={styles.instruction}>{copy.instruction}</span>
          <svg className={styles.connections} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <circle cx="50" cy="50" r="34" />
            <line x1="50" y1="50" x2="50" y2="7" />
            <line x1="50" y1="50" x2="91" y2="50" />
            <line x1="50" y1="50" x2="50" y2="93" />
            <line x1="50" y1="50" x2="9" y2="50" />
          </svg>

          <div className={styles.core}>
            <small>MANDEGAR / SYSTEM</small>
            <strong>{copy.system}</strong>
            <div key={activeItem.label} className={styles.activeDetail}>
              <span>{String(activeIndex + 1).padStart(2, "0")} / 04</span>
              <h3>{activeItem.label}</h3>
              <p>{activeItem.description}</p>
            </div>
          </div>

          {copy.items.map((item, index) => (
            <button
              key={item.label}
              type="button"
              className={styles.processNode}
              style={{
                "--node-x": nodePositions[index].x,
                "--node-y": nodePositions[index].y,
              } as NodeStyle}
              data-active={index === activeIndex ? "true" : "false"}
              aria-pressed={index === activeIndex}
              onPointerEnter={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
              onClick={() => setActiveIndex(index)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{item.label}</strong>
              <small>{item.shortLabel}</small>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
