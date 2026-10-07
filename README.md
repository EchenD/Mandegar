# Mandegar Experience Website

Persian-first experiential website for Mandegar with partially connected Sanity content editing. Local fallback content keeps routes useful before Sanity credentials and approved project media are available. Some homepage and interface copy still lives in source files.

See [Docs/CONTENT_EDITING_GUIDE.md](Docs/CONTENT_EDITING_GUIDE.md) for the current page review, editing instructions, footer proposal and remaining CMS gaps. The earlier brief-by-brief review is archived at [Docs/Old/Implementation_Audit.md](Docs/Old/Implementation_Audit.md).

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3300/fa`. English is available at `/en` and Arabic at `/ar`.
Development uses port 3300. Windows reserved port ranges can change; if startup fails with `EACCES`, check `netsh interface ipv4 show excludedportrange protocol=tcp` and choose a port outside those ranges with `npm run dev -- --port <port>`.

## Production build

```bash
npm run typecheck
npm run build
npm start
```

## Browser QA

Install the pinned Chromium browser once, then run the responsive and route checks:

```bash
npx playwright install chromium
npm run test:e2e
```

Use `npm run test:e2e:ui` for Playwright’s interactive runner. The suite checks the homepage at eight aspect ratios (including narrow mobile, portrait tablet, tall desktop, and ultrawide), then checks About, Services, Projects, Contact, project detail, and service detail at desktop, tablet, and mobile sizes. It also verifies locale direction, keyboard navigation, reduced-motion fallback, project filtering, horizontal overflow, and non-zero media placement.

## CMS setup

1. Create a Sanity project and set `NEXT_PUBLIC_SANITY_PROJECT_ID` and `NEXT_PUBLIC_SANITY_DATASET` in `.env.local`.
2. Run `npm run dev` and open `/studio` to use the embedded Studio locally.
3. On a deployed Next.js server, `/studio` requires `ENABLE_EMBEDDED_STUDIO=true`. Static GitHub Pages exports exclude Studio; use local Studio or host it separately.
4. Add `SANITY_REVALIDATE_SECRET` and configure a Sanity webhook to `POST /api/revalidate` with the `x-sanity-revalidate-secret` header.
5. Enable preview with `/api/draft-mode/enable?secret=...&redirect=/fa`.
6. Set `SANITY_API_READ_TOKEN` for draft preview. Embedded Studio is disabled in production unless `ENABLE_EMBEDDED_STUDIO=true` is explicitly configured.

The schema models site settings, homepage modules, localized projects, project categories, services, testimonials, clients, metrics, contact channels, team/partners, redirects, and media metadata. Not every modeled field is connected to the rendered website; consult the editing guide. Locale-specific documents can be published independently. Keep matching project/service slugs across translations because the language switcher preserves the URL suffix.

On GitHub Pages, CMS edits and newly added project/service URLs require a rebuild and redeploy. The static export includes published CMS detail slugs at build time, but excludes webhook and draft-preview API routes. The webhook/preview steps above apply to a running Next.js server.

## Replacing temporary media

Temporary generated images live in `public/media/placeholders/` and are clearly labelled in the interface. Replace them in Sanity by uploading approved project media with:

- alt text in all required languages;
- caption and usage rights;
- focal point and mobile crop;
- verified project relationship;
- `isPlaceholder` disabled only after approval.

Video placeholders already use the same media abstraction. Add a `videoUrl`, poster image, captions, and mobile source in Sanity without changing page components.

## Content safety

The fallback content contains no invented clients, metrics, awards, contact numbers, addresses, or international project claims. AI/event intelligence is marked as emerging. Replace placeholder copy only with approved Mandegar content and source notes for numeric claims.

## Git workflow

Implementation is committed in recoverable milestones. Use `git log --oneline` to review the complete checkpoint history before deployment or content migration.
