"use client";

import { useCallback, useEffect, useState } from "react";
import { directNarrative } from "./narrative-director";
import { narrativeScore, type ScenePhaseId } from "./narrative-score";
import {
  applyCreativeStagePresetSnapshot,
  getCreativeStagePresetSnapshot,
  getStageTuning,
  resetCreativeStageTuning,
  setCreativeStageTuning,
  type StageTuning,
} from "./stage-presets";
import styles from "./CreativePanel.module.css";

const storageKey = "mandegar:creative-stage-presets:v1";

const controlGroups: Array<{
  label: string;
  controls: Array<{ key: keyof StageTuning; label: string }>;
}> = [
  {
    label: "Camera",
    controls: [
      { key: "cameraLife", label: "Breathing" },
      { key: "cameraPointer", label: "Pointer" },
    ],
  },
  {
    label: "Particles",
    controls: [
      { key: "particlePresence", label: "Presence" },
      { key: "particleResponse", label: "Response" },
      { key: "particleSignal", label: "Signal" },
      { key: "particleHalo", label: "Halo" },
    ],
  },
  {
    label: "World",
    controls: [
      { key: "lightEnergy", label: "Light energy" },
      { key: "lightContrast", label: "Contrast" },
      { key: "spatialProminence", label: "HUD" },
    ],
  },
  {
    label: "Section reveal",
    controls: [
      { key: "centralReveal", label: "Central" },
      { key: "leftReveal", label: "Left" },
      { key: "rightReveal", label: "Right" },
      { key: "revealEdgeWidth", label: "Edge width" },
      { key: "revealTurbulence", label: "Edge turbulence" },
    ],
  },
  {
    label: "Baked texture mix",
    controls: [
      { key: "environmentPeak", label: "Environment" },
      { key: "centralPeak", label: "Central" },
      { key: "leftPeak", label: "Left" },
      { key: "rightPeak", label: "Right" },
    ],
  },
  {
    label: "Screens",
    controls: [
      { key: "interactiveScreen", label: "Interactive" },
      { key: "gameScreen", label: "Game" },
      { key: "videoWallScreen", label: "Video wall" },
      { key: "mainScreen", label: "Main" },
    ],
  },
  {
    label: "Transition FX",
    controls: [
      { key: "transitionParticles", label: "Particle strength" },
      { key: "transitionParticleSize", label: "Particle size" },
      { key: "transitionTurbulence", label: "Particle motion" },
      { key: "crowdPresence", label: "Crowd" },
      { key: "dataFlow", label: "Data flow" },
    ],
  },
];

function saveSnapshot() {
  window.localStorage.setItem(storageKey, JSON.stringify(getCreativeStagePresetSnapshot()));
}

function refreshCurrentNarrativeFrame() {
  const root = document.querySelector<HTMLElement>("[data-experience-root]");
  const progress = Number(root?.dataset.narrativeProgress ?? 0);
  directNarrative(Number.isFinite(progress) ? progress : 0);
}

export function CreativePanel({
  activePhase,
  onSeek,
}: {
  activePhase: ScenePhaseId;
  onSeek: (phase: ScenePhaseId) => void;
}) {
  const visible = new URLSearchParams(window.location.search).get("creative") === "1";
  const [collapsed, setCollapsed] = useState(false);
  const [, setRevision] = useState(0);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (!visible) return;
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      try {
        applyCreativeStagePresetSnapshot(JSON.parse(stored));
      } catch {
        window.localStorage.removeItem(storageKey);
      }
    }
    const frame = window.requestAnimationFrame(refreshCurrentNarrativeFrame);
    return () => window.cancelAnimationFrame(frame);
  }, [visible]);

  const values = getStageTuning(activePhase);

  const handleChange = useCallback((key: keyof StageTuning, value: number) => {
    setCreativeStageTuning(activePhase, key, value);
    saveSnapshot();
    refreshCurrentNarrativeFrame();
    setRevision((current) => current + 1);
  }, [activePhase]);

  const selectPhase = useCallback((phase: ScenePhaseId) => {
    onSeek(phase);
  }, [onSeek]);

  const resetStage = useCallback(() => {
    resetCreativeStageTuning(activePhase);
    saveSnapshot();
    refreshCurrentNarrativeFrame();
    setRevision((current) => current + 1);
  }, [activePhase]);

  const resetAll = useCallback(() => {
    resetCreativeStageTuning();
    window.localStorage.removeItem(storageKey);
    refreshCurrentNarrativeFrame();
    setRevision((current) => current + 1);
  }, []);

  const copyPreset = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(getCreativeStagePresetSnapshot(), null, 2));
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    window.setTimeout(() => setCopyState("idle"), 1400);
  }, []);

  if (!visible) return null;

  return (
    <aside
      className={styles.panel}
      data-creative-panel
      data-collapsed={collapsed ? "true" : "false"}
      dir="ltr"
      aria-label="Creative stage controls"
      onWheel={(event) => event.stopPropagation()}
    >
      <header className={styles.header}>
        <div><small>MANDEGAR / DEV</small><strong>Creative controls</strong></div>
        <button type="button" onClick={() => setCollapsed((current) => !current)} aria-expanded={!collapsed}>
          {collapsed ? "+" : "−"}
        </button>
      </header>

      <div className={styles.body}>
        <label className={styles.stageSelect}>
          <span>Review stage</span>
          <select value={activePhase} onChange={(event) => selectPhase(event.target.value as ScenePhaseId)}>
            {narrativeScore.map((stage, index) => (
              <option key={stage.id} value={stage.id}>{String(index + 1).padStart(2, "0")} — {stage.id}</option>
            ))}
          </select>
        </label>

        {controlGroups.map((group) => (
          <fieldset key={group.label}>
            <legend>{group.label}</legend>
            {group.controls.map((control) => (
              <label className={styles.control} key={control.key}>
                <span>{control.label}<output>{values[control.key].toFixed(2)}</output></span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={values[control.key]}
                  onChange={(event) => handleChange(control.key, Number(event.target.value))}
                />
              </label>
            ))}
          </fieldset>
        ))}

        <footer className={styles.actions}>
          <button type="button" onClick={copyPreset}>{copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy JSON"}</button>
          <button type="button" onClick={resetStage}>Reset stage</button>
          <button type="button" onClick={resetAll}>Reset all</button>
        </footer>
        <p>Saved locally. Copy JSON before moving approved values into <code>stage-presets.ts</code>.</p>
      </div>
    </aside>
  );
}
