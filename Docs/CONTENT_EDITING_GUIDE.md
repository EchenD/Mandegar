# Mandegar page review and content editing guide

Reviewed on 7 October 2026. This describes the current implementation, including the CMS detail-route and Studio locale fixes made during this review. It does not certify content approval or change the deployed website.

## Are the other pages finalized?

The page templates exist in Persian, English and Arabic. The fallback site has six concept projects, seven services, and five other pages per language: 54 non-home URLs altogether. Content approval and some CMS connections remain unfinished.

| Page | What already works | What is needed before calling it final |
| --- | --- | --- |
| `/fa/projects` | Project archive, category filters, links to individual projects | Approved projects, categories and archive introduction |
| `/fa/projects/{slug}` | Hero media, challenge, approach, scope, services, outcome, credits, gallery and optional related work | Real project facts, approved photography/video, final case-study copy and translations; all six fallback projects are concept examples |
| `/fa/services` | Seven service cards link to their own pages | Confirm the service catalog and final descriptions |
| `/fa/services/{slug}` | Hero, summary, detail and capabilities | Approved scope, deliverables and media; useful next additions are related projects and a contact CTA |
| `/fa/about` | Company introduction, approach, principles, geographic statement and optional team/partners | Approved company story, positioning, geographic claims and any people/partner information |
| `/fa/contact` | Telephone, email and WhatsApp links when supplied | Verified destinations; currently the fallback displays unavailable contact information. There is no enquiry form or form backend |
| `/fa/legal` | Editable legal sections and an explicit draft notice | Approved text reflecting actual company details, hosting and tracking setup |
| Shared footer | Main navigation, social links, tagline, geographic statement, copyright and legal link | Final brand treatment, verified contact/social destinations and approved legal content |

Replace `/fa` with `/en` or `/ar` for the other languages. New projects and services use the existing detail templates; creating an entirely new informational page also needs a route and template in code.

The homepage's five service links already go to dedicated pages in the current language:

| Homepage service | Detail URL suffix |
| --- | --- |
| Events | `services/event-production` |
| Exhibitions | `services/exhibitions-and-space` |
| Websites & applications | `services/websites-and-applications` |
| Content creation | `services/content-and-media` |
| Advertising structures | `services/advertising-structures` |

The full service catalog also has `interactive-experiences` and `event-intelligence`. Event intelligence is marked as emerging. The five homepage chapters and seven catalog entries are currently separate content sources.

## Where to update content

Sanity Studio is the intended editing interface. Once it is configured, use these document types rather than changing page components for routine content edits.

| Content | Studio document | Fields currently used by the website |
| --- | --- | --- |
| Project cards and case studies | **Project** | Title, slug, summary, year, sector/location, category/service references, challenge, concept, scope, outcomes, hero media, media gallery, credits, related projects |
| Categories | **Project category** | Label referenced by projects; filters derive from the projects being displayed |
| Service list/detail pages | **Service** | Title, slug, summary, detail, capabilities, media, order and status |
| Projects/services page introductions | **Editorial page** | `pageKey=projects` or `services`, hero kicker, title, introduction, SEO title/description |
| About introduction/body | **Editorial page** | `pageKey=about`, hero fields, sections with exact keys `approach` and `geography`; `approach.items` supplies the principles |
| People and partners | **Team / partner** | Name, localized role/biography, location, partner type, order, visibility |
| Contact introduction | **Editorial page** | `pageKey=contact`, hero fields and SEO title/description |
| Contact destinations | **Contact channel** | Purpose, localized label, phone, WhatsApp, email and availability |
| Privacy and terms | **Legal page** | Title, introduction, sections and approval status |
| Header/footer page links | **Site settings** | Navigation labels, internal paths and order; this is one shared navigation list |
| Footer tagline/geographic line/social links | **Site settings** | Footer line, geographic statement, social label and URL |
| Client logos | **Client** | Name/logo when visibility is `visible` |
| Testimonials | **Testimonial** | Quote, person, role and organization for the selected locale when approved |
| Some homepage narrative and selected projects | **Homepage** | Limited section title/body mappings, proof project references and conversion CTA URL, detailed below |

### First-time setup

1. Create or select the actual Sanity project and dataset, and invite the people who will edit the site.
2. Set `NEXT_PUBLIC_SANITY_PROJECT_ID` and `NEXT_PUBLIC_SANITY_DATASET` in `.env.local` for development and in the deployment's environment settings. Use `.env.example` as the reference; keep tokens out of version control.
3. Run `npm run dev` and open `http://localhost:3300/studio`. A production Next.js server exposes this route only when `ENABLE_EMBEDDED_STUDIO=true` is set. A static GitHub Pages export does not include Studio; use local Studio or a separately hosted Studio.
4. In the Sanity project's API settings, add the Studio origins (including `http://localhost:3300` and the production Studio origin) to CORS Origins with Allow credentials enabled for those Studio origins. See [Sanity's Studio setup instructions](https://www.sanity.io/docs/studio/installation).
5. Configure the production site's actual URL with `NEXT_PUBLIC_SITE_URL` and publish the first approved documents.
6. Verify a complete project, service, contact channel, legal page and translated editorial page on the actual deployment before handing editing over.

Studio's translation plugin now writes the `locale` field used by the website. It applies to document types with a locale field; Site settings, clients, metrics, contact channels and team/partner records are shared documents. Check that existing localized records have the correct locale; this configuration change does not migrate old records or create translations.

### Adding or updating a project

1. Create a **Project** or open the existing record. Select its locale (`fa`, `en` or `ar`) and fill the relevant language fields.
2. Supply a stable URL slug, title, summary, year, location and category/service references.
3. Complete **Challenge**, **Concept** (displayed as Approach), **Scope** and **Outcomes**. Add credits and related projects where useful.
4. Upload approved hero/gallery media, write descriptive alt text, and record usage rights. For video, explicitly set Kind to `video`, use the image field for its poster, and supply video/caption URLs; a video URL alone does not switch the media kind.
5. Keep the project/media placeholder flags on while they describe concept examples. Turn them off only after the content and assets are approved.
6. Set **publicationState** to `published`, then use Sanity's **Publish** action. These are separate steps: publishing a Sanity document alone does not put a project in the archive.
7. Open `/{locale}/projects/{slug}` and the project archive. Select the project in the Homepage `proof` section's project references if you want it included in the selected homepage sequence.
8. Create/publish the other-language counterparts using the same slug. Language switching currently replaces only the locale prefix; it does not resolve different translated slugs.

Do not publish partially filled project records expecting all empty values to disappear. The adapter can inherit concept example text/media for missing fields. The project client's field is stored but is not currently displayed as a dedicated detail-page field.

### Adding or updating a service

Edit a **Service**, fill its locale, title, slug, summary, detail, capabilities and media, then set its status and order and Publish. Existing homepage service URLs depend on the slugs listed above; preserve them unless the homepage links are updated too.

The service detail and catalog will use the CMS content. The animated homepage service title, description and poster remain in `components/experience/services-copy.ts`; those still need a code update. Adding a CMS service creates its catalog/detail entry after the appropriate refresh or rebuild, but does not add another animated chapter.

Service numbering still comes from fallback data, so new services can display repeated or unrelated numbers. Archiving a service with a known fallback slug can restore the local fallback entry rather than hide it. These are development finish items.

### Updating About, Contact and page introductions

Create one **Editorial page** for each page key and locale, and fill hero kicker, title, introduction and SEO title/description. Keep only one active document per page key/locale; the query selects the first match.

About accepts sections with the exact keys `approach` and `geography`. For `approach`, set kicker/title/body and the items array for the principles. For `geography`, set kicker/title/body. Other arbitrary section keys are not rendered by these templates.

Add **Team / partner** records only for approved people or organizations. The current layout displays text; its image field is not yet connected.

For contact details, create **Contact channel** records with purposes `sales`, `general` and/or `international`. Put the phone, email and WhatsApp number/link in those records. Only the first record per purpose is shown. A standalone `whatsapp` purpose currently does not render, and department/country fields are not displayed. Missing contact destinations remain visibly unavailable.

### Updating legal content and the footer

Edit a **Legal page** for each locale. Fill title, introduction and sections, then set status to `approved` and Publish only when the wording is actually approved. This removes the draft notice. The updated-at field is not currently displayed.

Use one **Site settings** document for the shared navigation, footer line, geographic statement and social links. Navigation paths should be internal paths such as `projects`, `services`, `about` and `contact`; the renderer adds the current locale. Social links use full verified URLs. Social link labels are currently shared strings rather than localized fields.

## Homepage editing limits

The current **Homepage** document supports these visible changes:

| Section key | Applied content |
| --- | --- |
| `space` | Discovery title/body |
| `capability` | Activation title/body |
| `experience` | Both reveal and game/experience title/body |
| `proof` | Proof title/body and selected project references |
| `intelligence` | Intelligence title/body |
| `conversion` | Final invitation title/body and internal CTA URL |

Section visibility/order/media controls, hero fields/CTA, and `idea`, `trust` and `memory` copy are modeled but are not applied by the current homepage. The Homepage field labelled SEO title also does not currently control homepage metadata. Main homepage About headings, testimonial headings, five service chapters, interaction/demo text and interface labels remain in code.

For updates outside the connected CMS fields:

| Content | Source |
| --- | --- |
| Local project/service defaults and concept assets | `lib/content.ts` |
| Fallback homepage narrative | `app/[locale]/page.tsx` |
| Homepage service chapters, titles/descriptions/posters and detail slugs | `components/experience/services-copy.ts` |
| Homepage service button/section labels | `components/experience/services-copy.ts` |
| Homepage About, testimonial and partner copy | `components/experience/MandegarExperience.tsx` and the relevant experience components |
| Games, photo booth, installation and touch-demo text | `components/experience/interactions/interaction-copy.ts` and the relevant interaction components |
| Shared UI labels | `lib/i18n.ts` |
| Default SEO and social metadata | `lib/seo.ts` |
| About/contact/legal and archive fallback introductions | Their `app/[locale]/.../page.tsx` files |
| Footer brand, copyright holder, privacy-link label and concept-media note | `components/layout/Footer.tsx` |
| Media files referenced by local content | `public/media/` and `public/images/` |

Changing these source files requires a build and deployment. Images/models baked into the 3D homepage need the asset workflow in `Docs/3D_ASSET_WORKFLOW.md`, not just a Studio upload. Text/content changes do not automatically change the layout, animation sequence or 3D artwork.

## When published changes become visible

| Hosting mode | Publishing workflow |
| --- | --- |
| Running Next.js server | Publish in Studio. Published fetches have a 60-second cache interval; refresh timing also depends on Sanity's CDN and the site's cache. Configure the existing `POST /api/revalidate` endpoint with the `x-sanity-revalidate-secret` header for explicit invalidation |
| Static GitHub Pages | Publish in Studio, then rebuild and redeploy. The exported HTML captures CMS content at build time; publishing alone cannot change it |
| Local fallback without Sanity configured | Edit the source content files, review locally, then build/deploy |

For webhook invalidation on a Next.js server, set `SANITY_REVALIDATE_SECRET` on the server and use the same value in the webhook's `x-sanity-revalidate-secret` header. The protected preview enable URL uses that value in its `secret` query parameter.

The existing Pages commands are `npm run build:pages` to prepare/review an export and `npm run deploy:pages` to publish it. The deployment script contains a repository, branch, base path and site URL; verify those destinations before publishing. This review does not deploy anything.

Dedicated project/service static paths now come from the published CMS catalogs per locale, with local fallback preserved when CMS content is absent. This fixes the previous missing-page problem for new CMS slugs. A newly added slug still needs another static build; the live site's existing export cannot gain it automatically.

Static export excludes `/studio`, `/api/revalidate` and draft-preview endpoints. Server preview additionally requires `SANITY_API_READ_TOKEN` and the protected `/api/draft-mode/enable` route. Neither the Studio nor webhook/draft routes should be promised on GitHub Pages.

## Footer finish proposal

Use the existing responsive footer as the foundation:

1. **Brand:** approved logo/name and one short company line.
2. **Navigation:** Projects, Services, About and Contact, with a clear Start a project destination.
3. **Contact:** verified email, telephone/WhatsApp and social links; an address only if supplied and approved. Read contact destinations from the existing Contact channel records so they have one editing location.
4. **Bottom row:** copyright and privacy/terms. Keep the concept-media notice while concept assets remain; review its removal when those assets are replaced. Language selection is optional because it already exists in the header.

Navigation/social/tagline/geographic copy is already editable. Contact links in the footer, an uploaded logo, and consistent editable branding/copyright need implementation. The footer currently hardcodes `MANDEGAR` even though the header uses the Site settings title. No final contact details or brand assets were invented during this review.

## Remaining development work before content handover

- Connect homepage service content to its service records, while preserving the five authored scene chapters and stable detail links.
- Expose the remaining meaningful homepage text/settings in Studio or remove unsupported controls from the editor interface.
- Make project publication state consistent across detail, featured and related-project queries; archiving is not yet a reliable public-removal mechanism.
- Distinguish intentionally archived services from absent CMS records when applying local fallbacks; fix service numbering for new entries.
- Add useful required-field validation so incomplete records do not inherit unrelated concept examples. Rights status is currently recorded but does not itself prevent media rendering.
- Finish the footer contact/brand connections and the optional service related-project/contact CTA sections.
- Decide whether contact needs an enquiry form; no form/backend exists today.
- Add `aria-pressed` to project filter buttons so selection is announced to assistive technology.
- Review unsupported fields: global SEO/social images, analytics settings, callback-form flag, redirects, team images and metrics are modeled but not fully connected. Image focal-point handling also needs review.
- Add an explicit CMS-request failure policy. Fallback currently handles unconfigured/empty content, not a network error from an already configured CMS.

## Content needed from Mandegar

Approved company description and positioning; confirmed service scope; project titles, facts, case studies and rights-cleared media; actual email/telephone/WhatsApp/social destinations; final logo/brand assets; approved legal wording; Persian/English/Arabic translations; and any verified people, partner, client or testimonial records.

Once those are supplied and the development gaps above are resolved, the routine workflow can be: **open Studio → edit content → preview → Publish → refresh or rebuild for the hosting mode**.

## Verification during this review

- All 57 current localized URLs (54 non-home pages plus three homepages) returned HTTP 200 with a localized H1 and a non-empty page title. Service/project indexes contain all 39 expected detail links.
- 35 existing page/footer browser checks passed, including desktop/tablet/mobile layouts, locale direction, navigation, metadata, automated accessibility checks and footer keyboard/tap access.
- All seven new service-link checks passed after synchronizing keyboard activation with homepage readiness: six desktop/mobile reduced-motion cases across the three languages plus animated homepage navigation.
- Repository lint and TypeScript checks passed. `npm run build:pages` completed successfully and prepared a static production export without publishing it.
- Configured-client verification covered new CMS-only project/service slugs in all locales, build-time published reads, normal draft-preview behavior and absent/empty-CMS fallbacks. Actual publishing to a live Sanity dataset was not exercised; validate that workflow during setup.
