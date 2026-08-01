# Mandegar Experience Website

Persian-first, CMS-ready experiential website for Mandegar. The site is intentionally useful before Sanity credentials and approved project media are available: local fallback content keeps every route renderable, while the Sanity adapter takes over automatically when environment variables are configured.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000/fa`. English is available at `/en` and Arabic at `/ar`.

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
2. Run the Studio with the Sanity CLI using `sanity.config.ts`.
3. Open `/studio` to use the embedded Studio route after deployment.
4. Add `SANITY_REVALIDATE_SECRET` and configure a Sanity webhook to `POST /api/revalidate` with the `x-sanity-revalidate-secret` header.
5. Enable preview with `/api/draft-mode/enable?secret=...&redirect=/fa`.

The schema supports site settings, homepage modules, localized projects, project categories, services, testimonials, clients, metrics, contact channels, team/partners, redirects, and media metadata. Content is organized by locale and translation group so Persian, English, and Arabic can be published independently.

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

## Git checkpoints

- `edbef6d` — foundation, multilingual shell, fallback content, generated media
- `bc4cd1c` — editorial routes, Sanity client, queries, and page architecture
- `ec66307` — Sanity schemas

Continue implementation in small commits so each milestone remains recoverable.
