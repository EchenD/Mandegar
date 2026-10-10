# Updating Mandegar website content

The website now reads local JSON files from `content/`. Sanity, Studio, tokens, webhooks and runtime content requests have been removed. Text is included in the built website, so visitors only need access to your hosting and any media CDN you choose.

## Page completion

The non-home templates are complete in Persian, English and Arabic: project and service archives, dedicated detail pages, About, Contact, legal, and shared navigation/footer. They include responsive typography, breadcrumbs and relevant next steps. Projects include case-study navigation, galleries, related work and previous/next links. Services include deliverables, process, FAQs and related work. Contact includes a copyable project brief rather than a form without a receiving backend.

Content approval is separate. The six sample projects remain labelled concept examples. Generated media remains labelled. Contact destinations and social accounts are intentionally empty until verified. Legal is an explicit draft and is excluded from indexing until approved. No clients, performance figures, awards, addresses or team members have been invented.

## Where to edit

Open these files in a text editor or through your repository's browser interface. Routine changes only need the relevant JSON file and, for local media, an asset in `public/`.

| Content | File |
| --- | --- |
| Projects, case-study text, categories and relationships | `content/projects.json` |
| Services, capabilities, deliverables, process and FAQs | `content/services.json` |
| Media paths, alt text, captions, placeholders and rights | `content/media.json` |
| Archive introductions and About/Contact copy | `content/pages.json` |
| Shared labels, CTAs, notices, About workflow and brief fields | `content/page-copy.json` |
| Navigation, brand, footer, social links, address and social image | `content/site.json` |
| Email, phone and WhatsApp channels | `content/contacts.json` |
| Legal text, approval status and review date | `content/legal.json` |
| Approved people and partners | `content/people.json` |
| Approved clients/testimonials; reserved metric records | `content/trust.json` |
| Homepage project/About/collaboration/finale labels and sample disciplines | `content/journey.json` |
| Default page titles and search descriptions | `content/seo.json` |
| Shared interface labels | `content/ui.json` |
| Legacy homepage narrative and optional overrides | `content/homepage.json` |

Localized fields share this structure:

```json
{
  "fa": "متن فارسی",
  "en": "English text",
  "ar": "النص العربي"
}
```

Fill all three languages. JSON requires double quotes, no comments and no trailing comma after the last item. `npm run content:check` reports the file and field to correct.

## Update or add a project

1. Edit a record in `projects.json`, or copy a complete record to add one.
2. Give it a unique lowercase URL slug, such as `project-name`. The same record supplies all three language versions, so switching language preserves the URL.
3. Replace title, summary, category, challenge, approach, scope and outcome. Use approved client, year, location and credit information. Leave optional client/credits absent until supplied.
4. Set `media` and `gallery` to keys in `media.json`. Set `serviceSlugs` and `relatedProjectSlugs` to existing record slugs. The template can also suggest other published projects.
5. Use `publicationState: "draft"` while preparing a record, `"published"` when it should appear, or `"archived"` to hide it. Drafts and archived records are excluded from lists, detail routes and generated public links.
6. Keep `isPlaceholder: true` for concept examples. Change it only after real case-study content and media are approved.
7. Validate, preview and rebuild. New published records automatically receive dedicated pages in all three languages.

Do not rename existing published slugs casually: saved links use them. The homepage's five service links also depend on stable service slugs.

## Update or add a service

Edit `services.json`. Records have a slug, localized title/summary/detail, capabilities, media key, deliverables, process steps and FAQs. `status: "emerging"` visibly marks an offering in development. `publicationState` controls public visibility. Service archive numbering follows published record order.

The homepage links use `event-production`, `exhibitions-and-space`, `websites-and-applications`, `content-and-media` and `advertising-structures`. Preserve these slugs. The catalog also includes `interactive-experiences` and `event-intelligence`. Adding a service creates its catalog/detail entry; it does not add an animated homepage chapter.

## Replace media

Place approved files in `public/media/` and reference root-relative paths in `media.json`, for example `/media/projects/project-name/hero.webp`. Do not include `/public`, a locale or the hosting base path; the application adds that path automatically.

Media keys are shared references: changing one updates every record using it. Duplicate a media record with a new key when an asset belongs to only one project.

Media records include `src`, `kind`, localized `alt`, optional `caption`, `isPlaceholder`, `rightsStatus` and `sourceNote`. Keep descriptive alt text in each language, and record source/permissions. Approved media uses `isPlaceholder: false` and `rightsStatus: "approved"`.

For `kind: "video"`, provide a real video `src`, an image `poster`, and captions when speech needs them. `mobileSrc` can supply a smaller version. Cards display the poster; playback controls belong on detail pages. A `video-placeholder` uses an image until real footage is supplied.

An HTTPS media CDN is optional. Set `MEDIA_CDN_ORIGIN=https://media.your-domain.com` in `.env.local` or the build environment and use full URLs from that origin. Text still comes from JSON. Changing a filename/URL requires a rebuild; replacing an existing CDN file also requires handling its cache.

## About, Contact, legal and footer

`pages.json` holds introductions and About sections. Keep About section keys `approach` and `geography`; they map to the template. Principles use `approach.items`, and workflow steps live in `page-copy.json`. `people.json` is empty until approved people/partners are available. Until then, About displays illustrated collaboration roles from `page-copy.json`: edit `aboutTeamRoles` (title, body and a media key), `aboutTeamBody` and `aboutTeamPlaceholderNote` in all three languages. These concept cards are automatically replaced when approved profiles are published.

The standalone Partners page uses `pages.partners` for its introduction and `network` section, with SEO fallbacks in `seo.json`. Its grid uses published, approved client records from `trust.json`. Until approved records are available, it shows the homepage's illustrative marks and role labels from `journey.json`, with the explicit `partnersPlaceholderNote` from `page-copy.json`. The same copy file holds `partnersCtaTitle`, `partnersCtaBody`, and `partnersWebsiteLabel` in all three languages.

To add a person, insert a record like this into the `people.json` array. Replace every bracketed field with approved text in all languages. Keep the record as a draft while preparing it; only published records with `isPlaceholder: false` appear on the website.

```json
{
  "name": "[Approved name]",
  "role": { "fa": "[نقش تأییدشده]", "en": "[Approved role]", "ar": "[الدور المعتمد]" },
  "biography": { "fa": "[معرفی تأییدشده]", "en": "[Approved biography]", "ar": "[نبذة معتمدة]" },
  "publicationState": "draft",
  "isPlaceholder": true
}
```

`location` and `partnerType` are optional plain text fields. Add them only when confirmed; never invent names or a team history to fill the layout.

`trust.json` has `clients`, `metrics` and `testimonials` arrays, all initially empty. Every new record needs `publicationState`, `isPlaceholder` and a non-empty `approvalNote` recording who approved the claim or publication permission. Draft, archived and placeholder records stay hidden. The other fields are:

- Client: `name`, optional root-relative/CDN `logo`, verified HTTPS `url`, and `sector`.
- Metric: localized `label` and `context`, a plain text `value`, optional `unit`, and a non-empty `sourceNote` explaining its evidence and scope.
- Testimonial: localized `quote`, `person`, `role` and `organization`.

Begin with `publicationState: "draft"` and `isPlaceholder: true`. After checking the evidence and permission, set `publicationState: "published"` and `isPlaceholder: false`. Keep approval notes in the content record for later review.

The current homepage collaboration section displays ten generic disciplines with locally drawn sample marks until approved client records are supplied. Edit its headings, discipline names and sample notice in `journey.json`; published client records in `trust.json` replace these examples automatically. This file also holds homepage project, About, typing and finale labels. Testimonial records are validated and reserved for future use; the current homepage composition does not display them.

`contacts.json` supports `sales`, `general`, `international` and `whatsapp`. Add verified `email`, `phone` and/or `whatsapp` fields and set `isPlaceholder: false`. Phones use E.164 format: `+`, the international country code and digits, without spaces or separators. WhatsApp accepts an international number or an HTTPS `wa.me` URL. Multiple channels per purpose are supported. The footer uses the same configured destinations. Missing destinations stay labelled instead of becoming fake links.

`site.json` controls footer text, navigation, `copyrightHolder`, optional localized `address`, `socialLinks`, optional approved `brandMark`, and `socialImage`. Social links use verified HTTPS URLs. Navigation paths are internal suffixes such as `projects`, `services`, `about`, `partners`, and `contact`; locales are added automatically. On the homepage, these links seek the corresponding section. On other pages, they open the standalone page. Legacy homepage hashes `#showcase`, `#services`, `#about`, `#partners`, and `#contact` resolve to the same destinations. The original social card is `public/images/mandegar-social.png`, with editable SVG source beside it.

Edit legal text in `legal.json`. Keep `status: "draft"` until it reflects your actual company, hosting, tracking and media setup and is approved. Set a valid `updatedAt` review date such as `2026-10-07`. `status: "approved"` removes the draft notice and permits indexing/sitemap inclusion. The validator does not certify legal correctness.

## Preview and publish

```bash
npm run content:check
npm run dev
```

Review affected pages at `http://localhost:3300/fa`, `/en` and `/ar`, including a mobile width. Check wording, media crops, contact links and placeholder flags.

Prepare a static export without publishing:

```bash
npm run build:pages
```

The complete uploadable website is written to `out/`. Content validation runs automatically. For a later public launch, `npm run content:check -- --strict` also requires replacing labelled placeholders and approving draft legal content; it intentionally fails while this preview uses examples. For the root of your own domain:

```powershell
npm run build:pages -- -BasePath / -SiteUrl https://your-domain.com
```

Upload the contents of `out/` to your hosting/CDN as a complete release. Configure `NEXT_PUBLIC_SITE_URL` for normal Next.js builds too. There is no CMS to keep online.

For the existing GitHub Pages publishing workflow:

```bash
npm run content:publish
```

This validates, builds, commits the static output and pushes it. Defaults: `git@github-echend:EchenD/Mandegar.git`, branch `main`, base path `/Mandegar`, site URL `https://echend.github.io/Mandegar`. Choose a different destination explicitly:

```powershell
npm run content:publish -- -Repository git@github.com:your-account/your-site.git -Branch main -BasePath / -SiteUrl https://your-domain.com
```

The publishing machine needs Node.js, PowerShell and Git access to that deployment repository. Keep credentials outside content files. Uploading JSON alone does not change the website: text changes become visible after a build and deployment. `npm run deploy:pages` remains an alias for the same publishing workflow.

Metric records are validated and reserved for future use; the current website does not display metrics.

## Homepage boundaries

The homepage design and interaction work are preserved. `homepage.json` contains legacy narrative and optional overrides; `useContentOverrides` remains `false` to preserve the composition. Routine non-home edits do not require enabling it.

Animated service chapters remain in `components/experience/services-copy.ts`. Game/demo text remains in `components/experience/interactions/interaction-copy.ts` and related components. Some homepage text remains in `app/[locale]/page.tsx` and experience components. Changing the 3D scene, animation or baked artwork is a development/asset task; see `Docs/3D_ASSET_WORKFLOW.md`.
