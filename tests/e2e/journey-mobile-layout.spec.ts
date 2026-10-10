import { expect, test, type Page } from "@playwright/test";

test.setTimeout(180_000);

const partnerLabels = { fa: "همراهان ما", en: "Partners", ar: "شركاؤنا" };

async function waitForJourney(page: Page) {
  await expect(page.locator("[data-loading-progress]")).toHaveAttribute("data-loading-progress", "100", { timeout: 90_000 });
  const journey = page.locator("[data-connected-journey]");
  await expect(journey).toBeAttached();
  return journey;
}

async function seekJourney(page: Page, label: string) {
  const journey = page.locator("[data-connected-journey]");
  await expect(journey).toHaveAttribute("data-journey-labels", /\S/, { timeout: 45_000 });
  await journey.evaluate((node, nextLabel) => node.dispatchEvent(new CustomEvent("mandegar:journey-seek", {
    detail: { label: nextLabel, focus: true },
  })), label);
}

async function expectCardsClearBottomControl(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const button = document.querySelector<HTMLElement>("button[class*='backToTop']")!.getBoundingClientRect();
    const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-partner-card]"))
      .filter((card) => Number(getComputedStyle(card).opacity) > .5)
      .map((card) => card.getBoundingClientRect())
      .filter((card) => card.right > button.left && card.left < button.right);
    return Math.min(...cards.map((card) => button.top - card.bottom));
  })).toBeGreaterThanOrEqual(8);
}

async function expectFoldCentered(page: Page) {
  await seekJourney(page, "PartnersFold");
  await expect.poll(() => page.locator("[data-partner-card='0']").evaluate((card) => {
    const bounds = card.getBoundingClientRect();
    const stage = card.closest("[data-partners]")!.getBoundingClientRect();
    return Math.max(
      Math.abs(bounds.x + bounds.width / 2 - stage.x - stage.width / 2),
      Math.abs(bounds.y + bounds.height / 2 - stage.y - stage.height / 2),
    );
  })).toBeLessThanOrEqual(2);
}

async function expectFinaleTitleOnOneLine(page: Page) {
  const title = page.locator("[data-final-title]");
  await expect(title).toHaveText(await title.getAttribute("aria-label") ?? "");
  const caret = title.locator("i[aria-hidden='true']");
  await expect(caret).toHaveCount(1);
  const layout = await title.evaluate((heading) => {
    const bounds = heading.getBoundingClientRect();
    const text = heading.querySelector<HTMLElement>("[data-finale-title-text]")!;
    const cursor = heading.querySelector<HTMLElement>("i")!.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(text);
    const lines = Array.from(range.getClientRects());
    const textBounds = range.getBoundingClientRect();
    return {
      lineTopSpread: Math.max(...lines.map((line) => line.top)) - Math.min(...lines.map((line) => line.top)),
      left: Math.min(textBounds.left, cursor.left) - bounds.left,
      right: bounds.right - Math.max(textBounds.right, cursor.right),
      viewportLeft: Math.min(textBounds.left, cursor.left),
      viewportRight: innerWidth - Math.max(textBounds.right, cursor.right),
      caretCenter: cursor.top + cursor.height / 2,
      textTop: textBounds.top,
      textBottom: textBounds.bottom,
      caretGap: Math.min(Math.abs(cursor.left - textBounds.right), Math.abs(textBounds.left - cursor.right)),
    };
  });
  expect(layout.lineTopSpread).toBeLessThanOrEqual(2);
  expect(layout.left).toBeGreaterThanOrEqual(-1);
  expect(layout.right).toBeGreaterThanOrEqual(-1);
  expect(layout.viewportLeft).toBeGreaterThanOrEqual(0);
  expect(layout.viewportRight).toBeGreaterThanOrEqual(0);
  expect(layout.caretCenter).toBeGreaterThanOrEqual(layout.textTop);
  expect(layout.caretCenter).toBeLessThanOrEqual(layout.textBottom);
  expect(layout.caretGap).toBeLessThanOrEqual(8);
}

for (const [locale, viewport] of [
  ["fa", { width: 320, height: 568 }],
  ["en", { width: 390, height: 844 }],
  ["ar", { width: 360, height: 640 }],
] as const) {
  test(`${locale} partners and finale leave clear space for text at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto(`/${locale}?intro=0#partners`, { waitUntil: "domcontentloaded" });
    const journey = await waitForJourney(page);
    const partners = journey.locator("[data-partners]");
    const heading = partners.locator("[data-partner-center]");
    await expect(partners).toBeFocused({ timeout: 45_000 });
    await expect(heading.locator("[data-partner-center-text]")).toHaveText(partnerLabels[locale]);
    await expect(heading).toBeInViewport();
    await expect(heading.locator("[class*='partnerConceptNote']")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "en" ? "ltr" : "rtl");
    await expect.poll(() => partners.evaluate((section) => {
      const title = section.querySelector<HTMLElement>("[data-partner-center]")!.getBoundingClientRect();
      const cards = Array.from(section.querySelectorAll<HTMLElement>("[data-partner-card]"))
        .filter((card) => Number(getComputedStyle(card).opacity) > .5);
      return Math.min(...cards.map((card) => card.getBoundingClientRect().top - title.bottom));
    })).toBeGreaterThanOrEqual(8);
    await expectCardsClearBottomControl(page);
    await page.screenshot({ path: testInfo.outputPath(`${locale}-partners-mobile.png`) });

    await expectFoldCentered(page);

    await seekJourney(page, "Contact");
    const title = partners.locator("[data-final-title]");
    const contact = partners.locator("[data-final-cta]");
    await expect(contact).toBeFocused();
    await expect(title).toHaveText(await title.getAttribute("aria-label") ?? "");
    await expect(title).toBeInViewport();
    await expect(contact).toBeInViewport();
    await expectFinaleTitleOnOneLine(page);
    const titleBounds = await title.boundingBox();
    const contactBounds = await contact.boundingBox();
    expect(contactBounds!.height).toBeGreaterThanOrEqual(44);
    expect(titleBounds!.y + titleBounds!.height + 8).toBeLessThanOrEqual(contactBounds!.y);
    expect(await contact.evaluate((link) => Number.parseFloat(getComputedStyle(link).gap))).toBeLessThanOrEqual(12);
    expect(await contact.evaluate((link) => {
      const [label, arrow] = Array.from(link.children).map((span) => span.getBoundingClientRect());
      return Math.abs(label.y + label.height / 2 - arrow.y - arrow.height / 2);
    })).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
    await page.screenshot({ path: testInfo.outputPath(`${locale}-finale-mobile.png`) });

    await page.setViewportSize({ width: 320, height: 568 });
    await seekJourney(page, "Contact");
    await expect(contact).toBeFocused();
    await expectFinaleTitleOnOneLine(page);

    await page.setViewportSize(viewport);
    await seekJourney(page, "PartnersRead");
    await expect(partners).toBeFocused();
    await expect(heading.locator("[data-partner-center-text]")).toHaveText(partnerLabels[locale]);
    await expect(heading).toBeInViewport();
  });
}

for (const viewport of [{ width: 390, height: 360 }, { width: 568, height: 320 }]) {
  test(`short ${viewport.width}x${viewport.height} Partners cards clear text and fold into the center`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/fa?intro=0#partners", { waitUntil: "domcontentloaded" });
    await waitForJourney(page);
    await expect(page.locator("[data-partners]")).toBeFocused({ timeout: 45_000 });
    await expect.poll(() => page.locator("[data-partners]").evaluate((section) => {
      const title = section.querySelector<HTMLElement>("[data-partner-center]")!.getBoundingClientRect();
      return Math.min(...Array.from(section.querySelectorAll<HTMLElement>("[data-partner-card]"))
        .filter((card) => Number(getComputedStyle(card).opacity) > .5)
        .map((card) => card.getBoundingClientRect().top - title.bottom));
    })).toBeGreaterThanOrEqual(8);
    await expectCardsClearBottomControl(page);
    await expectFoldCentered(page);
    await seekJourney(page, "PartnersRead");
    await expect(page.locator("[data-partner-center-text]")).toHaveText(partnerLabels.fa);
    await expectCardsClearBottomControl(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
  });
}

test("only the featured project image is a keyboard target and opens its detail page", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en?intro=0#showcase", { waitUntil: "domcontentloaded" });
  const journey = await waitForJourney(page);
  const titleLink = journey.locator("[data-project-copy='0'] [data-project-title-link]");
  const featuredLink = journey.locator("[data-orbit-card][data-featured='true'] [data-project-image-link]");
  await expect(titleLink).toBeFocused({ timeout: 45_000 });
  await expect(featuredLink).toHaveCount(1);
  await expect(featuredLink).toBeInViewport();
  await expect(journey.locator("[data-project-action]")).toHaveCount(0);
  expect(await journey.locator("[data-orbit-card][data-featured='false']").evaluateAll((cards) => cards.every((card) => (
    (card as HTMLElement).inert
      && card.getAttribute("aria-hidden") === "true"
      && card.querySelector<HTMLAnchorElement>("a")?.tabIndex === -1
  )))).toBe(true);

  await seekJourney(page, "Services");
  await expect(featuredLink).toHaveCount(0);
  await seekJourney(page, "Work");
  await expect(featuredLink).toHaveCount(1);
  const target = await titleLink.getAttribute("href");
  await expect(featuredLink).toHaveAttribute("href", target ?? "");
  await featuredLink.focus();
  await expect(featuredLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`${target}/?$`), { timeout: 30_000 });
});

test("reduced motion keeps Partners navigation and a linked project image", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/fa?intro=0#partners", { waitUntil: "domcontentloaded" });
  const journey = await waitForJourney(page);
  await expect(journey).toHaveAttribute("data-motion", "reduced");
  const partners = journey.locator("[data-partners]");
  await expect(partners).toBeFocused();
  await expect(partners.locator("[data-partner-center-text]")).toHaveText(partnerLabels.fa);
  await expect(partners.locator("[class*='partnerConceptNote']")).toBeVisible();
  const image = journey.locator("[data-project-copy='0'] a img");
  await expect(image).toHaveCount(1);
  await image.scrollIntoViewIfNeeded();
  const link = journey.locator("[data-project-copy='0'] a");
  await expect(link).toHaveCount(1);
  await link.focus();
  await expect(link).toBeFocused();
  await expect(image).toBeInViewport();
  await partners.locator("[data-final-title]").scrollIntoViewIfNeeded();
  await expectFinaleTitleOnOneLine(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
});
