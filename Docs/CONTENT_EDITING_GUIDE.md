# Mandegar content editing guide

[نسخهٔ فارسی](CONTENT_EDITING_GUIDE.fa.md)

Use this guide to update text, images, videos, partner logos and screen artwork in the existing website. Commands are for Windows PowerShell, from `D:\Projects\Navid\Mandegar`. Follow [the deployment guide](DEPLOYMENT_GUIDE.md) after reviewing your content.

Content is read from local JSON and TypeScript at build time. No CMS or Sanity account is required. Most pages use `content/`; the animated homepage also uses `app/`, `components/` and artwork in `public/`. Saving a source file updates the local preview. The public website changes after a fresh build and deployment.

Examples contain sample paths and bracketed text. Replace them with your files and approved information. Merge example entries into the existing object/array; do not replace a whole collection with one example.

## Contents

1. [Prepare the local preview](#1-prepare-the-local-preview)
2. [Edit translated text safely](#2-edit-translated-text-safely)
3. [Find the source of any text](#3-find-the-source-of-any-text)
4. [Update the entire homepage](#4-update-the-entire-homepage)
5. [Update projects and case studies](#5-update-projects-and-case-studies)
6. [Update services](#6-update-services)
7. [Update About and Partners](#7-update-about-and-partners)
8. [Update Contact](#8-update-contact)
9. [Update navigation footer and branding](#9-update-navigation-footer-and-branding)
10. [Replace images](#10-replace-images)
11. [Add videos and captions](#11-add-videos-and-captions)
12. [Update 3D artwork and screens](#12-update-3d-artwork-and-screens)
13. [Update SEO and legal text](#13-update-seo-and-legal-text)
14. [Validate and review](#14-validate-and-review)
15. [Shared text field reference](#15-shared-text-field-reference)
16. [Troubleshoot edits](#16-troubleshoot-edits)

## 1. Prepare the local preview

### Step 1 — Open the source checkout

```powershell
Set-Location -LiteralPath "D:\Projects\Navid\Mandegar"
git status --short --branch
git branch --show-current
node --version
npm --version
```

Work on `source`. Remote `main` holds generated GitHub Pages files and is maintained by the publishing script. If you are on another branch, save or commit existing work before `git switch source`.

The installed Next.js package requires Node.js 20.9 or newer. This project has been built with Node.js 22.19. For a fresh checkout, install the committed dependencies:

```powershell
npm ci
if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed." }
```

Stop development servers before reinstalling dependencies. An existing working installation does not need another install for each content edit.

### Step 2 — Create local configuration once

```powershell
if (-not (Test-Path -LiteralPath ".env.local")) {
  Copy-Item -LiteralPath ".env.example" -Destination ".env.local"
}
```

For local editing, `.env.local` can contain:

```dotenv
NEXT_PUBLIC_SITE_URL=http://localhost:3300
MEDIA_CDN_ORIGIN=
```

Keep `.env.local` outside version control. The static publishing script sets the destination URL/base path during its build.

### Step 3 — Start the preview

```powershell
npm run content:check
if ($LASTEXITCODE -ne 0) { throw "Fix the content errors first." }
npm run dev
```

Open `http://localhost:3300/fa`, `http://localhost:3300/en`, and `http://localhost:3300/ar`. Keep that terminal running; use a second terminal for checks. Save edits and refresh if the animation/image retained its old state. Stop the server with `Ctrl+C`.

For a port conflict, use `npm run dev -- --port 3301` and open port 3301 instead.

## 2. Edit translated text safely

### Step 1 — Recognize the translation structure

Projects, services and media usually place languages inside a field:

```json
{
  "title": {
    "fa": "عنوان فارسی تأییدشده",
    "en": "Approved English title",
    "ar": "العنوان العربي المعتمد"
  }
}
```

Shared interface dictionaries put fields inside each language instead:

```json
{
  "fa": { "startProject": "شروع یک پروژه" },
  "en": { "startProject": "Start a project" },
  "ar": { "startProject": "ابدأ مشروعاً" }
}
```

These are structure examples, not replacements for complete files.

### Step 2 — Change values while keeping identifiers

1. Replace the text inside its quotes.
2. Update corresponding `fa`, `en`, `ar` values.
3. Preserve keys, chapter IDs and slugs unless deliberately changing a route or application contract.
4. Save as UTF-8; check VS Code's encoding indicator if needed.

JSON requires double quotes, commas between entries, no comments and no trailing comma after the last entry. Escape embedded quotes as `\"`; encode a line break inside a string as `\n`. Most paragraphs wrap normal text automatically.

Preserve substitution tokens exactly, including `{count}`, `{piece}`, `{row}` and `{column}`. They are filled by the application. RTL direction is automatic for Persian/Arabic.

### Step 3 — Review changed headings on mobile

Keep mobile instructions and animated headings concise. Longer text can alter wrapping, typing duration, ellipsis and space around controls. Review at 320px and 390px wide and on desktop after editing hero titles, service descriptions, partner names or the final one-line headline.

## 3. Find the source of any text

Use VS Code `Ctrl+Shift+F` to search a distinctive phrase, or ripgrep:

```powershell
rg -n -F -- "Start a project" content app components lib
```

Some phrases exist in multiple active dictionaries, and searches can also find unused legacy components. Use this source map:

| Visible content | Source |
| --- | --- |
| Project cards and complete case studies | [content/projects.json](../content/projects.json) |
| Service archive/detail pages | [content/services.json](../content/services.json) |
| Media paths, alt text, captions and rights | [content/media.json](../content/media.json) |
| Projects/Services/About/Partners/Contact introductions | [content/pages.json](../content/pages.json) |
| Inner-page labels, CTAs, brief, footer and recovery pages | [content/page-copy.json](../content/page-copy.json) |
| Shared/default UI labels | [content/ui.json](../content/ui.json) |
| Brand, navigation, address, social links and footer lines | [content/site.json](../content/site.json) |
| Email, telephone and WhatsApp destinations | [content/contacts.json](../content/contacts.json) |
| About people/profile records | [content/people.json](../content/people.json) |
| Approved partner/client names and logos | [content/trust.json](../content/trust.json) |
| Homepage transition, About typing, Partners and finale | [content/journey.json](../content/journey.json) |
| Homepage project selection and optional legacy overrides | [content/homepage.json](../content/homepage.json) |
| Default search/social titles and descriptions | [content/seo.json](../content/seo.json) |
| Legal page content/status | [content/legal.json](../content/legal.json) |
| Hero headlines, descriptions, phase names, loading and sound labels | [app/[locale]/page.tsx](../app/[locale]/page.tsx), `fallbackCopy` |
| Mobile instructions and photo/game/drawing controls | [interaction-copy.ts](../components/experience/interactions/interaction-copy.ts) |
| Animated homepage service chapter text/pictures | [services-copy.ts](../components/experience/services-copy.ts) |
| Four-button story screen text | [touch-motion-story.ts](../components/experience/interactions/touch-motion-story.ts), [installation-demo.ts](../components/experience/interactions/installation-demo.ts) |
| Intelligence inspector, character and participation labels | [intelligence-inspector-copy.ts](../components/experience/intelligence-inspector-copy.ts), [intelligence-person-profile.ts](../components/experience/intelligence-person-profile.ts), [intelligence-participation.ts](../components/experience/intelligence-participation.ts) |
| Work shortcut, intro skip, back-to-top and special fallback copy | [MandegarExperience.tsx](../components/experience/MandegarExperience.tsx) |
| Header accessibility labels and language names | [Header.tsx](../components/layout/Header.tsx), [lib/i18n.ts](../lib/i18n.ts) |
| Text painted into an image/model | Original artwork/model; section 12 |

Normal copy edits do not require changing camera settings, animation cues or CSS. Some retained configuration/labels are unused in the current composition; the sections below identify these boundaries.

## 4. Update the entire homepage

### Step 1 — Edit the primary hero copy

In `app/[locale]/page.tsx`, edit the `fa`, `en`, `ar` blocks inside `fallbackCopy`. With the current `useContentOverrides: false`, these are the active primary values.

| Phase/item | Fields in each locale |
| --- | --- |
| Arrival | `arrivalLabel`, `arrivalBody` |
| Discovery | `discoveryEyebrow`, `discoveryTitle`, `discoveryBody` |
| Photo activation | `activationEyebrow`, `activationTitle`, `activationBody` |
| Four-button story | `engagementEyebrow`, `engagementTitle`, `engagementBody` |
| Stage lighting | `revealEyebrow`, `revealTitle`, `revealBody` |
| Road game | `experiencesEyebrow`, `experiencesTitle`, `experiencesBody` |
| Drawing wall | `connectionEyebrow`, `connectionTitle`, `connectionBody` |
| Projects overview | `proofEyebrow`, `proofTitle`, `proofBody` |
| Intelligence | `intelligenceEyebrow`, `intelligenceTitle`, `intelligenceBody` |
| Invitation | `invitationEyebrow`, `invitationTitle`, `invitationBody` |
| Project CTA/loading | `startProject`, `loading` |
| Sound labels | `enableSound`, `muteSound` |
| Rail names/accessibility | `phases.arrival` through `phases.loop`, `scroll` |
| Retained replay/zone/navigation copy | `replay`, `zones.photo/game/touch`, `navigation.projects/services/about/contact` |

Some desktop descriptions are replaced by short mobile interaction instructions. Changing a desktop body alone does not update those instructions.

### Step 2 — Edit interaction and mobile copy

In `components/experience/interactions/interaction-copy.ts`:

- `english`, `persian`, `arabic`: station headings/instructions, skip/continue labels, game pause/resume/steering, drawing undo/clear/finish, photo delivery and keyboard instructions.
- `mobileHeroCopy.fa/en/ar.instructions`: short photo, touch, stage, game and draw prompts.
- `mobileHeroCopy.fa/en/ar.intelligence`: short mobile intelligence prompt.

For the four-button story, also edit `installationCopy` in `installation-demo.ts` (button `views` and instruction) and `copy` in `touch-motion-story.ts` (four titles, two-line descriptions and tags drawn inside the monitor). Preserve the four slot IDs: `assembled`, `parts`, `details`, `image`.

For audience/participation labels, edit the three intelligence dictionaries in the source map. Authored character/participation records are demo data, separate from business evidence in `trust.json`; they are not collected visitor data.

### Step 3 — Edit About, Partners and finale copy

In `content/journey.json`, edit `copy.fa/en/ar`:

| Field | Use |
| --- | --- |
| `work` | Accessible selected-work section name |
| `entry` | Hero-to-journey transition |
| `aboutLabel`, `aboutBody`, `more` | About label, supporting copy and link |
| `about` | Retained multi-line copy; active animated heading uses `aboutTyping` |
| `partnersLabel`, `partners` | Partners heading/supporting language |
| `genericPartnersLabel`, `genericPartnersNote` | Heading/notice while real partners are absent |
| `disciplines` | Illustrative card names |
| `placeholder` | Sample-mark label |
| `finale` | Final one-line headline and accessible typing title |
| `contact` | Final conversation link |
| `demo`, `scroll`, `detail` | Retained labels; some are currently unused |

Edit `aboutTyping.fa/en/ar.base` and `.words` in the same file. The base stays fixed; words type and erase. Keep the words array non-empty and review the combined line on mobile.

`MandegarExperience.tsx` also holds `postExperienceCopy` and inline locale strings for the work shortcut, Skip intro, Back to top, and the special intelligence sentence in the semantic fallback. Several other post-experience fields are retained but not displayed.

### Step 4 — Select homepage projects

Set `featuredProjectSlugs` in `content/homepage.json` to existing published slugs. This fragment uses current sample records; replace them with your real slugs:

```json
{
  "featuredProjectSlugs": [
    "placeholder-exhibition-01",
    "placeholder-interactive-02",
    "placeholder-live-03"
  ]
}
```

An empty list uses published `projects.json` order. Up to eight projects are selected; the orbit repeats cards when fewer exist. Keep at least one published project for the full animated journey: with none, it switches to the static layout. Title/picture come from project `title` and `media`. Keep an image as a homepage project's main media; place videos in its gallery.

### Step 5 — Understand the optional legacy overrides

Keep `useContentOverrides: false` for the existing composition. Enabling it is not needed for project selection. When deliberately enabled, `homepage.copy.<locale>` maps:

| Override fields | Hero fields |
| --- | --- |
| `spaceTitle`, `spaceBody` | Discovery |
| `systemTitle`, `systemBody` | Photo activation |
| `interactiveTitle`, `interactiveBody` | Both reveal and game |
| `proofTitle`, `proofBody` | Projects overview |
| `intelligenceTitle`, `intelligenceBody` | Intelligence |
| `ctaTitle`, `ctaBody` | Invitation |

Other hero fields keep `fallbackCopy`. `sectionSettings` and `mediaOverrides` do not drive this animated composition. `ctaOverrides.conversion.href`, if supplied, controls the hero CTA destination; its `label` currently does not replace `startProject`. The final journey CTA still uses Contact.


## 5. Update projects and case studies

### Step 1 — Choose a record

Open `content/projects.json`. Edit a record or duplicate a complete record inside the array. The six current samples use `placeholder-` slugs. Replace their actual copy/assets before removing their concept labels.

### Step 2 — Fill the fields

| Field | What to enter |
| --- | --- |
| `slug` | Unique lowercase URL words separated by single hyphens |
| `title`, `eyebrow`, `summary` | Localized project name, introductory label and summary |
| `category`, optional `categories` | Localized categories used for display/filtering |
| Optional `client` | Approved localized client name |
| `year`, `location` | Confirmed year string and localized location |
| `media` | Main image key from `media.json` |
| `gallery` | Ordered array of media keys; at least one |
| `services` | Non-empty array of localized work descriptions |
| `serviceSlugs` | Existing service slugs for links |
| `challenge`, `approach`, `scope`, `outcome` | Localized case-study sections |
| Optional `credits` | Approved localized credits |
| `relatedProjectSlugs` | Existing project slugs; never self-reference |
| `publicationState` | `draft`, `published`, `archived` |
| `isPlaceholder` | `true` for a concept, `false` after real content approval |

Use consistent category wording for one filter. `services` is display text; `serviceSlugs` is a relationship. One does not populate the other.

### Step 3 — Register and connect assets

Upload files, create their `media.json` entries, then use those keys:

```json
{
  "media": "yourProjectHero",
  "gallery": ["yourProjectDetail", "yourProjectFilm"],
  "serviceSlugs": ["event-production"],
  "relatedProjectSlugs": []
}
```

This is a fragment. Create the referenced media keys first; sections 10 and 11 explain how.

### Step 4 — Publish and order records

Use `draft` while preparing the record, then `published` when ready. `archived` hides archive/detail routes after rebuilding. `isPlaceholder: true` labels a published record as a concept rather than hiding it.

Array order controls the archive and previous/next navigation. Homepage order uses `featuredProjectSlugs` independently. Review `/fa/projects`, `/en/projects`, `/ar/projects` and the changed detail routes, including filters, cover crops, galleries and related links.

Renaming a published slug changes all three language URLs. Update homepage selection, relationships and tests using the old slug. The current export does not generate redirects for old slugs; redirects need hosting configuration or development work.

## 6. Update services

### Step 1 — Edit catalog and detail text

In `content/services.json`, update:

- `slug`, `number`, localized `title`, `summary`, `detail`, and a registered `media` key.
- `capabilities`, `deliverables`: non-empty arrays of localized text.
- `process`: entries with localized `title`, `body`.
- `faq`: entries with localized `question`, `answer`.
- `relatedProjectSlugs`, `publicationState`, `isPlaceholder`.
- Optional `status`: `current` or `emerging`.

Keep a non-empty `number` for validation; display numbering is recalculated from published order. `emerging` visibly marks an offering in development.

### Step 2 — Update its homepage chapter separately

In `components/experience/services-copy.ts`, edit the relevant chapter's `title.fa/en/ar` and `description.fa/en/ar`. `servicesCopy` holds the shared section label, scroll hint and service-details label.

| Chapter ID | Stable linked service slug | Fallback image |
| --- | --- | --- |
| `events` | `event-production` | `/media/services/events.webp` |
| `exhibitions` | `exhibitions-and-space` | `/media/services/exhibitions.webp` |
| `web-apps` | `websites-and-applications` | `/media/services/web-apps.webp` |
| `content` | `content-and-media` | `/media/services/content.webp` |
| `advertising` | `advertising-structures` | `/media/services/advertising.webp` |

Keep these linked services published. Adding another service creates archive/detail content but does not add an animated chapter. New/reordered 3D chapters require choreography/model changes.

### Step 3 — Review both versions

Check the home chapter and standalone detail. Their titles/descriptions are separate sources. The normal 3D miniatures are also separate from the fallback images; see section 12 for artwork changes.

## 7. Update About and Partners

### Step 1 — Edit page introductions

In `content/pages.json`, every page has localized `heroKicker`, `title`, `intro`, and `seo.title`/`seo.description`.

About uses fixed section keys `approach`, `geography`: edit their `kicker`, `title`, `body`, and `approach.items` for the visible principles. Partners uses `network`: edit its `kicker`, `title`, `body`. Adding an arbitrary section key does not create a new layout section.

### Step 2 — Edit About workflow and profiles

In every locale of `page-copy.json`, update `aboutWorkflowKicker`, `aboutWorkflowTitle`, `aboutWorkflowBody`, `aboutWorkflowSteps[].title/body`, and the `aboutTeam*`/`aboutCta*` groups.

While no approved people exist, `aboutTeamRoles` supplies illustrated roles with `title`, `body`, and a registered `media` key. Keep `aboutTeamPlaceholderNote` accurate while those are sample roles.

Add real profiles inside the `content/people.json` array:

```json
{
  "name": "[Approved person name]",
  "role": { "fa": "[نقش تأییدشده]", "en": "[Approved role]", "ar": "[الدور المعتمد]" },
  "biography": { "fa": "[معرفی تأییدشده]", "en": "[Approved biography]", "ar": "[النبذة المعتمدة]" },
  "publicationState": "draft",
  "isPlaceholder": true
}
```

Optional `location` and `partnerType` are plain strings. Set `published` and `isPlaceholder: false` only after approval. Approved profiles replace the illustrated roles. There is no person-portrait field in the current schema; adding portraits requires a template/model change.

### Step 3 — Add real partner names and logos

Both the homepage circle and standalone Partners page use `trust.json.clients`. Upload a logo, then insert a client record:

```json
{
  "name": "[Approved partner name]",
  "logo": "/media/partners/your-partner-logo.webp",
  "url": "https://your-partner-domain.com",
  "sector": "[Confirmed sector]",
  "publicationState": "draft",
  "isPlaceholder": true,
  "approvalNote": "[Record permission to publish this name and logo]"
}
```

Replace the sample URL with a verified URL, or omit it. `logo` is a direct file path, not a `media.json` key. Use `published` and `isPlaceholder: false` after approval. Names are shared strings across locales; localized partner names need a model change.

Real published partners replace the illustrative disciplines. A missing logo uses a text/monogram fallback. `url` links a partner's website on the standalone page; individual homepage circle cards currently have no website links. Update `partnersCtaTitle`, `partnersCtaBody`, `partnersWebsiteLabel`, `partnersPlaceholderNote` in each locale of `page-copy.json`.

### Step 4 — Understand evidence fields

`trust.json.metrics` and `.testimonials` also support publication/placeholder flags and `approvalNote`. Metrics require localized `label`, `context`, a `value`, optional `unit`, and `sourceNote`. Testimonials require localized `quote`, `person`, `role`, `organization`.

Those records are validated but the current homepage does not render business metrics or testimonial sections. Adding records alone does not create a section. Use only approved claims and evidence.

## 8. Update Contact

### Step 1 — Edit page and purpose text

Edit `pages.contact` for the introduction. In `page-copy.json`, update `contactChannels*`, `contactSales*`, `contactGeneral*`, `contactInternational*`, `contactWhatsapp*` in each language.

The visible purpose headings/descriptions use these groups. A channel's own `label`/`description` does not replace all purpose headings in the current template.

### Step 2 — Configure real destinations

In `contacts.json`, for each purpose (`sales`, `general`, `international`, `whatsapp`):

1. Edit localized `label` and optional `description`.
2. Provide at least one verified `email`, `phone`, `whatsapp`.
3. Set `isPlaceholder: false` after verification.
4. Optionally add displayed `availabilityText.fa/en/ar`.

Emails are plain addresses without `mailto:`. Phones use E.164: `+`, country code and digits, with no spaces/separators. WhatsApp accepts an international number or HTTPS `wa.me` URL. The footer uses the same destinations.

A placeholder channel must not contain usable contact links. Remove an unused placeholder record from a final launch collection rather than leaving it unverified. Optional `department`, `country`, `availability` are retained metadata; the localized displayed availability uses `availabilityText`.

### Step 3 — Edit the brief outline

Update `briefKicker`, `briefTitle`, `briefBody`, `briefFields`, `copyBrief`, `copiedBrief`, `copyBriefFallback`, `copyBriefFailed`, `briefPrivacyNote` in every language.

The page copies an outline; it does not submit a form or send email automatically. The retained `callbackForm` feature flag does not create a receiving backend. Form submissions require a separate implementation/receiving service.

### Step 4 — Test contact actions

Click email, telephone and WhatsApp links on Contact and in the footer, including on a real phone. Check the copied brief in all three languages.

## 9. Update navigation footer and branding

### Step 1 — Edit site settings

| Field in `content/site.json` | Use |
| --- | --- |
| `title` | Header/footer brand and shared identity |
| `copyrightHolder` | Copyright owner; year is generated |
| `navigation[].label/path/order` | Translated labels, internal destination and order |
| `footerLine`, `globalLine` | Localized footer copy |
| `address` | Optional verified localized address |
| `socialLinks` | Visible `label` and verified HTTPS `url` |
| `brandMark` | Optional header/footer logo path |
| `socialImage` | Shared social-card path |

Navigation paths normally omit the locale, for example `projects`, `services`, `about`, `partners`, `contact`. Home links scroll to recognized sections; inner-page links open standalone routes. Legacy home hashes `#showcase`, `#services`, `#about`, `#partners`, `#contact` remain supported. Keep configured labels consistent with fallback `ui.<locale>.navigation` labels.

### Step 2 — Edit footer text

Edit the `footer*`, `privacy`, `copyright` and `startProject` labels in each `page-copy.json` language. `footerConceptNote` remains visible even after you replace project placeholders; revise it to match your final content.

### Step 3 — Replace the correct logo

- Header/footer: set `site.brandMark` and upload its file. Without it, the built-in circle remains.
- Final home logo: `public/images/mandegar-finale-logo.webp`, currently 1800×1031. Preserve the transparent silhouette/aspect ratio; it is used as both artwork and a mask.
- Social card: `public/images/mandegar-social.png`, 1200×630, or another path in `site.socialImage`. Its SVG source is alongside it; editing the SVG does not regenerate the PNG.
- 3D signage: update the baked artwork/model, not `site.title`.

Persian font configuration is in `lib/fonts.ts` and `styles/fonts/rokh-fa-num/`. Normal text editing does not require font changes.


## 10. Replace images

### Step 1 — Prepare delivery files

Use lowercase descriptive filenames and version suffixes for replacements, for example:

```text
public/media/projects/your-project/hero-v1.webp
public/media/projects/your-project/detail-v1.webp
public/media/projects/your-project/hero-mobile-v1.webp
public/media/partners/your-partner-logo.webp
```

Keep full-size originals separately. For normal project photos, about 1600px wide is a useful starting point, with a smaller mobile crop when appropriate. This is an editorial starting point, not a validator limit. Static exports serve uploaded files without runtime image optimization, so prepare their size before publishing.

Use WebP for photographic previews, transparent WebP/PNG or trusted SVG for logos. Check the crop: no focal-point field exists in the current media schema. Versioned names make cache changes easier to verify.

### Step 2 — Optionally convert a photograph

Sharp is already installed. Replace the sample source/folder names before running:

```powershell
New-Item -ItemType Directory -Force -Path ".\public\media\projects\your-project" | Out-Null
node -e "require('sharp')('D:/Assets/project-hero.jpg').rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 85 }).toFile('public/media/projects/your-project/hero-v1.webp').catch(error => { console.error(error); process.exitCode = 1; })"
```

Make a mobile version from a suitable crop with a smaller width, such as 800. Review the result; enlarging a low-resolution source does not recover detail.

### Step 3 — Register an asset

Add a key inside the outer object in `content/media.json`:

```json
{
  "yourProjectHero": {
    "src": "/media/projects/your-project/hero-v1.webp",
    "mobileSrc": "/media/projects/your-project/hero-mobile-v1.webp",
    "kind": "image",
    "alt": {
      "fa": "[شرح دقیق تصویر]",
      "en": "[Accurate image description]",
      "ar": "[وصف دقيق للصورة]"
    },
    "caption": {
      "fa": "[توضیح یا اعتبار تصویر]",
      "en": "[Caption or image credit]",
      "ar": "[تعليق أو نسبة الصورة]"
    },
    "isPlaceholder": false,
    "rightsStatus": "approved",
    "sourceNote": "[Actual source and permission to publish]"
  }
}
```

Use the real-media flags only after approval. Omit optional `caption`/`mobileSrc` when not supplied. The validator checks every specified local file, including draft assets.

Local URLs begin with `/media/` or `/images/`. Do not include `public`, a locale, `Mandegar`, a drive letter or the deployment prefix. The application adds the hosting prefix.

### Step 4 — Connect the key

Set project `media`/`gallery`, service `media`, or an About role's `media` to the key. Changing a shared key updates all references; make a new key when only one project should change.

Current keys: `spark`, `exhibition`, `interactive`, `photo`, `projectPhoto`, `intelligence`, `stage`, `videoPlaceholder`, `webApps`, `advertising`. Before repurposing one, search for it:

```powershell
rg -n -F -- '"exhibition"' content app components
```

Editorial images support `mobileSrc`. Animated homepage project cards currently use the main `src`; a separate mobile source does not change their crop.

### Step 5 — Optional media CDN

Set `MEDIA_CDN_ORIGIN` to one HTTPS origin such as `https://media.your-domain.com`, without a path or credentials. Use full media URLs from that origin. Restart the dev server after changing environment settings, then rebuild for deployment.

Configure the CDN's CORS for media used by canvas/WebGL and remote captions. Test its files in the actual scene. A URL change needs a rebuild; replacing bytes at an existing URL also needs cache handling.

## 11. Add videos and captions

### Step 1 — Choose a supported placement

| Placement | Behavior |
| --- | --- |
| Project detail gallery | Video controls supported |
| Service detail main media | Video controls supported |
| Project archive main media | Displays the video poster |
| Animated homepage project cover | Expects an image; keep a photo cover and put video in the gallery |
| Desktop partner/finale media surfaces | Can use gallery videos |
| Mobile partner/finale media surfaces | Use video posters |
| Game/drawing/story monitors | Interactive canvas content; generic video replacement needs development |

A primary editorial project video is supported by detail/archive templates, but the current homepage cover pipeline does not map it to its poster. Use an image cover plus gallery video for featured projects unless that pipeline is changed.

### Step 2 — Prepare video and a poster

Use directly served MP4 with H.264 video/AAC audio for the common delivery path. A YouTube/Vimeo page URL is not a file source for the current component. Prepare a poster and optionally a smaller mobile film.

The installed `ffmpeg-static` package supplies a local encoder. Replace sample paths, create the output folder, and use new output names:

```powershell
New-Item -ItemType Directory -Force -Path ".\public\media\projects\your-project" | Out-Null
$ffmpegPath = node -p "require('ffmpeg-static')"
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $ffmpegPath)) { throw "Video encoder is unavailable; check npm ci." }
& $ffmpegPath -i "D:\Assets\project-film.mp4" -vf "scale=1280:-2" -c:v libx264 -crf 24 -preset medium -c:a aac -b:a 128k -movflags +faststart ".\public\media\projects\your-project\film-v1.mp4"
if ($LASTEXITCODE -ne 0) { throw "Video encoding failed." }
& $ffmpegPath -ss "00:00:02" -i ".\public\media\projects\your-project\film-v1.mp4" -frames:v 1 ".\public\media\projects\your-project\film-poster-v1.jpg"
if ($LASTEXITCODE -ne 0) { throw "Video poster creation failed." }
```

Choose a representative timestamp. For mobile, repeat with a smaller width, such as 720, and a different output name. Review detail and size before choosing compression settings.

### Step 3 — Register the film

```json
{
  "yourProjectFilm": {
    "src": "/media/projects/your-project/film-v1.mp4",
    "mobileSrc": "/media/projects/your-project/film-mobile-v1.mp4",
    "poster": "/media/projects/your-project/film-poster-v1.jpg",
    "captionsSrc": "/media/projects/your-project/film-captions.vtt",
    "kind": "video",
    "alt": {
      "fa": "[شرح محتوای فیلم]",
      "en": "[Description of the film]",
      "ar": "[وصف محتوى الفيلم]"
    },
    "isPlaceholder": false,
    "rightsStatus": "approved",
    "sourceNote": "[Actual source and approved film/audio rights]"
  }
}
```

Omit `mobileSrc`/`captionsSrc` when those files do not exist. Video requires `poster`. Add the key to a project gallery or service `media` field. `kind: "video-placeholder"` shows an image/concept label, not footage.

### Step 4 — Supply captions when needed

Create a UTF-8 WebVTT file, for example:

```vtt
WEBVTT

00:00:00.000 --> 00:00:03.000
Caption for the opening scene.

00:00:03.000 --> 00:00:06.000
Caption for the next scene.
```

`captionsSrc` is one shared path, not a localized object. Separate Persian/English/Arabic tracks and language selection require extending the component/schema; a different caption file is not automatically selected for each locale.

### Step 5 — Test actual playback

Editorial videos have controls, loop, and start muted. They attempt autoplay when reduced motion/data saving are off; browsers can reject it. With reduced motion/data saving, playback waits for user action. Check play/pause, sound, captions, mobile delivery and posters.

Serve oversized films from the configured media CDN. GitHub blocks regular Git pushes of individual files over 100 MiB. [GitHub file-size documentation](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github).

## 12. Update 3D artwork and screens

These assets are loaded directly, outside `media.json`.

### Step 1 — Identify the active source

| Artwork | File/source |
| --- | --- |
| Hero lighting wall | `public/media/hero/lighting-screen-v1.webp`, configured in `scene-config.ts` |
| Photo delivery example | `public/media/placeholders/photo-experience.webp`, directly loaded in `BakedMandegarScene.tsx` |
| Empty-media journey fallback | `public/media/placeholders/exhibition-space.webp`, directly loaded in `ConnectedJourney.tsx` |
| Puzzle/reference artwork | `public/media/hero/connected-experience.webp`, fallback `public/media/mandegar/screens/mandegar-puzzle.webp`, configured in `puzzle-artwork.ts` |
| Race sprites/road | `public/media/hero/race-cars.webp`, `race-road.webp`, configured in `race-artwork.ts` |
| Service fallback posters | Five `public/media/services/*.webp` paths in `services-copy.ts` |
| Animated service miniatures | `public/models/services/mandegar-services.glb`, loaded by `ServicesSceneCanvas.tsx` |
| Hall/exhibition/crowd models | `public/models/mandegar/mandegar_environment.glb`, `mandegar_exhibition.glb`, `mandegar_crowd.glb` |
| Touch-button model | `public/models/mandegar/mandegar_touch_button.glb` |
| Quiet/peak baked textures | `public/textures/mandegar/baked/` and `mobile/`, configured in `baked-scene-contract.ts` |
| Finale logo | `public/images/mandegar-finale-logo.webp` |

`race-idle.webp` is retained artwork, not an active road-game source. Not every file under `public/` is currently displayed.

### Step 2 — Replace flat artwork

Replace the existing file with compatible artwork, or change the active code path. Preserve `publicAssetPath(...)` when changing a path. Useful current dimensions:

- Lighting artwork: 1740×450, keeping its wide composition.
- Connected-experience artwork: 1672×941.
- Service fallback posters: 896×896.
- Car sprites: 1774×887; preserve atlas frame layout or update `race-artwork.ts` coordinates.
- Road: 1024×1536; preserve the road/tiling layout.
- Finale logo: 1800×1031 with transparency.

The four-button story is drawn by code. Replacing puzzle artwork does not replace that story's text/drawn scenes.

### Step 3 — Regenerate service fallback posters

Replace the source PNGs in `Docs/CreativeProduction/3d/services/`, then run:

```powershell
node .\scripts\blender\prepare-services-posters.mjs
```

This regenerates all five fallback WebPs and their manifest. It does not rebuild the GLB. To change animated miniatures, edit the corresponding `.blend`, rebake materials and export `mandegar-services.glb`, preserving the renderer's hierarchy/chapter placement.

### Step 4 — Change painted text and signage

Text inside a bitmap/model needs an artwork/texture/model edit and re-export. Canvas brand literals are in painter code. Find them with:

```powershell
rg -n -F -- "MANDEGAR" components/experience
```

Active painters include `ScrollScenes.tsx`, `StageBeamInteraction.tsx`, `DrawingInteraction.tsx`, `touch-motion-story.ts`. Review these and the 3D signage when changing the brand name.

### Step 5 — Rebuild baked texture variants

The current scene builder requires 4096×4096 PNGs named `env_quiet.png`, `env_peak.png`, `exhibit_quiet.png`, `exhibit_peak.png`. Install Khronos KTX-Software or point `KTX_TOKTX_PATH` at `toktx.exe`.

```powershell
npm run assets:textures -- "D:\Projects\Navid\mandegar3d\Texture\Update"
```

To rebuild selected maps:

```powershell
npm run assets:textures -- "D:\Projects\Navid\mandegar3d\Texture\Update" --texture exhibit_quiet --texture exhibit_peak
```

Outputs are desktop 4096px/mobile 2048px WebP/KTX2 atlases. These are the existing scene pipeline dimensions; ordinary project photos do not use this pipeline. Preserve model UVs and quiet/peak variants. See [the 3D asset contract](3D_ASSET_WORKFLOW.md) for model handoff.

### Step 6 — Handle hero video as development work

The center wall's `BakedScreenController.tsx` can load a video texture, but `ScrollScenes.tsx` and `StageBeamInteraction.tsx` also consume the same configured lighting source as an image. Replacing the WebP path with MP4 alone is incomplete. Coordinated poster/video handling and checks of live interactions, transitions, mobile and reduced motion are needed first.


## 13. Update SEO and legal text

### Step 1 — Edit search and social descriptions

Each locale in `content/seo.json` has `home`, `projects`, `services`, `about`, `partners`, `contact`, `legal`, each as `[title, description]`.

Inner pages use their `pages.<page>.seo.title`/`.description` when supplied, falling back to `seo.json`. Edit the effective values. Project detail metadata uses its title/summary and poster/cover; service detail metadata uses its title/summary.

Use the correct production `SiteUrl` at build time. It controls canonical URLs, alternate-language links, sitemap URLs and absolute social URLs. Change `site.socialImage` when replacing the social card.

### Step 2 — Complete legal copy

Edit `legal.json.title`, `.intro`, and section `.heading`/`.body` in all languages. Keep `status: "draft"` while under review. After actual approval, set `status: "approved"` and a valid `updatedAt` in `YYYY-MM-DD` format. The draft notice and indexing behavior change automatically. The validator checks structure/status, not legal correctness. Legal UI labels are in `page-copy.json`.

## 14. Validate and review

### Step 1 — Check content structure

```powershell
npm run content:check
```

Fix errors such as missing translations/files, unknown media keys, duplicate slugs, broken relationships, invalid contacts or unapproved real media. Labelled placeholders are allowed in preview builds.

### Step 2 — Check final launch content

```powershell
npm run content:check -- --strict
```

This turns placeholders/review drafts into launch errors. The repository snapshot on 2026-10-11 reports 27 items: six project concepts, seven service concepts, ten media placeholders, three unverified contact records and draft legal text. Resolve them with real content or remove unused media/contact entries after checking references. Changing a flag alone does not supply approved content.

Strict validation does not assess wording, translation accuracy or baked artwork. Empty optional partner/people arrays do not guarantee the displayed sample cards are final; review those pages yourself.

### Step 3 — Check edited code

```powershell
npm run lint
npm run typecheck
```

### Step 4 — Review changed pages

Review Persian, English and Arabic at desktop/mobile sizes:

- Every changed hero phase, short mobile prompt, typing title and interaction control.
- Selected project order, title/image links, case studies and galleries.
- Home service chapters and standalone details.
- Partners circle/page and About profiles/roles.
- Header/menu/footer, contact destinations and copied brief.
- Reduced motion, keyboard focus, crops and video controls/posters.
- Search/social metadata and legal notices.

### Step 5 — Run browser checks

```powershell
npx playwright install chromium
npm run test:e2e -- tests/e2e/content-files.spec.ts tests/e2e/content-navigation.spec.ts tests/e2e/interior-content.spec.ts tests/e2e/partners-page.spec.ts tests/e2e/footer.spec.ts
```

For full release regression, use `npm run test:e2e`. Some tests refer to current sample slugs/wording; replacing them can require updating test content expectations. Inspect failures to distinguish outdated fixtures from real broken routes/layouts. Open the report with `npx playwright show-report`.

### Step 6 — Build and publish

Use [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md). JSON edits on GitHub, pushing `source`, or uploading JSON alone do not run this repository's publishing script. Public updates need a fresh build and deployment.

## 15. Shared text field reference

`content/page-copy.json` has matching keys inside `fa`, `en`, `ar`. Edit each affected field in all three locales.

| Area | Keys |
| --- | --- |
| Navigation/general | `home`, `navigationLabel`, `breadcrumbs`, `projects`, `services`, `overview`, `backToProjects`, `backToServices`, `startProject`, `exploreServices`, `viewServices`, `viewProjects`, `viewProject`, `viewService`, `skipToContent` |
| Case study/metadata | `challenge`, `approach`, `scope`, `outcome`, `credits`, `client`, `year`, `location`, `category`, `service`, `project`, `projectContents`, `projectIndex` |
| Archive/filter | `emptyProjects`, `emptyProjectsBody`, `clearFilters`, `allCategories`, `results`, `filterProjects`, `showAllProjects`, `projectCount`, `projectArchiveAsideTitle`, `projectArchiveAsideBody` |
| Gallery/related work | `projectGallery`, `projectGalleryBody`, `relatedProjects`, `relatedProjectsBody`, `nextProject`, `previousProject`, `serviceRelatedProjectsBody` |
| Services | `capabilities`, `deliverables`, `process`, `faq`, `relatedServices`, `servicesCount`, `serviceArchiveAsideTitle`, `serviceArchiveAsideBody`, `serviceContents`, `serviceOverview`, `serviceWorkingTogether`, `serviceWorkingTogetherBody` |
| CTAs | `projectCtaTitle`, `projectCtaBody`, `serviceCtaTitle`, `serviceCtaBody`, `contactCtaTitle`, `contactCtaBody` |
| Status notices | `conceptLabel`, `conceptNotice`, `conceptMedia`, `videoConcept`, `emergingLabel`, `emergingNotice` |
| About | `aboutWorkflowKicker`, `aboutWorkflowTitle`, `aboutWorkflowBody`, `aboutWorkflowSteps[].title/body`, `aboutTeamKicker`, `aboutTeamTitle`, `aboutTeamBody`, `aboutTeamPlaceholderNote`, `aboutTeamRoles[].title/body/media`, `aboutCtaTitle`, `aboutCtaBody` |
| Partners | `partnersCtaTitle`, `partnersCtaBody`, `partnersPlaceholderNote`, `partnersWebsiteLabel` |
| Contact | `contactChannelsKicker`, `contactChannelsTitle`, `contactChannelsBody`, `contactSalesTitle`, `contactSalesBody`, `contactGeneralTitle`, `contactGeneralBody`, `contactInternationalTitle`, `contactInternationalBody`, `contactWhatsappTitle`, `contactWhatsappBody`, `contactPlaceholderTitle`, `contactPlaceholderBody`, `contactEmail`, `contactPhone`, `contactWhatsapp` |
| Brief | `briefKicker`, `briefTitle`, `briefBody`, `briefFields`, `copyBrief`, `copiedBrief`, `copyBriefFallback`, `copyBriefFailed`, `briefPrivacyNote` |
| Footer | `footerNavigation`, `footerContact`, `footerLegal`, `copyright`, `privacy`, `footerSocial`, `footerLanguages`, `footerCtaTitle`, `footerCtaBody`, `footerPlaceholder`, `footerConceptNote` |
| Legal | `legalKicker`, `legalContents`, `legalUpdated`, `legalDraftLabel`, `legalDraftNotice`, `legalApprovedLabel`, `legalQuestionTitle`, `legalQuestionBody`, `legalQuestionLink` |
| Recovery | `notFoundTitle`, `notFoundBody`, `backHome`, `retry`, `errorTitle`, `errorBody` |

`content/ui.json` contains `navigation.projects/services/about/partners/contact`, `start`, `explore`, `viewProject`, `viewAll`, `selectedWork`, `placeholder`, `scroll`, `menu`, `close`, `availableSoon`, `all`, `sendMessage`, `callSales`, `whatsapp`, `readMore`, `backToProjects`, `emerging`, `noContact`, `footer` in each language. Some are retained fallback fields rather than currently displayed copy.

Header home/navigation accessibility labels, language abbreviations and language names are in `Header.tsx`/`lib/i18n.ts`. Search across `content`, `app`, `components`, `lib` for remaining literals; text visible only in artwork follows section 12.

## 16. Troubleshoot edits

| Symptom | Check |
| --- | --- |
| Homepage copy did not change | Edit active hero/mobile/journey sources; `homepage.copy` is inactive with overrides off |
| Service changed only on its detail page | Update `services-copy.ts` too |
| New JSON section does not appear | Templates render fixed keys; arbitrary sections, metrics/testimonials need development |
| Missing image | Check filename case, local file, media key and root-relative URL |
| Old image remains | Version its filename, update the source, rebuild and check browser/CDN caching |
| 3D sign/illustration unchanged | Replace model/baked artwork, not the JSON picture |
| New project missing | Check published state, media and homepage selection |
| Sample partner cards remain | Use `trust.clients`, published and not placeholders |
| New person missing | Use `people.json`, published and not placeholders |
| Video shows a still image | Cards/mobile spatial surfaces use posters; check placement and autoplay policy |
| Video cover breaks home | Keep image primary media for selected projects; video goes in the gallery |
| Contact link absent | Add verified destination and remove its placeholder flag |
| Search description old | Update effective `pages.<page>.seo`, not just its fallback |
| Public content old | Rebuild/publish; pushing `source` alone does not publish |

After reviewing the complete content release, follow [the deployment guide](DEPLOYMENT_GUIDE.md).
