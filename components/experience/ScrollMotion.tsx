"use client";

import Lenis from "lenis";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { type CSSProperties, useRef } from "react";
import { experienceState } from "./experience-state";

gsap.registerPlugin(ScrollTrigger);

const storyStages = ["spark", "idea", "space", "experience", "proof", "capability", "intelligence", "trust", "memory", "invitation"];

export function ScrollMotion({ children, lenisEnabled = false }: { children: React.ReactNode; lenisEnabled?: boolean }) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const root = scope.current;
    if (!root) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
    const supportsSmooth = window.matchMedia("(pointer: fine)").matches;
    let smooth: Lenis | undefined;
    let lenisTick: ((time: number) => void) | undefined;
    let lenisScroll: (() => void) | undefined;

    if (lenisEnabled && !reduced && !saveData && supportsSmooth) {
      smooth = new Lenis({ autoRaf: false, smoothWheel: true, syncTouch: false, lerp: 0.1 });
      lenisScroll = () => ScrollTrigger.update();
      smooth.on("scroll", lenisScroll);
      lenisTick = (time) => smooth?.raf(time * 1000);
      gsap.ticker.add(lenisTick);
      gsap.ticker.lagSmoothing(0);
    }

    const syncStoryStage = () => {
      const marker = window.innerHeight * 0.46;
      const sections = Array.from(root.querySelectorAll<HTMLElement>("[data-stage]"))
        .filter((section) => getComputedStyle(section).display !== "none")
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
      let active = sections[0]?.dataset.stage || storyStages[0];
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= marker) active = section.dataset.stage || active;
      }
      root.dataset.storyStage = active;
    };

    const syncExperience = (progress: number) => {
      const safeProgress = Math.min(1, Math.max(0, progress));
      experienceState.progress = safeProgress;
      root.style.setProperty("--story-progress", safeProgress.toFixed(4));
      syncStoryStage();
    };

    const master = gsap.timeline({
      scrollTrigger: {
        trigger: root,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.7,
        invalidateOnRefresh: true,
        onUpdate: (self) => syncExperience(self.progress),
        onRefresh: (self) => syncExperience(self.progress),
      },
    });

    master
      .to(experienceState, { progress: 1, duration: 1, ease: "none" }, 0)
      .to(root, { "--scene-energy": 1, duration: 0.42, ease: "none" }, 0.08)
      .to(root, { "--scene-structure": 1, duration: 0.34, ease: "none" }, 0.2)
      .to(root, { "--scene-event": 1, duration: 0.32, ease: "none" }, 0.42)
      .to(root, { "--scene-impact": 1, duration: 0.24, ease: "none" }, 0.76);

    gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((element) => {
      gsap.fromTo(element, { opacity: 0, y: 30 }, {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: { trigger: element, start: "top 86%", once: true },
      });
    });

    syncExperience(master.scrollTrigger?.progress ?? 0);
    ScrollTrigger.refresh();

    return () => {
      if (lenisScroll) smooth?.off("scroll", lenisScroll);
      if (lenisTick) gsap.ticker.remove(lenisTick);
      smooth?.destroy();
      experienceState.progress = 0;
      root.removeAttribute("data-story-stage");
    };
  }, { scope, dependencies: [lenisEnabled] });

  return <div ref={scope} className="immersiveRoot" data-experience-root style={{ "--story-progress": 0, "--scene-energy": 0, "--scene-structure": 0, "--scene-event": 0, "--scene-impact": 0 } as CSSProperties}>{children}</div>;
}
