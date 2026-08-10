"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { Locale } from "@/lib/i18n";
import { ExperienceIntro } from "./ExperienceIntro";
import { resetIntro } from "./intro-director";
import { ScrollMotion } from "./ScrollMotion";
import { experienceState } from "./experience-state";
import { narrativeScore, type ScenePhaseId } from "./narrative-score";
import styles from "./MandegarExperience.module.css";

const ExperienceCanvas = dynamic(
  () => import("./ExperienceCanvas").then((module) => module.ExperienceCanvas),
  { ssr: false },
);

type ExperienceCopy = {
  arrivalLabel: string;
  discoveryEyebrow: string;
  discoveryTitle: string;
  discoveryBody: string;
  activationEyebrow: string;
  activationTitle: string;
  activationBody: string;
  revealEyebrow: string;
  revealTitle: string;
  revealBody: string;
  experiencesEyebrow: string;
  experiencesTitle: string;
  experiencesBody: string;
  proofEyebrow: string;
  proofTitle: string;
  proofBody: string;
  intelligenceEyebrow: string;
  intelligenceTitle: string;
  intelligenceBody: string;
  invitationEyebrow: string;
  invitationTitle: string;
  invitationBody: string;
  loopEyebrow: string;
  loopTitle: string;
  loopBody: string;
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
  summary: string;
  mediaSrc: string;
  isPlaceholder: boolean;
};

type ExperienceProps = {
  locale: Locale;
  copy: ExperienceCopy;
  ctaHref: string;
  projects?: ExperienceProject[];
  enabledByCms?: boolean;
  lenisEnabled?: boolean;
};

type AudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

export function MandegarExperience({ locale, copy, ctaHref, projects = [], enabledByCms = true, lenisEnabled = false }: ExperienceProps) {
  const router = useRouter();
  const [activePhase, setActivePhase] = useState<ScenePhaseId>("arrival");
  const [runtime, setRuntime] = useState<"pending" | "fallback" | "adaptive" | "full">("pending");
  const [loadProgress, setLoadProgress] = useState(12);
  const [interactionReady, setInteractionReady] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioContext = useRef<AudioContext | undefined>(undefined);
  const audioNodes = useRef<AudioNode[]>([]);

  useEffect(() => {
    const hydrationFrame = window.requestAnimationFrame(() => setLoadProgress(38));
    return () => {
      window.cancelAnimationFrame(hydrationFrame);
      audioNodes.current.forEach((node) => {
        if ("stop" in node) (node as OscillatorNode).stop();
        node.disconnect();
      });
      audioContext.current?.close();
      resetIntro();
      experienceState.focusZone = null;
      experienceState.focusProject = null;
    };
  }, []);

  useEffect(() => {
    document.documentElement.style.removeProperty("overflow");
    document.documentElement.toggleAttribute("data-experience-scroll-lock", !interactionReady);
    return () => {
      document.documentElement.removeAttribute("data-experience-scroll-lock");
    };
  }, [interactionReady]);

  const handleRuntimeReady = useCallback((nextRuntime: "pending" | "fallback" | "adaptive" | "full") => {
    setRuntime(nextRuntime);
    setLoadProgress(72);
  }, []);

  const handleFirstFrame = useCallback(() => setLoadProgress(100), []);
  const handleIntroInteractive = useCallback(() => setInteractionReady(true), []);
  const handleIntroComplete = useCallback(() => setInteractionReady(true), []);
  const handlePhaseChange = useCallback((phase: ScenePhaseId) => setActivePhase(phase), []);

  const scrollToProgress = useCallback((progress: number) => {
    const root = document.querySelector<HTMLElement>("[data-experience-root]");
    root?.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress } }));
  }, []);

  const scrollToPhase = useCallback((phase: ScenePhaseId) => {
    const checkpoint = narrativeScore.find((item) => item.id === phase);
    if (checkpoint) scrollToProgress(checkpoint.preview);
  }, [scrollToProgress]);

  const selectProject = useCallback((index: number) => {
    const project = projects[index];
    if (project) router.push(`/${locale}/projects/${project.slug}`);
  }, [locale, projects, router]);

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
    <ScrollMotion className={styles.root} enabled={interactionReady} lenisEnabled={lenisEnabled} onPhaseChange={handlePhaseChange}>
      <div
        className={styles.loader}
        data-complete={loadProgress === 100 ? "true" : "false"}
        data-particle-loader="center-spark"
        aria-live="polite"
        aria-label={`${copy.loading} ${loadProgress}%`}
      >
        <div className={styles.loaderMark} style={{ "--load-progress": `${loadProgress * 3.6}deg` } as CSSProperties} aria-hidden="true">
          <span />
          {Array.from({ length: 7 }, (_, index) => <i key={index} />)}
        </div>
        <div className={styles.loaderMeta}>
          <span>MANDEGAR / EXHIBITION WORLD</span>
          <b>{String(loadProgress).padStart(3, "0")}</b>
        </div>
      </div>

      <div className={styles.sticky}>
        <div className={styles.sceneShell} data-runtime={runtime} data-mandegar-experience>
          <h1 className={styles.visuallyHidden}>{copy.revealTitle}</h1>
          <ExperienceCanvas
            className={styles.canvas}
            enabledByCms={enabledByCms}
            projects={projects.slice(0, 3).map((project) => ({ src: project.mediaSrc, label: project.title }))}
            zoneLabels={{ photo: copy.zones.photo, game: copy.zones.game }}
            onProjectSelect={selectProject}
            onRuntimeReady={handleRuntimeReady}
            onFirstFrame={handleFirstFrame}
          />
          <ExperienceIntro
            ready={loadProgress === 100}
            enabled={runtime === "adaptive" || runtime === "full"}
            skipLabel={locale === "fa" ? "رد شدن" : locale === "ar" ? "تخطي" : "Skip intro"}
            onInteractive={handleIntroInteractive}
            onComplete={handleIntroComplete}
          />

          <div className={styles.fallbackScene} aria-hidden="true">
            <span className={styles.fallbackHall} />
            <span className={styles.fallbackStage} />
            <span className={styles.fallbackScreen} />
            <span className={styles.fallbackHalo} />
            <span className={styles.fallbackTrail} />
          </div>

          <div className={styles.copyLayer}>
            <div className={styles.arrivalSignal} data-arrival-signal>
              <span>01</span>
              <p>{copy.arrivalLabel}</p>
            </div>

            <section className={`${styles.sceneCopy} ${styles.discoveryCopy}`} data-scene-copy="discovery" data-cinematic-beat>
              <span data-copy-line>{copy.discoveryEyebrow}</span>
              <h2 data-copy-line>{copy.discoveryTitle}</h2>
              <p data-copy-line>{copy.discoveryBody}</p>
            </section>
            <section className={`${styles.sceneCopy} ${styles.activationCopy}`} data-scene-copy="activation" data-cinematic-beat>
              <span data-copy-line>{copy.activationEyebrow}</span>
              <h2 data-copy-line>{copy.activationTitle}</h2>
              <p data-copy-line>{copy.activationBody}</p>
            </section>
            <section className={`${styles.sceneCopy} ${styles.revealCopy}`} data-scene-copy="reveal" data-cinematic-beat>
              <span data-copy-line>{copy.revealEyebrow}</span>
              <h2 data-copy-line>{copy.revealTitle}</h2>
              <p data-copy-line>{copy.revealBody}</p>
            </section>
            <section className={`${styles.sceneCopy} ${styles.experiencesCopy}`} data-scene-copy="experiences" data-cinematic-beat>
              <span data-copy-line>{copy.experiencesEyebrow}</span>
              <h2 data-copy-line>{copy.experiencesTitle}</h2>
              <p data-copy-line>{copy.experiencesBody}</p>
            </section>
            <section className={`${styles.sceneCopy} ${styles.proofCopy}`} data-scene-copy="proof" data-cinematic-beat>
              <span data-copy-line>{copy.proofEyebrow}</span>
              <h2 data-copy-line>{copy.proofTitle}</h2>
              <p data-copy-line>{copy.proofBody}</p>
            </section>
            <section className={`${styles.sceneCopy} ${styles.intelligenceCopy}`} data-scene-copy="intelligence" data-cinematic-beat>
              <span data-copy-line>{copy.intelligenceEyebrow}</span>
              <h2 data-copy-line>{copy.intelligenceTitle}</h2>
              <p data-copy-line>{copy.intelligenceBody}</p>
            </section>
            <section className={`${styles.sceneCopy} ${styles.invitationCopy}`} data-scene-copy="invitation" data-cinematic-beat>
              <span data-copy-line>{copy.invitationEyebrow}</span>
              <h2 data-copy-line>{copy.invitationTitle}</h2>
              <p data-copy-line>{copy.invitationBody}</p>
              <div className={styles.ctaRow} data-copy-line>
                <Link href={ctaHref} className={styles.primaryCta} data-analytics="cta_start_project">
                  {copy.startProject}<i aria-hidden="true">↗</i>
                </Link>
              </div>
            </section>
            <section className={`${styles.sceneCopy} ${styles.loopCopy}`} data-scene-copy="loop" data-cinematic-beat>
              <span data-copy-line>{copy.loopEyebrow}</span>
              <h2 data-copy-line>{copy.loopTitle}</h2>
              <p data-copy-line>{copy.loopBody}</p>
              <div className={styles.ctaRow} data-copy-line>
                <Link href={ctaHref} className={styles.primaryCta} data-analytics="cta_start_project_loop">
                  {copy.startProject}<i aria-hidden="true">↗</i>
                </Link>
              </div>
            </section>
          </div>

          <nav className={styles.sceneA11y} aria-label={copy.experiencesTitle}>
            {(["photo", "game", "touch"] as const).map((zone) => (
              <button
                key={zone}
                type="button"
                onFocus={() => { experienceState.focusZone = zone; }}
                onBlur={() => { experienceState.focusZone = null; }}
              >
                {copy.zones[zone]}
              </button>
            ))}
            {projects.slice(0, 3).map((project) => (
              <Link key={project.slug} href={`/${locale}/projects/${project.slug}`}>{project.title}</Link>
            ))}
          </nav>

          <button className={styles.soundControl} type="button" aria-pressed={soundEnabled} onClick={toggleSound}>
            <span aria-hidden="true">{soundEnabled ? "◖" : "○"}</span>
            {soundEnabled ? copy.muteSound : copy.enableSound}
          </button>

          <div className={styles.phaseRail} data-phase-rail aria-label={locale === "en" ? "Experience phases" : locale === "ar" ? "مراحل التجربة" : "مراحل تجربه"}>
            <span className={styles.phaseTrack}>
              <i />
            </span>
            <div className={styles.phaseButtons}>
              {narrativeScore.map((phase, index) => (
                <button key={phase.id} type="button" data-phase-target={phase.id} data-active={activePhase === phase.id ? "true" : "false"} onClick={() => scrollToPhase(phase.id)}>
                  <small>0{index + 1}</small><span>{copy.phases[phase.id]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.scrollCue}>
            <span>{copy.scroll}</span><i />
          </div>
        </div>
      </div>

      <div className={styles.semanticFallback} data-semantic-fallback data-cinematic-beat>
        {[
          [copy.discoveryEyebrow, copy.discoveryTitle, copy.discoveryBody],
          [copy.activationEyebrow, copy.activationTitle, copy.activationBody],
          [copy.revealEyebrow, copy.revealTitle, copy.revealBody],
          [copy.experiencesEyebrow, copy.experiencesTitle, copy.experiencesBody],
          [copy.proofEyebrow, copy.proofTitle, copy.proofBody],
          [copy.intelligenceEyebrow, copy.intelligenceTitle, copy.intelligenceBody],
          [copy.invitationEyebrow, copy.invitationTitle, copy.invitationBody],
          [copy.loopEyebrow, copy.loopTitle, copy.loopBody],
        ].map((content, index) => (
          <section key={content[0]}>
            <span>{content[0]}</span><h2>{content[1]}</h2><p>{content[2]}</p>
            {index >= 6 ? <Link href={ctaHref}>{copy.startProject}</Link> : null}
          </section>
        ))}
      </div>
    </ScrollMotion>
  );
}

export type { ExperienceCopy };
