# Mandegar Website Implementation Audit

Reviewed against `Mandegar_Website_Implementation_Brief.docx` on 2026-08-01.

## Executive verdict

The repository is a solid, production-buildable editorial and CMS foundation. It is not yet launch-final because approved Mandegar content, contact destinations, legal wording, final identity assets, production Sanity credentials, deployment configuration, and the complete cinematic spark-to-event scene are not available in the repository.

The code can proceed to staging and content entry. Public launch should wait until every item in “External launch blockers” is closed.

## Acceptance review

| Area | Status | Evidence / remaining condition |
| --- | --- | --- |
| Next.js and React foundation | Pass | Next.js 16.2.12, React 19.2, strict TypeScript, Server Components for editorial routes and client-only interactive islands. |
| Persian, English and Arabic | Pass | Locale routes, server-rendered document `lang`/`dir`, RTL/LTR layouts, route-preserving language switcher, localized metadata and navigation. Final copy still needs native editorial approval. |
| Editorial routes | Pass | Home, Projects, Project detail, Services, Service detail, About, Contact and Legal routes exist and render without CMS credentials. |
| Sanity content model | Pass with deployment condition | Homepage modules/CTAs/media/projects, editorial pages, projects, categories, services, clients, sourced metrics, approved testimonials, contacts, team/partners, legal content, redirects and site settings are modeled. A real Sanity project and content migration are still required. |
| CMS outage behavior | Pass | Local placeholder content keeps public routes usable when Sanity is unavailable or unconfigured. |
| Preview and revalidation | Pass with deployment condition | Draft mode reads `previewDrafts` with a read token; enable/disable routes and secret-verified revalidation exist. Production secrets must be configured. |
| Media pipeline | Pass with content condition | Next Image supports Sanity CDN, mobile crops, modern formats and marked placeholders. Real videos support mobile sources, posters, VTT captions, controls, reduced-motion and data-saving behavior. Approved media is still required. |
| Project evidence | Pass structurally | Cards support multiple categories, year and location. Details support challenge, approach, scope, services, outcomes, credits, galleries and related projects. Current records remain clearly labeled placeholders. |
| Homepage narrative | Pass with content condition | A single persistent R3F canvas now carries a GSAP/ScrollTrigger spark-to-idea-to-space-to-event progression with generic stage, screen, truss, booth and audience primitives. CMS media and project proof remain replaceable placeholders until approved Mandegar assets arrive. |
| Adaptive performance | Pass at foundation level | WebGL uses full/lite quality tiers, capped DPR, visibility pausing, reduced-motion and Save-Data fallbacks, and the Lenis bridge is opt-in through the CMS feature flag. Heavy gallery media remains lazy. Lighthouse CI and real-device performance budgets still need staging measurements. |
| Accessibility | Pass for automated launch baseline | Keyboard menu and filters, Escape handling, focus return, skip link, semantic content, reduced motion, media labels and WCAG A/AA axe scans pass on representative routes. Manual screen-reader and touch-device testing remains a launch task. |
| SEO | Pass structurally | Localized canonical/hreflang/social metadata, CMS-aware sitemap, robots controls and Organization, WebSite, BreadcrumbList, Service and CreativeWork structured data are present. Final production domain and social image are required. |
| Conversion | Pass with content condition | Header CTA, final CTA, contact separation and CMS-controlled phone/WhatsApp/email channels are implemented. Real sales and general contact details are required. |
| Analytics and privacy | Partial | Privacy-conscious event instrumentation exists for locale selection, projects, filters, videos and contact CTAs, and only forwards after consent. A selected analytics provider, consent policy and production IDs are not configured. |
| Legal | Pass structurally, approval required | A localized, CMS-editable legal route exists and clearly marks fallback wording as unapproved. Mandegar/legal counsel must approve final privacy, cookie, terms and media-rights text. |
| Security | Pass at application baseline, upstream advisories remain | Baseline security headers, protected preview secrets, safe preview redirects, no-index Studio metadata and a production-disabled embedded Studio are implemented. Current npm audit advisories remain in the latest available Next/Sanity transitive dependency chains and must be monitored. |
| Automated quality | Pass | ESLint, strict typecheck, production build, responsive Playwright journeys, locale checks, metadata/security checks and automated WCAG scans are configured. |

## External launch blockers

1. Configure a production Sanity project, dataset, read token, webhook secret and editor roles.
2. Replace all placeholder projects and generated images with approved project records and licensed media.
3. Add verified sales phone, WhatsApp, general inquiry, location and social destinations.
4. Obtain final Persian, English and Arabic editorial approval.
5. Obtain final legal/privacy/cookie/media-rights approval and mark the CMS legal record approved.
6. Supply the final logo, colors, typefaces and social sharing image.
7. Replace the generic event-kit primitives with approved 3D models/media when available, then complete final real-device performance profiling.
8. Select analytics/consent tooling, configure only approved non-sensitive events, and document retention.
9. Deploy staging and run Lighthouse, manual screen-reader, iOS Safari, Android Chrome and low-end-device tests using realistic media and network profiles.
10. Configure the production domain, monitoring, backups, redirect inventory, CMS training and editorial operating documentation.
11. Re-run `npm audit` during release preparation and upgrade the latest Next/Sanity dependency chains as patched releases become available.

## Release decision

- Ready for local development: yes.
- Ready for CMS integration and content entry: yes.
- Ready for stakeholder staging review: yes, after environment configuration.
- Ready for public production launch: no, not until the external launch blockers above are closed.
