import { expect, test } from "@playwright/test";

const checkpoints = [
  { phase: "arrival", viewport: { width: 1440, height: 900 }, file: "desktop-arrival.png" },
  { phase: "discovery", viewport: { width: 1440, height: 900 }, file: "desktop-discovery.png" },
  { phase: "activation", viewport: { width: 1440, height: 900 }, file: "desktop-activation.png" },
  { phase: "reveal", viewport: { width: 1440, height: 900 }, file: "desktop-reveal.png" },
  { phase: "experiences", viewport: { width: 1440, height: 900 }, file: "desktop-experiences.png" },
  { phase: "proof", viewport: { width: 1440, height: 900 }, file: "desktop-proof.png" },
  { phase: "intelligence", viewport: { width: 1440, height: 900 }, file: "desktop-intelligence.png" },
  { phase: "invitation", viewport: { width: 1440, height: 900 }, file: "desktop-invitation.png" },
  { phase: "activation", viewport: { width: 390, height: 844 }, file: "mobile-activation.png" },
  { phase: "proof", viewport: { width: 390, height: 844 }, file: "mobile-proof.png" },
  { phase: "intelligence", viewport: { width: 390, height: 844 }, file: "mobile-intelligence.png" },
  { phase: "loop", viewport: { width: 390, height: 844 }, file: "mobile-loop.png" },
] as const;

test.describe("first vertical-slice review captures", () => {
  for (const checkpoint of checkpoints) {
    test(`${checkpoint.file} matches the named checkpoint`, async ({ page }) => {
      await page.setViewportSize(checkpoint.viewport);
      await page.goto(`/fa?phase=${checkpoint.phase}`, { waitUntil: "networkidle" });
      await expect(page.locator("[data-experience-root]")).toHaveAttribute("data-story-stage", checkpoint.phase);
      await expect(page.locator("[aria-label*='آماده‌سازی فضای نمایشگاه']")).toHaveAttribute("data-complete", "true");
      await page.addStyleTag({ content: "nextjs-portal, [data-dev-tuner] { display: none !important; }" });
      await page.waitForTimeout(700);
      await page.screenshot({ path: `test-results/vertical-slice/${checkpoint.file}`, fullPage: false });
    });
  }
});
