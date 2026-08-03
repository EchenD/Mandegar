"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { Locale } from "@/lib/i18n";
import { ScrollMotion } from "./ScrollMotion";
import { experienceState } from "./experience-state";
import { scenePhases, type ScenePhaseId } from "./scene-config";
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
  const [activePhase, setActivePhase] = useState<ScenePhaseId>("arrival");
  const [runtime, setRuntime] = useState<"pending" | "fallback" | "adaptive" | "full">("pending");
  const [loadProgress, setLoadProgress] = useState(12);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [activeZone, setActiveZone] = useState<"photo" | "game" | "touch" | null>(null);
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
    };
  }, []);

  useEffect(() => {
    experienceState.focusZone = activeZone;
    return () => {
      experienceState.focusZone = null;
    };
  }, [activeZone]);

  const handleRuntimeReady = useCallback((nextRuntime: "pending" | "fallback" | "adaptive" | "full") => {
    setRuntime(nextRuntime);
    setLoadProgress(72);
  }, []);

  const handleFirstFrame = useCallback(() => setLoadProgress(100), []);
  const handlePhaseChange = useCallback((phase: ScenePhaseId) => setActivePhase(phase), []);

  const scrollToProgress = useCallback((progress: number) => {
    const root = document.querySelector<HTMLElement>("[data-experience-root]");
    if (!root) return;
    root.dispatchEvent(new CustomEvent("mandegar:seek", { detail: { progress } }));
  }, []);

  const scrollToPhase = useCallback((phase: ScenePhaseId) => {
    const checkpoint = scenePhases.find((item) => item.id === phase);
    if (checkpoint) scrollToProgress(checkpoint.preview);
  }, [scrollToProgress]);

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

  const navItems = [
    { label: copy.navigation.projects, href: `/${locale}/projects` },
    { label: copy.navigation.services, href: `/${locale}/services` },
    { label: copy.navigation.about, href: `/${locale}/about` },
    { label: copy.navigation.contact, href: `/${locale}/contact` },
  ];

  return (
    <ScrollMotion className={styles.root} lenisEnabled={lenisEnabled} onPhaseChange={handlePhaseChange}>
      <div
        className={styles.loader}
        data-complete={loadProgress === 100 ? "true" : "false"}
        aria-live="polite"
        aria-label={`${copy.loading} ${loadProgress}%`}
      >
        <div className={styles.loaderMark} style={{ "--load-progress": `${loadProgress * 3.6}deg` } as CSSProperties}>
          <span />
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
            onRuntimeReady={handleRuntimeReady}
            onFirstFrame={handleFirstFrame}
          />
          <div className={styles.fallbackScene} aria-hidden="true">
            <span className={styles.fallbackHall} />
            <span className={styles.fallbackStage} />
            <span className={styles.fallbackScreen} />
            <span className={styles.fallbackHalo} />
            <span className={styles.fallbackTrail} />
          </div>
          <div className={styles.atmosphere} aria-hidden="true"><i /><i /><i /></div>
          <div className={styles.spatialBrand} aria-hidden="true">MANDEGAR <small>CREATING TOMORROW</small></div>
          <div className={styles.capabilityLabels} aria-hidden="true">
            <span>PHOTO / 01</span><span>GAME / 02</span><span>TOUCH / 03</span>
          </div>

          <div className={styles.copyLayer}>
            <div className={styles.arrivalSignal}>
              <span>01</span>
              <p>{copy.arrivalLabel}</p>
            </div>
            <section className={`${styles.sceneCopy} ${styles.discoveryCopy}`} data-scene-copy="discovery" data-cinematic-beat>
              <span>{copy.discoveryEyebrow}</span>
              <h1>{copy.discoveryTitle}</h1>
              <p>{copy.discoveryBody}</p>
            </section>
            <section className={`${styles.sceneCopy} ${styles.activationCopy}`} data-scene-copy="activation" data-cinematic-beat>
              <span>{copy.activationEyebrow}</span>
              <h2>{copy.activationTitle}</h2>
              <p>{copy.activationBody}</p>
            </section>
            <section className={`${styles.sceneCopy} ${styles.revealCopy}`} data-scene-copy="reveal" data-cinematic-beat>
              <span>{copy.revealEyebrow}</span>
              <h2>{copy.revealTitle}</h2>
              <p>{copy.revealBody}</p>
            </section>
            <section className={`${styles.sceneCopy} ${styles.experiencesCopy}`} data-scene-copy="experiences" data-cinematic-beat>
              <span>{copy.experiencesEyebrow}</span>
              <h2>{copy.experiencesTitle}</h2>
              <p>{copy.experiencesBody}</p>
              <div className={styles.zoneControls} aria-label={copy.experiencesTitle}>
                {(["photo", "game", "touch"] as const).map((zone, index) => (
                  <button
                    key={zone}
                    type="button"
                    data-active={activeZone === zone ? "true" : "false"}
                    onPointerEnter={() => setActiveZone(zone)}
                    onPointerLeave={() => setActiveZone(null)}
                    onFocus={() => setActiveZone(zone)}
                    onClick={() => setActiveZone(activeZone === zone ? null : zone)}
                  >
                    <small>0{index + 1}</small>{copy.zones[zone]}
                  </button>
                ))}
              </div>
            </section>
            <section className={`${styles.sceneCopy} ${styles.proofCopy}`} data-scene-copy="proof" data-cinematic-beat>
              <span>{copy.proofEyebrow}</span>
              <h2>{copy.proofTitle}</h2>
              <p>{copy.proofBody}</p>
              <div className={styles.projectStrip}>
                {projects.slice(0, 3).map((project, index) => (
                  <Link key={project.slug} href={`/${locale}/projects/${project.slug}`} className={styles.projectCard}>
                    <i style={{ backgroundImage: `url(${project.mediaSrc})` }} aria-hidden="true" />
                    <small>0{index + 1} / {project.isPlaceholder ? "DEMO" : project.eyebrow}</small>
                    <strong>{project.title}</strong>
                    <em aria-hidden="true">↗</em>
                  </Link>
                ))}
              </div>
            </section>
            <section className={`${styles.sceneCopy} ${styles.intelligenceCopy}`} data-scene-copy="intelligence" data-cinematic-beat>
              <span>{copy.intelligenceEyebrow}</span>
              <h2>{copy.intelligenceTitle}</h2>
              <p>{copy.intelligenceBody}</p>
              <svg className={styles.intelligenceMap} viewBox="0 0 420 118" aria-hidden="true">
                <path d="M18 77 C76 22 122 98 177 54 S278 22 323 61 S380 86 402 38" />
                {[18, 95, 177, 251, 323, 402].map((x, index) => <circle key={x} cx={x} cy={[77, 45, 54, 35, 61, 38][index]} r={index === 2 ? 6 : 3} />)}
              </svg>
            </section>
            <section className={`${styles.sceneCopy} ${styles.invitationCopy}`} data-scene-copy="invitation" data-cinematic-beat>
              <span>{copy.invitationEyebrow}</span>
              <h2>{copy.invitationTitle}</h2>
              <p>{copy.invitationBody}</p>
              <div className={styles.ctaRow}>
                <Link href={ctaHref} className={styles.primaryCta} data-analytics="cta_start_project">{copy.startProject}<i aria-hidden="true">↗</i></Link>
              </div>
            </section>
            <section className={`${styles.sceneCopy} ${styles.loopCopy}`} data-scene-copy="loop" data-cinematic-beat>
              <span>{copy.loopEyebrow}</span>
              <h2>{copy.loopTitle}</h2>
              <p>{copy.loopBody}</p>
              <div className={styles.ctaRow}>
                <Link href={ctaHref} className={styles.primaryCta} data-analytics="cta_start_project_loop">{copy.startProject}<i aria-hidden="true">↗</i></Link>
                <button type="button" className={styles.replayButton} onClick={() => scrollToPhase("arrival")}>{copy.replay}<i aria-hidden="true">↺</i></button>
              </div>
            </section>
          </div>

          <aside className={styles.sideDock} aria-label={locale === "en" ? "Direct navigation" : locale === "ar" ? "التنقل المباشر" : "دسترسی مستقیم"}>
            <span className={styles.sideDockLine} />
            {navItems.map((item, index) => <Link key={item.href} href={item.href}><small>0{index + 1}</small>{item.label}</Link>)}
          </aside>

          <button className={styles.soundControl} type="button" aria-pressed={soundEnabled} onClick={toggleSound}>
            <span aria-hidden="true">{soundEnabled ? "◖" : "○"}</span>
            {soundEnabled ? copy.muteSound : copy.enableSound}
          </button>

          <div className={styles.phaseRail} aria-label={locale === "en" ? "Experience phases" : locale === "ar" ? "مراحل التجربة" : "مراحل تجربه"}>
            <span className={styles.phaseTrack}><i style={{ transform: `scaleX(${Math.max(0.03, scenePhases.findIndex((phase) => phase.id === activePhase) / (scenePhases.length - 1))})` }} /></span>
            <div className={styles.phaseButtons}>
              {scenePhases.map((phase, index) => (
                <button key={phase.id} type="button" data-phase-target={phase.id} data-active={activePhase === phase.id ? "true" : "false"} onClick={() => scrollToPhase(phase.id)}>
                  <small>0{index + 1}</small><span>{copy.phases[phase.id]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.scrollCue} data-hidden={activePhase === "loop" ? "true" : "false"}>
            <span>{copy.scroll}</span><i />
          </div>
          {process.env.NODE_ENV !== "production" ? <DevTuner scrollToProgress={scrollToProgress} /> : null}
        </div>
      </div>

      <div className={styles.semanticFallback} data-semantic-fallback data-cinematic-beat>
        {["discovery", "activation", "reveal", "experiences", "proof", "intelligence", "invitation", "loop"].map((phase) => {
          const content = phase === "discovery"
            ? [copy.discoveryEyebrow, copy.discoveryTitle, copy.discoveryBody]
            : phase === "activation"
              ? [copy.activationEyebrow, copy.activationTitle, copy.activationBody]
              : phase === "reveal"
                ? [copy.revealEyebrow, copy.revealTitle, copy.revealBody]
                : phase === "experiences"
                  ? [copy.experiencesEyebrow, copy.experiencesTitle, copy.experiencesBody]
                  : phase === "proof"
                    ? [copy.proofEyebrow, copy.proofTitle, copy.proofBody]
                    : phase === "intelligence"
                      ? [copy.intelligenceEyebrow, copy.intelligenceTitle, copy.intelligenceBody]
                      : phase === "invitation"
                        ? [copy.invitationEyebrow, copy.invitationTitle, copy.invitationBody]
                        : [copy.loopEyebrow, copy.loopTitle, copy.loopBody];
          return <section key={phase}><span>{content[0]}</span><h2>{content[1]}</h2><p>{content[2]}</p>{phase === "invitation" || phase === "loop" ? <Link href={ctaHref}>{copy.startProject}</Link> : null}</section>;
        })}
      </div>
    </ScrollMotion>
  );
}

function DevTuner({ scrollToProgress }: { scrollToProgress: (progress: number) => void }) {
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lightScale, setLightScale] = useState(1);
  return (
    <div className={styles.devTuner} data-open={open ? "true" : "false"} data-dev-tuner>
      <button type="button" onClick={() => setOpen(!open)}>TUNE</button>
      {open ? <div>
        <label>Scene <input type="range" min="0" max="1" step="0.001" value={progress} onChange={(event) => { const value = Number(event.target.value); setProgress(value); scrollToProgress(value); }} /></label>
        <label>Light <input type="range" min="0.5" max="1.5" step="0.05" value={lightScale} onChange={(event) => { const value = Number(event.target.value); setLightScale(value); experienceState.lightScale = value; }} /></label>
        <span>{progress.toFixed(3)} / {lightScale.toFixed(2)}</span>
      </div> : null}
    </div>
  );
}

export type { ExperienceCopy };
