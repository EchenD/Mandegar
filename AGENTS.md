# Repository Guidelines

## Project Structure & Module Organization

This is a Next.js 16 App Router project in TypeScript. Routes and API handlers live in `app/`; localized routes are under `app/[locale]/`, with Persian (`fa`) primary. UI is grouped by responsibility in `components/`. Shared content, localization, SEO, and Sanity adapters belong in `lib/`. Sanity schemas and configuration live in `sanity/` and the root `sanity.*.ts` files. Global styles are in `styles/`, static media in `public/`, Playwright tests in `tests/e2e/`, and references in `Docs/`. Do not edit generated `.next/`, `playwright-report/`, or `test-results/` output.

## Build, Test, and Development Commands

- `npm install` installs the lockfile-pinned dependencies.
- `npm run dev` starts the site; verify `/fa`, `/en`, and `/ar` as relevant.
- `npm run lint` runs Next.js Core Web Vitals ESLint rules across source and tests.
- `npm run typecheck` validates TypeScript without emitting files.
- `npm run build` creates the production bundle; `npm start` serves it.
- `npx playwright install chromium` installs the required browser once.
- `npm run test:e2e` runs the Chromium end-to-end suite; `npm run test:e2e:ui` opens its interactive runner.

## Coding Style & Naming Conventions

Use two-space indentation, semicolons, double quotes, and trailing commas in multiline objects. Use PascalCase for components (`ProjectCard.tsx`), camelCase for functions and variables, and lowercase Next.js route filenames (`page.tsx`, `layout.tsx`, `route.ts`). Keep component CSS in `*.module.css`; reserve `styles/globals.css` for shared rules. Prefer server components unless browser APIs, state, or effects require `"use client"`.

## Testing Guidelines

Playwright is the current test framework. Add scenarios to `tests/e2e/*.spec.ts` and name tests by observable behavior. Cover changed routes at desktop and mobile sizes, including RTL direction, keyboard access, reduced motion, and overflow where applicable. Run lint, typecheck, and relevant end-to-end tests before a PR. No numeric coverage threshold is configured.

## Commit & Pull Request Guidelines

History uses Conventional Commit-style subjects such as `feat: add pointer parallax` and `fix: reveal assembled event scene`. Use a lowercase type (`feat`, `fix`, `test`, `docs`, `chore`) and concise imperative summary. PRs should explain the change, list validation, link issues or brief sections, and include screenshots or recordings for visual changes. Call out locale, CMS schema, environment-variable, and placeholder-media impacts.

## Security & Content Configuration

Copy `.env.example` to `.env.local`; never commit credentials or Sanity tokens. Preserve fallback content when CMS credentials are absent. Do not publish invented clients, metrics, awards, addresses, or rights-unverified media; keep placeholders clearly labeled until approved assets are supplied.
