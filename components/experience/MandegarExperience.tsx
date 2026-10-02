"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { localizedPath, type Locale } from "@/lib/i18n";
import type { JourneyClient, JourneyVoice } from "./ConnectedJourney";
import { ExperienceIntro } from "./ExperienceIntro";
import { resetIntro } from "./intro-director";
import { ScrollMotion } from "./ScrollMotion";
import { experienceState } from "./experience-state";
import { narrativeScore, type ScenePhaseId } from "./narrative-score";
import { InteractionDirector } from "./interactions/InteractionDirector";
import { AmbientGame } from "./interactions/AmbientGame";
import { IntelligenceInspector } from "./IntelligenceInspector";
import { IntelligenceMonitor } from "./IntelligenceMonitor";
import styles from "./MandegarExperience.module.css";

const ExperienceCanvas = dynamic(
  () => import("./ExperienceCanvas").then((module) => module.ExperienceCanvas),
  { ssr: false },
);

const ConnectedJourney = dynamic(
  () => import("./ConnectedJourney").then((module) => module.ConnectedJourney),
  { ssr: false },
);

const CreativePanel = process.env.NODE_ENV === "development"
  ? dynamic(() => import("./CreativePanel").then((module) => module.CreativePanel), { ssr: false })
  : null;

type ExperienceCopy = {
  arrivalLabel: string;
  arrivalBody: string;
  discoveryEyebrow: string;
  discoveryTitle: string;
  discoveryBody: string;
  activationEyebrow: string;
  activationTitle: string;
  activationBody: string;
  engagementEyebrow: string;
  engagementTitle: string;
  engagementBody: string;
  revealEyebrow: string;
  revealTitle: string;
  revealBody: string;
  experiencesEyebrow: string;
  experiencesTitle: string;
  experiencesBody: string;
  connectionEyebrow: string;
  connectionTitle: string;
  connectionBody: string;
  proofEyebrow: string;
  proofTitle: string;
  proofBody: string;
  intelligenceEyebrow: string;
  intelligenceTitle: string;
  intelligenceBody: string;
  invitationEyebrow: string;
  invitationTitle: string;
  invitationBody: string;
  startProject: string;
  scroll: string;
  replay: string;
  enableSound: string;
  muteSound: string;
  loading: string;
  zones: { photo: string; game: string; touch: string };
  phases: Record<ScenePhaseId, string>;
  navigation: {
    projects: string;
    services: string;
    about: string;
    contact: string;
  };
};

export type ExperienceProject = {
  slug: string;
  title: string;
  eyebrow: string;
  category?: string;
  summary: string;
  mediaSrc: string;
  mediaKind?: "image" | "video" | "video-placeholder";
  mediaPoster?: string;
  gallery?: Array<{
    src: string;
    kind?: "image" | "video" | "video-placeholder";
    poster?: string;
  }>;
  year?: string;
  location?: string;
  isPlaceholder: boolean;
};

type ExperienceProps = {
  locale: Locale;
  copy: ExperienceCopy;
  ctaHref: string;
  projects?: ExperienceProject[];
  testimonials?: JourneyVoice[];
  clients?: JourneyClient[];
  enabledByCms?: boolean;
  lenisEnabled?: boolean;
};

type AudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

const postExperienceCopy = {
  fa: {
    viewWork: "مشاهده کارها",
    projectsKicker: "پروژه‌ها / منتخب",
    projectsTitle: "ایده‌ها، فضاها و تجربه‌ها را کشف کنید.",
    projectsBody: "طرح‌های مفهومی، نگاه ما به ترکیب فضا، فناوری و مردم را نشان می‌دهند.",
    viewProject: "مشاهده پروژه",
    projectsEmpty: "پروژه‌های تأییدشده پس از انتشار در این بخش نمایش داده می‌شوند.",
    aboutKicker: "درباره ما",
    aboutTitle: "ایده، فضا، فناوری و اجرا را در یک مسیر کنار هم می‌آوریم.",
    aboutBody: "ماندگار تجربه‌های رویدادی و نمایشگاهی را از نخستین ایده تا اجرای نهایی به‌صورت یکپارچه طراحی می‌کند.",
    aboutLink: "بیشتر درباره ماندگار",
    testimonialsKicker: "صدای مشتریان",
    testimonialsTitle: "تجربه همکاری، از نگاه کسانی که کنار ما بوده‌اند.",
    testimonialsPlaceholder: "نقل‌قول‌های تأییدشده مشتریان در این قسمت قرار می‌گیرند.",
  },
  en: {
    viewWork: "View work",
    projectsKicker: "Projects / Selected",
    projectsTitle: "Explore ideas, spaces and experiences.",
    projectsBody: "Concept studies show how we bring space, technology and people together.",
    viewProject: "View project",
    projectsEmpty: "Approved projects will appear here when they are published.",
    aboutKicker: "About us",
    aboutTitle: "We connect idea, space, technology and delivery in one journey.",
    aboutBody: "Mandegar designs event and exhibition experiences as one connected process, from the first idea through final delivery.",
    aboutLink: "More about Mandegar",
    testimonialsKicker: "Client voices",
    testimonialsTitle: "The experience of working together, in our clients’ words.",
    testimonialsPlaceholder: "Approved client testimonials will appear here.",
  },
  ar: {
    viewWork: "شاهد أعمالنا",
    projectsKicker: "المشاريع / مختارات",
    projectsTitle: "اكتشف الأفكار والأماكن والتجارب.",
    projectsBody: "تُظهر الدراسات المفاهيمية كيف نجمع المكان والتقنية والناس.",
    viewProject: "عرض المشروع",
    projectsEmpty: "ستظهر المشاريع المعتمدة هنا عند نشرها.",
    aboutKicker: "من نحن",
    aboutTitle: "نجمع الفكرة والمكان والتقنية والتنفيذ في رحلة واحدة.",
    aboutBody: "تصمم ماندگار تجارب الفعاليات والمعارض كمسار متكامل، من الفكرة الأولى حتى التنفيذ النهائي.",
    aboutLink: "المزيد عن ماندگار",
    testimonialsKicker: "آراء العملاء",
    testimonialsTitle: "تجربة العمل معاً، بكلمات عملائنا.",
    testimonialsPlaceholder: "ستظهر شهادات العملاء المعتمدة هنا.",
  },
} as const satisfies Record<Locale, Record<string, string>>;

export function MandegarExperience({
  locale,
  copy,
  ctaHref,
  projects = [],
  testimonials = [],
  clients = [],
  enabledByCms = true,
  lenisEnabled = false,
}: ExperienceProps) {
  const [activePhase, setActivePhase] = useState<ScenePhaseId>("arrival");
  const [runtime, setRuntime] = useState<"pending" | "fallback" | "adaptive" | "full">("pending");
  const [loadProgress, setLoadProgress] = useState(12);
  const [interactionReady, setInteractionReady] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);
  const [workReady, setWorkReady] = useState(false);
  const workJump = useRef<(() => void) | null>(null);
  const handleWorkReady = useCallback((jump: (() => void) | null) => {
    workJump.current = jump;
    setWorkReady(jump !== null);
  }, []);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [backToTopVisible, setBackToTopVisible] = useState(false);
  const audioContext = useRef<AudioContext | undefined>(undefined);
  const audioNodes = useRef<AudioNode[]>([]);
  const canvasProjects = useMemo(
    () => projects.slice(0, 3).map((project) => ({
      src: project.mediaSrc,
      label: project.title,
    })),
    [projects],
  );
  const pageCopy = postExperienceCopy[locale];
  const activePhaseIndex = Math.max(
    0,
    narrativeScore.findIndex((phase) => phase.id === activePhase),
  );
  useLayoutEffect(() => {
    const declaredRestoration = document.documentElement.dataset.mandegarPreviousScrollRestoration;
    const previousRestoration = declaredRestoration === "auto" || declaredRestoration === "manual"
      ? declaredRestoration
      : window.history.scrollRestoration;
    delete document.documentElement.dataset.mandegarPreviousScrollRestoration;
    const previousBehavior = document.documentElement.style.scrollBehavior;
    window.history.scrollRestoration = "manual";
    document.documentElement.style.scrollBehavior = "auto";

    const resetScroll = () => window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    const resetInitialScroll = () => {
      if (document.querySelector<HTMLElement>("[data-experience-root]")?.dataset.scrollSeekRequested === "true") return;
      resetScroll();
    };
    const handlePageShow = () => resetScroll();
    resetScroll();
    window.addEventListener("pageshow", handlePageShow);
    let secondFrame: number | undefined;
    const firstFrame = window.requestAnimationFrame(() => {
      resetInitialScroll();
      secondFrame = window.requestAnimationFrame(() => {
        resetInitialScroll();
        document.documentElement.style.scrollBehavior = previousBehavior;
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame !== undefined) window.cancelAnimationFrame(secondFrame);
      window.removeEventListener("pageshow", handlePageShow);
      window.history.scrollRestoration = previousRestoration;
      document.documentElement.style.scrollBehavior = previousBehavior;
    };
  }, []);

  useEffect(() => {
    const hydrationFrame = window.requestAnimationFrame(() => {
      setLoadProgress(38);
      const requestedPhase = new URLSearchParams(window.location.search).get("phase");
      const directPhase = narrativeScore.find((phase) => phase.id === requestedPhase)?.id;
      if (directPhase) setActivePhase(directPhase);
    });
    return () => {
      window.cancelAnimationFrame(hydrationFrame);
      audioNodes.current.forEach((node) => {
        if ("stop" in node) (node as OscillatorNode).stop();
        node.disconnect();
      });
      audioContext.current?.close();
      resetIntro();
    };
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    if (!interactionReady) {
      html.setAttribute("data-experience-scroll-lock", "");
      return;
    }
    const requestedPhase = new URLSearchParams(window.location.search).get("phase");
    html.removeAttribute("data-experience-scroll-lock");
    if (requestedPhase || document.querySelector<HTMLElement>("[data-experience-root]")?.dataset.scrollSeekRequested === "true") return;

    const previousBehavior = html.style.scrollBehavior;
    const resetScroll = () => {
      if (document.querySelector<HTMLElement>("[data-experience-root]")?.dataset.scrollSeekRequested === "true") return;
      html.style.scrollBehavior = "auto";
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    };
    resetScroll();
    let secondFrame: number | undefined;
    const firstFrame = window.requestAnimationFrame(() => {
      resetScroll();
      secondFrame = window.requestAnimationFrame(() => {
        resetScroll();
        html.style.scrollBehavior = previousBehavior;
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame !== undefined) window.cancelAnimationFrame(secondFrame);
      html.style.scrollBehavior = previousBehavior;
    };
  }, [interactionReady]);

  useEffect(() => () => {
    document.documentElement.removeAttribute("data-experience-scroll-lock");
  }, []);

  useEffect(() => {
    let frame: number | undefined;
    const syncBackToTop = () => {
      frame = undefined;
      const hero = document.querySelector<HTMLElement>("[data-experience-root]");
      const threshold = hero
        ? hero.offsetTop + hero.offsetHeight - window.innerHeight
        : window.innerHeight * 2;
      const visible = interactionReady && window.scrollY >= threshold;
      setBackToTopVisible((current) => current === visible ? current : visible);
    };
    const requestSync = () => {
      if (frame !== undefined) return;
      frame = window.requestAnimationFrame(syncBackToTop);
    };
    syncBackToTop();
    window.addEventListener("scroll", requestSync, { passive: true });
    window.addEventListener("resize", requestSync);
    return () => {
      window.removeEventListener("scroll", requestSync);
      window.removeEventListener("resize", requestSync);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
    };
  }, [interactionReady]);

  const handleRuntimeReady = useCallback((nextRuntime: "pending" | "fallback" | "adaptive" | "full") => {
    document.querySelector<HTMLElement>("[data-experience-root]")?.dispatchEvent(new CustomEvent("mandegar:runtime-change", {
      detail: { runtime: nextRuntime },
    }));
    setRuntime(nextRuntime);
    setLoadProgress((current) => current === 100 ? current : 72);
  }, []);

  const handleFirstFrame = useCallback(() => setLoadProgress(100), []);
  const handleIntroInteractive = useCallback(() => setInteractionReady(true), []);
  const handleIntroComplete = useCallback(() => {
    setInteractionReady(true);
    setIntroComplete(true);
  }, []);
  const handlePhaseChange = useCallback((phase: ScenePhaseId) => setActivePhase(phase), []);

  const scrollToProgress = useCallback((progress: number) => {
    const root = document.querySelector<HTMLElement>("[data-experience-root]");
    root?.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress } }));
  }, []);

  const scrollToPhase = useCallback((phase: ScenePhaseId) => {
    const checkpoint = narrativeScore.find((item) => item.id === phase);
    if (checkpoint) scrollToProgress(checkpoint.preview);
  }, [scrollToProgress]);

  const returnToTop = useCallback(() => {
    const root = document.querySelector<HTMLElement>("[data-experience-root]");
    if (root) {
      root.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress: 0 } }));
      return;
    }
    const previousBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.style.scrollBehavior = previousBehavior;
  }, []);

  const toggleSound = useCallback(async () => {
    if (soundEnabled) {
      audioNodes.current.forEach((node) => {
        if ("stop" in node) (node as OscillatorNode).stop();
        node.disconnect();
      });
      audioNodes.current = [];
      await audioContext.current?.close();
      audioContext.current = undefined;
      setSoundEnabled(false);
      return;
    }
    const Context = window.AudioContext || (window as AudioWindow).webkitAudioContext;
    if (!Context) return;
    const context = new Context();
    const master = context.createGain();
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 210;
    master.gain.setValueAtTime(0, context.currentTime);
    master.gain.linearRampToValueAtTime(0.018, context.currentTime + 1.4);
    filter.connect(master);
    master.connect(context.destination);
    const first = context.createOscillator();
    const second = context.createOscillator();
    const secondGain = context.createGain();
    first.type = "sine";
    first.frequency.value = 54;
    second.type = "sine";
    second.frequency.value = 81;
    second.detune.value = 4;
    secondGain.gain.value = 0.22;
    first.connect(filter);
    second.connect(secondGain);
    secondGain.connect(filter);
    first.start();
    second.start();
    audioContext.current = context;
    audioNodes.current = [first, second, secondGain, filter, master];
    setSoundEnabled(true);
  }, [soundEnabled]);

  return (
    <>
      <ScrollMotion className={styles.root} enabled={interactionReady} lenisEnabled={lenisEnabled} runtime={runtime} onPhaseChange={handlePhaseChange}>
      <div
        className={styles.loader}
        data-complete={loadProgress === 100 ? "true" : "false"}
        data-particle-loader="center-spark"
        role="status"
        aria-live="polite"
        aria-label={`${copy.loading} ${loadProgress}%`}
      >
        <div className={styles.loaderMark} style={{ "--load-progress": `${loadProgress * 3.6}deg` } as CSSProperties} aria-hidden="true">
          <span />
          {Array.from({ length: 7 }, (_, index) => <i key={index} />)}
        </div>
      </div>

      <div className={styles.sticky}>
        <div className={styles.sceneShell} data-runtime={runtime} data-mandegar-experience>
          <h1 className={styles.visuallyHidden}>{copy.revealTitle}</h1>
          <ExperienceCanvas
            locale={locale}
            className={styles.canvas}
            enabledByCms={enabledByCms}
            projects={canvasProjects}
            onRuntimeReady={handleRuntimeReady}
            onFirstFrame={handleFirstFrame}
          />
          <ExperienceIntro
            ready={loadProgress === 100}
            enabled={!introComplete && (runtime === "adaptive" || runtime === "full")}
            skipLabel={locale === "fa" ? "رد شدن" : locale === "ar" ? "تخطي" : "Skip intro"}
            onInteractive={handleIntroInteractive}
            onComplete={handleIntroComplete}
          />
          <div className={styles.vignette} data-scene-vignette aria-hidden="true" />

          <div className={styles.fallbackScene} aria-hidden="true">
            <span className={styles.fallbackHall} />
            <span className={styles.fallbackStage} />
            <span className={styles.fallbackScreen} />
            <span className={styles.fallbackHalo} />
            <span className={styles.fallbackTrail} />
          </div>

          <InteractionDirector locale={locale} activePhase={activePhase} runtime={runtime} />
          <AmbientGame locale={locale} enabled={runtime === "adaptive" || runtime === "full"} />
          <IntelligenceInspector locale={locale} enabled={runtime === "adaptive" || runtime === "full"} />
          <IntelligenceMonitor locale={locale} enabled={runtime === "adaptive" || runtime === "full"} />

          <div className={styles.copyLayer}>
            <section className={styles.sceneCopy} data-scene-copy="arrival" data-cinematic-beat>
              <span data-copy-line>01 / {copy.phases.arrival}</span>
              <h2 data-copy-line>{copy.arrivalLabel}</h2>
              <p data-copy-line>{copy.arrivalBody}</p>
            </section>

            <section className={styles.sceneCopy} data-scene-copy="discovery" data-cinematic-beat>
              <span data-copy-line>{copy.discoveryEyebrow}</span>
              <h2 data-copy-line>{copy.discoveryTitle}</h2>
              <p data-copy-line>{copy.discoveryBody}</p>
            </section>
            <section className={styles.sceneCopy} data-scene-copy="activation" data-cinematic-beat>
              <span data-copy-line>{copy.activationEyebrow}</span>
              <h2 data-copy-line>{copy.activationTitle}</h2>
              <p data-copy-line>{copy.activationBody}</p>
            </section>
            <section className={styles.sceneCopy} data-scene-copy="engagement" data-cinematic-beat>
              <span data-copy-line>{copy.engagementEyebrow}</span>
              <h2 data-copy-line>{copy.engagementTitle}</h2>
              <p data-copy-line>{copy.engagementBody}</p>
            </section>
            <section className={styles.sceneCopy} data-scene-copy="reveal" data-cinematic-beat>
              <span data-copy-line>{copy.revealEyebrow}</span>
              <h2 data-copy-line>{copy.revealTitle}</h2>
              <p data-copy-line>{copy.revealBody}</p>
            </section>
            <section className={styles.sceneCopy} data-scene-copy="experiences" data-cinematic-beat>
              <span data-copy-line>{copy.experiencesEyebrow}</span>
              <h2 data-copy-line>{copy.experiencesTitle}</h2>
              <p data-copy-line>{copy.experiencesBody}</p>
            </section>
            <section className={styles.sceneCopy} data-scene-copy="connection" data-cinematic-beat>
              <span data-copy-line>{copy.connectionEyebrow}</span>
              <h2 data-copy-line>{copy.connectionTitle}</h2>
              <p data-copy-line>{copy.connectionBody}</p>
            </section>
            <section className={styles.sceneCopy} data-scene-copy="proof" data-cinematic-beat>
              <span data-copy-line>{copy.proofEyebrow}</span>
              <h2 data-copy-line>{copy.proofTitle}</h2>
              <p data-copy-line>{copy.proofBody}</p>
            </section>
            <section className={styles.sceneCopy} data-scene-copy="intelligence" data-cinematic-beat>
              <span data-copy-line>{copy.intelligenceEyebrow}</span>
              <h2 data-copy-line>{copy.intelligenceTitle}</h2>
              <p data-copy-line>{copy.intelligenceBody}</p>
            </section>
            <section className={styles.sceneCopy} data-scene-copy="invitation" data-cinematic-beat>
              <span data-copy-line>{copy.invitationEyebrow}</span>
              <h2 data-copy-line>{copy.invitationTitle}</h2>
              <p data-copy-line>{copy.invitationBody}</p>
              <div className={styles.ctaRow} data-copy-line>
                <Link prefetch={false} href={ctaHref} className={styles.primaryCta} data-analytics="cta_start_project">
                  {copy.startProject}<i aria-hidden="true">↗</i>
                </Link>
              </div>
            </section>
          </div>

          <button className={styles.soundControl} type="button" aria-pressed={soundEnabled} onClick={toggleSound}>
            <span aria-hidden="true">{soundEnabled ? "◖" : "○"}</span>
            {soundEnabled ? copy.muteSound : copy.enableSound}
          </button>

          {workReady ? <button className={styles.workShortcut} type="button" data-work-shortcut onClick={() => workJump.current?.()}>
            {pageCopy.viewWork}<span aria-hidden="true">↓</span>
          </button> : null}

          <div className={styles.scrollCue} data-scroll-cue>
            <span>{copy.scroll}</span><i />
          </div>

          <div
            className={styles.phaseRail}
            data-phase-rail
            role="progressbar"
            aria-label={`${copy.scroll}: ${copy.phases[activePhase]}`}
            aria-valuemin={1}
            aria-valuemax={narrativeScore.length}
            aria-valuenow={activePhaseIndex + 1}
            aria-valuetext={`${activePhaseIndex + 1} / ${narrativeScore.length} — ${copy.phases[activePhase]}`}
          >
            <div className={styles.phaseCurrent}>
              <small>{String(activePhaseIndex + 1).padStart(2, "0")} / {String(narrativeScore.length).padStart(2, "0")}</small>
              <span dir="auto">{copy.phases[activePhase]}</span>
            </div>
            <span className={styles.phaseTrack} aria-hidden="true"><i /></span>
          </div>

          {CreativePanel ? <CreativePanel activePhase={activePhase} onSeek={scrollToPhase} /> : null}
        </div>
      </div>

      <div className={styles.semanticFallback} data-semantic-fallback data-cinematic-beat>
        {[
          [`01 / ${copy.phases.arrival}`, copy.arrivalLabel, copy.arrivalBody],
          [copy.discoveryEyebrow, copy.discoveryTitle, copy.discoveryBody],
          [copy.activationEyebrow, copy.activationTitle, copy.activationBody],
          [copy.engagementEyebrow, copy.engagementTitle, copy.engagementBody],
          [copy.revealEyebrow, copy.revealTitle, copy.revealBody],
          [copy.experiencesEyebrow, copy.experiencesTitle, copy.experiencesBody],
          [copy.connectionEyebrow, copy.connectionTitle, copy.connectionBody],
          [copy.proofEyebrow, copy.proofTitle, copy.proofBody],
          [copy.intelligenceEyebrow, copy.intelligenceTitle, locale === "en" ? "See how participation becomes useful insight." : locale === "fa" ? "ببینید مشارکت چگونه به شناخت بهتر تبدیل می‌شود." : "شاهد كيف تتحول المشاركة إلى فهم أفضل."],
          [copy.invitationEyebrow, copy.invitationTitle, copy.invitationBody],
        ].map((content, index) => (
          <section key={content[0]}>
            <span>{content[0]}</span><h2>{content[1]}</h2><p>{content[2]}</p>
            {index >= 9 ? <Link prefetch={false} href={ctaHref}>{copy.startProject}</Link> : null}
          </section>
        ))}
      </div>
      </ScrollMotion>

      <ConnectedJourney
        locale={locale}
        onWorkReady={handleWorkReady}
        projects={projects}
        voices={testimonials}
        clients={clients}
        copy={{
          projectKicker: pageCopy.projectsKicker,
          projectTitle: pageCopy.projectsTitle,
          projectBody: pageCopy.projectsBody,
          viewProject: pageCopy.viewProject,
          projectsEmpty: pageCopy.projectsEmpty,
        }}
        aboutHref={localizedPath(locale, "about")}
      />

      <button
        className={styles.backToTop}
        type="button"
        data-visible={backToTopVisible ? "true" : "false"}
        aria-label={locale === "fa" ? "بازگشت به بالا" : locale === "ar" ? "العودة إلى الأعلى" : "Back to top"}
        title={locale === "fa" ? "بازگشت به بالا" : locale === "ar" ? "العودة إلى الأعلى" : "Back to top"}
        onClick={returnToTop}
      >
        <span aria-hidden="true">↑</span>
      </button>
    </>
  );
}

export type { ExperienceCopy };
