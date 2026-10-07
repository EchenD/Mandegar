# Mandegar Experience Website

Persian-first Next.js website with English and Arabic versions. Non-home pages use editable JSON with validation and a static publishing command. No content server or Sanity account is required.

See [the content editing guide](Docs/CONTENT_EDITING_GUIDE.md) for the file map, project/service updates, media replacement, footer settings and publishing instructions. Concept projects and unapproved media remain labelled; contact details and legal text still need owner approval.

## Run locally

```bash
npm install
npm run content:check
npm run dev
```

Open `http://localhost:3300/fa`, `/en` or `/ar`. Copy `.env.example` to `.env.local` for the actual site URL and optional media CDN origin. Keep credentials outside version control.

Development uses port 3300. If Windows reports `EACCES`, check excluded ports with `netsh interface ipv4 show excludedportrange protocol=tcp`, then choose a port using `npm run dev -- --port <port>`.

## Check and build

```bash
npm run lint
npm run typecheck
npm run build
npm start
```

Every production build validates content first. `npm run build:pages` prepares a static website in `out/` without publishing. `npm run content:publish` builds and pushes to the configured GitHub Pages repository; see the guide before choosing a destination.

## Browser QA

```bash
npx playwright install chromium
npm run test:e2e
```

Use `npm run test:e2e:ui` for the interactive runner. Tests cover localized routes, responsive layouts, keyboard access, reduced motion, accessibility, project filtering and the homepage experience.

## Content and media

Edit `content/*.json` for projects, services, page text, labels, contacts, legal, navigation and footer. Put approved assets in `public/media/` or use the configured HTTPS media CDN. Root-relative paths work with root hosting and the existing `/Mandegar` deployment.

Draft and archived records are excluded from catalogs/detail routes. Keep concept and placeholder flags until approved replacements are supplied. Do not add invented clients, metrics, awards, addresses or rights-unverified media. Animated homepage chapters and 3D assets use the separate code/asset workflows in the guide.
