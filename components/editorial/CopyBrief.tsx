"use client";

import { useId, useRef, useState } from "react";
import styles from "./CompanyPages.module.css";

export function CopyBrief({ template, labels }: {
  template: string;
  labels: { copy: string; copied: string; fallback: string; failed: string };
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "fallback">("idle");
  const [copying, setCopying] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fieldId = useId();

  async function copy() {
    setCopying(true);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(template);
      setStatus("copied");
    } catch {
      setStatus("fallback");
      requestAnimationFrame(() => {
        textarea.current?.focus();
        textarea.current?.select();
      });
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className={styles.copyBrief}>
      <button type="button" className={styles.copyButton} onClick={copy} disabled={copying} aria-describedby={`${fieldId}-status`}>
        <span>{status === "copied" ? labels.copied : labels.copy}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></svg>
      </button>
      <p id={`${fieldId}-status`} className={styles.copyStatus} role="status" aria-live="polite">
        {status === "copied" ? labels.copied : status === "fallback" ? labels.failed : ""}
      </p>
      {status === "fallback" ? (
        <div className={styles.copyFallback}>
          <label htmlFor={fieldId}>{labels.fallback}</label>
          <textarea ref={textarea} id={fieldId} readOnly value={template} rows={9} onFocus={(event) => event.currentTarget.select()} />
        </div>
      ) : null}
    </div>
  );
}
