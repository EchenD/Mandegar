import type { ReactNode } from "react";
import type { InteractionCopy } from "./interaction-copy";
import type { InteractionLifecycle, InteractionStation } from "./interaction-types";
import styles from "./HeroInteractions.module.css";

export function InteractionChrome({
  station,
  lifecycle,
  copy,
  children,
  onClose,
  onContinue,
}: {
  station: InteractionStation;
  lifecycle: InteractionLifecycle;
  copy: InteractionCopy;
  children: ReactNode;
  onClose: () => void;
  onContinue: () => void;
}) {
  const stationCopy = copy.stations[station];
  return (
    <section
      className={styles.panel}
      data-interaction-panel={station}
      data-lifecycle={lifecycle}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`interaction-title-${station}`}
    >
      <header className={styles.panelHeader}>
        <div>
          <span>{copy.preview}</span>
          <h2 id={`interaction-title-${station}`}>{stationCopy.title}</h2>
          <p>{stationCopy.instruction}</p>
        </div>
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label={copy.close}>×</button>
      </header>
      <div className={styles.experienceBody}>{children}</div>
      <footer className={styles.panelFooter}>
        <button type="button" className={styles.continueButton} onClick={onContinue}>{copy.continue}</button>
      </footer>
    </section>
  );
}
