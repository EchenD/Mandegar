# Mandegar deployment guide

[نسخهٔ فارسی](DEPLOYMENT_GUIDE.fa.md)

Use this guide after editing content with [CONTENT_EDITING_GUIDE.md](CONTENT_EDITING_GUIDE.md). Commands below use **Windows PowerShell** from `D:\Projects\Navid\Mandegar`. Replace example domains, usernames and commit IDs with your own values before running them.

The existing website is **https://echend.github.io/Mandegar/**. Its source repository is **https://github.com/EchenD/Mandegar**.

## Choose your destination

| Destination | Command | Result |
| --- | --- | --- |
| Local development | `npm run dev` | Browser preview at `http://localhost:3300/fa` |
| Current GitHub Pages site | `npm run content:publish` | Builds and publishes under `/Mandegar` |
| GitHub Pages with your domain | `npm run content:publish -- -BasePath / -SiteUrl https://www.your-domain.com` | Publishes at your domain root; complete section 5 first |
| Another static hosting provider | `npm run build:pages -- -BasePath / -SiteUrl https://www.your-domain.com` | Creates `out/` for upload; does not publish |
| A Node.js hosting provider | `npm run build`, then `npm start` | Runs the Next.js server; see section 7 |

Repository branches have different purposes:

| Branch/folder | Purpose |
| --- | --- |
| `source` | Editable code, JSON, original public assets and these guides |
| Remote `main` | Generated website files used by GitHub Pages |
| `out/` | Local static export produced by the publishing script; ignored by Git |
| `.next/`, `.next-static/` | Generated build output; do not edit |

**Pushing `source` saves your changes on GitHub. Publishing builds those changes and updates the website on `main`.** This repository does not currently include a source-branch workflow that automatically builds and publishes every push. Do not push your local `main` branch over the generated website.

## Contents

1. [Prepare your computer](#1-prepare-your-computer)
2. [Validate the release](#2-validate-the-release)
3. [Commit source and publish to the current GitHub Pages site](#3-commit-source-and-publish-to-the-current-github-pages-site)
4. [Preview the exact static export](#4-preview-the-exact-static-export)
5. [Use your own domain with GitHub Pages](#5-use-your-own-domain-with-github-pages)
6. [Deploy to another static host](#6-deploy-to-another-static-host)
7. [Deploy with a Next.js server](#7-deploy-with-a-nextjs-server)
8. [Verify the public website](#8-verify-the-public-website)
9. [Roll back a release](#9-roll-back-a-release)
10. [Troubleshooting and command reference](#10-troubleshooting-and-command-reference)

## 1. Prepare your computer

### Step 1 — Check the tools

Install Node.js and Git for Windows if needed. This repository's Next.js version requires Node.js **20.9 or newer**; the current workspace uses Node.js 22.19. Use a supported Node.js release compatible with this requirement.

```powershell
Set-Location 'D:\Projects\Navid\Mandegar'
node --version
npm --version
git --version
git branch --show-current
git status --short
```

Work on `source`. If another branch is active, finish or safely preserve its changes before switching:

```powershell
git switch source
```

On a new computer only, clone the source branch into an empty destination first:

```powershell
git clone --branch source https://github.com/EchenD/Mandegar.git 'D:\Projects\Navid\Mandegar'
Set-Location 'D:\Projects\Navid\Mandegar'
```

Do not run the clone command into the existing working directory. Before starting a new editing session, pull the current source when your working tree is clean:

```powershell
git pull --ff-only origin source
if ($LASTEXITCODE -ne 0) { throw 'Source update failed; resolve it before editing.' }
```

### Step 2 — Install pinned dependencies

```powershell
npm ci
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
if (-not (Test-Path -LiteralPath '.env.local')) {
  Copy-Item -LiteralPath '.env.example' -Destination '.env.local'
}
```

Use `npm ci` for the versions in `package-lock.json`. Stop a running development server before reinstalling dependencies. Keep `.env.local` out of Git. Local development can use `NEXT_PUBLIC_SITE_URL=http://localhost:3300`.

`MEDIA_CDN_ORIGIN` is optional. Set it only if content uses an external HTTPS media origin. Configure the same origin on the machine/platform that builds the release. Restart the development server after changing environment configuration.

### Step 3 — Check GitHub access

```powershell
git remote -v
git ls-remote origin refs/heads/source refs/heads/main
if ($LASTEXITCODE -ne 0) { throw 'GitHub repository access failed.' }
```

The default publisher uses `git@github-echend:EchenD/Mandegar.git`. `github-echend` is an SSH alias configured on the current computer, not a public hostname. On another computer either configure your own working SSH access or use the HTTPS repository option shown in section 3.

If Git asks for a commit identity, configure your own name and GitHub email for this repository:

```powershell
git config user.name 'YOUR NAME'
git config user.email 'YOUR GITHUB EMAIL'
```

GitHub write access is required to push both branches. For HTTPS, use Git for Windows' credential sign-in when prompted; do not place access tokens in content files or command examples.

## 2. Validate the release

### Step 1 — Validate content and source

```powershell
npm run content:check
if ($LASTEXITCODE -ne 0) { throw 'Fix content validation errors before continuing.' }
npm run lint
if ($LASTEXITCODE -ne 0) { throw 'Fix lint errors before continuing.' }
npm run typecheck
if ($LASTEXITCODE -ne 0) { throw 'Fix TypeScript errors before continuing.' }
```

The `if` checks matter in Windows PowerShell: a failed native command does not automatically stop the rest of a pasted command sequence.

### Step 2 — Check final public content

For the final content launch, run:

```powershell
npm run content:check -- --strict
if ($LASTEXITCODE -ne 0) { throw 'Final content is not ready; resolve the launch review items.' }
```

The repository snapshot on 2026-10-11 reports **27 review items** in strict validation: concept projects/services, placeholder media/contacts and draft legal copy. Regular validation permits labelled preview content. The publishing script runs regular validation during its build; **it does not run strict validation automatically**. Complete the strict check separately before presenting the site as a final content release. See the editing guide for how to replace or remove each kind of placeholder.

### Step 3 — Review in the browser

```powershell
npm run dev
```

Review `/fa`, `/en`, `/ar`, every changed detail page and the homepage phases on mobile and desktop. Test menu links, actual contact destinations, image crops, typing titles, video playback and reduced motion. Use a second terminal for checks; stop the server with `Ctrl+C` when finished.

For release regression:

```powershell
npx playwright install chromium
if ($LASTEXITCODE -ne 0) { throw 'Browser installation failed.' }
npm run test:e2e
if ($LASTEXITCODE -ne 0) { throw 'Review browser test failures before publishing.' }
```

After replacing sample slugs/text, update test expectations where appropriate. A changed fixture is different from a broken route or layout; inspect the report with `npx playwright show-report`.

## 3. Commit source and publish to the current GitHub Pages site

### Step 1 — Check the GitHub Pages setting

In **EchenD/Mandegar → Settings → Pages**, choose **Deploy from a branch**, branch **`main`**, folder **`/ (root)`**, then Save. Check the Pages deployment in the repository's Actions tab after publishing. These are GitHub's branch-publishing controls. [GitHub publishing-source documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

### Step 2 — Review and commit your editable files

```powershell
git status --short
git diff --check
if ($LASTEXITCODE -ne 0) { throw 'Review whitespace/conflict problems before committing.' }
git diff --stat
git add -- content public
git diff --cached --stat
git diff --cached --check
if ($LASTEXITCODE -ne 0) { throw 'Review staged changes before committing.' }
git commit -m 'feat: update approved website content'
if ($LASTEXITCODE -ne 0) { throw 'Source commit failed.' }
git push origin source
if ($LASTEXITCODE -ne 0) { throw 'Source push failed; do not continue to publishing.' }
```

`git add -- content public` stages content/media changes. If you changed homepage TypeScript or documentation, stage the **specific additional files** before committing. For example:

```powershell
git add -- 'app/[locale]/page.tsx' 'components/experience/interactions/interaction-copy.ts' 'Docs/CONTENT_EDITING_GUIDE.md'
```

Review the staged diff before the commit, and include only changes belonging to this release. If there is nothing new to commit, check that the intended source commit is already on `origin/source`, then proceed to publishing.

### Step 3 — Build and publish

On the currently configured computer:

```powershell
npm run content:publish
if ($LASTEXITCODE -ne 0) { throw 'Publishing failed; inspect the error before retrying.' }
```

On a computer using HTTPS rather than the existing SSH alias:

```powershell
npm run content:publish -- -Repository https://github.com/EchenD/Mandegar.git
if ($LASTEXITCODE -ne 0) { throw 'Publishing failed; check repository access and build output.' }
```

Use **one** of these alternatives. The script:

1. Builds with base path `/Mandegar` and site URL `https://echend.github.io/Mandegar`.
2. Checks the static export and puts it in `out/`.
3. Normalizes the static route files required by client navigation.
4. Clones the destination into a temporary directory and replaces the published branch's website files.
5. Adds `.nojekyll`, commits the generated site when it changed and pushes to remote `main`.

The script builds your **current working files**, so commit/review them first. It does not commit or push the editable `source` branch for you. Keep additional hand-maintained files intended for publication in `public/`; files added only to the generated `main` branch can disappear on the next publication.

### Step 4 — Wait for GitHub Pages and verify

Wait until the latest Pages deployment succeeds in GitHub Actions, then open:

- `https://echend.github.io/Mandegar/fa/`
- `https://echend.github.io/Mandegar/en/`
- `https://echend.github.io/Mandegar/ar/`
- `https://echend.github.io/Mandegar/fa/partners/`

Follow the checks in section 8. A successful Git push means the upload succeeded; check the Pages deployment and the public browser view too.

## 4. Preview the exact static export

### Step 1 — Build without publishing

```powershell
npm run build:pages
if ($LASTEXITCODE -ne 0) { throw 'Static build failed.' }
```

This uses the current GitHub Pages base path. Opening `out/fa/index.html` as a local file is insufficient because asset and navigation URLs expect an HTTP server with `/Mandegar`.

### Step 2 — Serve a temporary copy at the matching path

```powershell
$previewRoot = Join-Path $env:TEMP ('mandegar-preview-' + [guid]::NewGuid().ToString('N'))
$previewSite = Join-Path $previewRoot 'Mandegar'
New-Item -ItemType Directory -Path $previewSite -Force | Out-Null
Copy-Item -Path '.\out\*' -Destination $previewSite -Recurse -Force
npx --yes http-server@14.1.1 "$previewRoot" -a 127.0.0.1 -p 3400 -c-1
```

Open **http://127.0.0.1:3400/Mandegar/fa/**, then test English/Arabic and click through interior pages. `npx` downloads the pinned preview utility when needed; `-c-1` disables its cache. Stop it with `Ctrl+C`. It does not change the project's dependencies. [http-server usage](https://github.com/http-party/http-server).

For an export built with `-BasePath /`, serve `out` directly instead:

```powershell
npx --yes http-server@14.1.1 .\out -a 127.0.0.1 -p 3400 -c-1
```

Then open **http://127.0.0.1:3400/fa/**. Production canonicals in the preview still point to the `SiteUrl` used at build time.

## 5. Use your own domain with GitHub Pages

This keeps GitHub Pages hosting and changes the public address. Choose the primary hostname first: for example `www.your-domain.com`, or the apex `your-domain.com`. Replace that example throughout these steps.

### Step 1 — Register the hostname in GitHub

In the repository's **Settings → Pages → Custom domain**, enter the hostname without `https://` or a path and Save. Configure it there before pointing DNS at GitHub. GitHub's documented DNS targets are below. [GitHub custom-domain instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).

### Step 2 — Configure DNS at your domain provider

For `www`, add a CNAME record:

| Type | Name | Target |
| --- | --- | --- |
| CNAME | `www` | `echend.github.io` |

The target has no scheme and no `/Mandegar` suffix. If using the apex, add the four A records below instead; your provider may call the apex name `@`:

| Type | Name | Target |
| --- | --- | --- |
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |

Resolve conflicts with existing records for the same hostname using your DNS provider's controls. Check resolution from PowerShell:

```powershell
Resolve-DnsName -Name 'www.your-domain.com' -Type CNAME
# If using the apex instead:
Resolve-DnsName -Name 'your-domain.com' -Type A
```

DNS and the HTTPS option can take up to 24 hours to become available. Enable **Enforce HTTPS** in GitHub Pages once available. The targets/timing above follow [GitHub's custom-domain documentation](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).

### Step 3 — Preserve the domain through future publications

Create `public/CNAME` in the editable source:

```powershell
Set-Location 'D:\Projects\Navid\Mandegar'
$siteDomain = 'www.your-domain.com'
Set-Content -LiteralPath '.\public\CNAME' -Value $siteDomain -Encoding Ascii
Get-Content -LiteralPath '.\public\CNAME'
```

Use your chosen hostname only. This repository replaces the generated branch's files on publication; a `CNAME` created only on `main` would otherwise be removed. Next.js copies `public/CNAME` into the export so subsequent releases retain it. Commit and push this source change using section 3's source workflow.

### Step 4 — Publish with the domain's root path

```powershell
npm run content:publish -- -BasePath / -SiteUrl 'https://www.your-domain.com'
if ($LASTEXITCODE -ne 0) { throw 'Custom-domain publication failed.' }
```

If HTTPS repository access is needed, add `-Repository https://github.com/EchenD/Mandegar.git` to the same command.

**Use these domain options for every future publication.** The script's defaults still target `/Mandegar`; omitting the options after switching domains builds the wrong asset paths. `SiteUrl` controls absolute metadata/sitemap URLs; `BasePath` controls the URL prefix for routes/assets. Use `/` for root hosting.

### Step 5 — Verify the new address

Open `https://www.your-domain.com/fa/`, `/en/`, `/ar/` and several project/service pages directly. Confirm images, fonts and 3D assets load without requests to `/Mandegar/_next/...`. Run section 8 with the new base URL. Update any external links to the site after verification.

To return to the original project URL, remove the custom domain in GitHub Settings, remove the source `public/CNAME`, commit that change and rebuild using the default publisher options. DNS changes depend on what you want the former domain to serve.

## 6. Deploy to another static host

The exported site can be served as files without running Node.js on the web server. Next.js static export produces HTML, CSS, JavaScript and public assets; server-only features need a different hosting mode. [Next.js static-export documentation](https://nextjs.org/docs/app/guides/static-exports).

### Step 1 — Build for the actual public URL

For a domain root:

```powershell
npm run build:pages -- -BasePath / -SiteUrl 'https://www.your-domain.com'
if ($LASTEXITCODE -ne 0) { throw 'Static export failed.' }
```

For a subfolder such as `https://www.your-domain.com/portfolio`:

```powershell
npm run build:pages -- -BasePath /portfolio -SiteUrl 'https://www.your-domain.com/portfolio'
if ($LASTEXITCODE -ne 0) { throw 'Static export failed.' }
```

Choose one. A GitHub Pages export built with `/Mandegar` cannot simply be uploaded at a domain root; rebuild with the destination's prefix. If moving away from GitHub Pages, remove `public/CNAME` from source when it is no longer intended for that hosting setup.

### Step 2 — Preview the export

Use section 4's server command appropriate to the selected base path. For a custom subfolder, place a temporary copy beneath that same folder name before serving its parent.

### Step 3 — Package or upload all exported files

If your host accepts a ZIP archive, Windows can create one outside the repository:

```powershell
$siteArchive = Join-Path $env:TEMP ('mandegar-site-' + [guid]::NewGuid().ToString('N') + '.zip')
tar.exe -a -c -f "$siteArchive" -C '.\out' '.'
if ($LASTEXITCODE -ne 0) { throw 'Export archive creation failed.' }
Get-Item -LiteralPath $siteArchive
```

Upload/extract the **contents of `out/`** into the host's document root, or the selected subfolder's document root. Keep the directory structure. Include `_next/`, locale directories, `media/`, `models/`, `textures/`, fonts, runtime decoder assets, sitemap/robots and the navigation segment files. Do not filter the upload down to HTML/images or rename generated segment files. `scripts/normalize-static-segments.mjs` has already prepared the client-navigation files.

For an existing server you control, an optional transfer command is:

```powershell
scp "$siteArchive" 'YOUR_USER@YOUR_HOST:/home/YOUR_USER/'
if ($LASTEXITCODE -ne 0) { throw 'Archive transfer failed.' }
```

Replace the account/host/path first. This transfers the archive; your host's upload panel or server procedure must extract it into the correct document root. Back up the existing published files before replacing them. The exact extraction/release command depends on that host's paths and permissions.

### Step 4 — Configure serving and HTTPS

Use normal directory `index.html` serving for paths such as `/fa/partners/`. Keep trailing-slash routes working, preserve filename case, and make sure nonexistent routes return a 404. Avoid an SPA rule that sends every request, including static navigation files, to the homepage HTML.

Configure your domain and HTTPS using that hosting provider's instructions. If serving your own MIME mappings, include WebAssembly (`application/wasm`), GLB (`model/gltf-binary`), KTX2 (`image/ktx2`), WebP, MP4 and WOFF2 alongside HTML/CSS/JavaScript. Static hosting must supply any desired HTTP security/cache headers; Next.js server header rules do not run in this mode.

### Step 5 — Verify

Run section 8 with the new URL. Test both direct page loads and clicking links between pages: either can reveal an incomplete upload or an incorrect base path.

## 7. Deploy with a Next.js server

Use this alternative if your host provides a persistent Node.js process, or you later need server functionality. The existing GitHub Pages site uses the static workflow, so this section is optional.

### Step 1 — Prepare the source on the hosting machine

Use the `source` branch, install dependencies with `npm ci`, and supply your environment configuration. Set `NEXT_PUBLIC_SITE_URL` to the final HTTPS origin. Set `MEDIA_CDN_ORIGIN` if remote media requires it. Keep environment files/tokens outside version control.

For a PowerShell session, the build-time configuration can be set like this:

```powershell
Remove-Item Env:MANDEGAR_STATIC_EXPORT -ErrorAction SilentlyContinue
Remove-Item Env:NEXT_PUBLIC_BASE_PATH -ErrorAction SilentlyContinue
$env:NEXT_PUBLIC_SITE_URL = 'https://www.your-domain.com'
```

These commands clear static-export flags for that terminal. They do not delete project files. On a hosting dashboard, leave those static flags unset and configure the actual site URL there instead.

### Step 2 — Build and start

```powershell
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Next.js server build failed.' }
npm start -- --hostname 127.0.0.1 --port 3000
```

The production preview is available at `http://127.0.0.1:3000/fa`. `npm start` is a foreground process; stopping/closing the terminal stops it. A production host must keep it running and place its HTTPS proxy/load balancer in front of the selected port. Configure that with your provider's service/process controls.

For a managed Node hosting platform, select branch **`source`**, install command **`npm ci`**, build command **`npm run build`**, and start command **`npm start`** unless its Next.js integration supplies the equivalent. Set environment values before the build. Do not select the generated `main` branch as an application source.

### Step 3 — Release subsequent edits

Commit/push source, rebuild on the Node host, then restart its service with the new build. Do not run `content:publish` for this hosting mode: that command publishes a separate static GitHub Pages site. Validate the public host with section 8.

## 8. Verify the public website

### Step 1 — Check public routes and files

This example uses the existing GitHub Pages address. For root custom-domain hosting, replace `$liveBase` with your HTTPS origin without a trailing slash. For subfolder hosting, include the subfolder.

```powershell
$liveBase = 'https://echend.github.io/Mandegar'
$paths = @(
  '/fa/',
  '/en/',
  '/ar/',
  '/fa/projects/',
  '/fa/services/',
  '/fa/partners/',
  '/fa/contact/',
  '/sitemap.xml',
  '/robots.txt',
  '/images/mandegar-finale-logo.webp'
)
foreach ($path in $paths) {
  $response = Invoke-WebRequest -UseBasicParsing -Uri ($liveBase + $path)
  [pscustomobject]@{ Path = $path; Status = $response.StatusCode }
}
```

Expected responses are HTTP 200. This confirms availability; it does not check the rendered layout or whether the content is the version you intended. Also load at least one actual project and service slug from your release.

### Step 2 — Check the rendered release

Use a private browser window or hard refresh, and check:

- Persian/Arabic RTL and English layout; translated headings and the Farsi font.
- Home hero phases, mobile controls, service links, project title hover/focus and partners.
- Header navigation on both home and interior pages; direct detail-page loading and back navigation.
- Project gallery images/videos, poster/loading behavior and contact destinations.
- Mobile at 320–430 CSS pixels, desktop, keyboard access and reduced motion.
- Browser developer tools: missing assets/404s, JavaScript errors and requests using the wrong URL prefix.
- Sitemap/canonical/social URLs for the actual public domain.

Compare a distinctive changed title/image with your local release. If an old image persists, check caching and use a versioned filename as described in the editing guide. If a whole page is old, first check the latest GitHub Pages deployment and the published commit.

## 9. Roll back a release

Restore a known source change and rebuild it for the same destination. This keeps source and generated output consistent.

### Step 1 — Identify the change

```powershell
git branch --show-current
git status --short
git log --oneline -12
```

Stay on `source`. Finish/preserve unrelated edits before reverting. Review the commit that introduced the unwanted change:

```powershell
git show SOURCE_COMMIT_TO_REVERT
```

Replace `SOURCE_COMMIT_TO_REVERT` with the actual source commit ID. For a simple, non-merge commit:

```powershell
git revert --no-edit SOURCE_COMMIT_TO_REVERT
if ($LASTEXITCODE -ne 0) { throw 'Resolve or abort the revert conflict before continuing.' }
npm run content:check
if ($LASTEXITCODE -ne 0) { throw 'Validate the restored content before publishing.' }
git push origin source
if ($LASTEXITCODE -ne 0) { throw 'Rollback source push failed.' }
```

If the revert conflicts, resolve the files and use `git revert --continue`, or cancel that incomplete revert with `git revert --abort`. Do not force-push either branch to resolve this. For a multi-commit or merge release, identify the full set of changes first instead of guessing a commit to undo.

### Step 2 — Publish the restored source

For the original project URL:

```powershell
npm run content:publish
if ($LASTEXITCODE -ne 0) { throw 'Rollback publication failed.' }
```

For a custom domain, use the same `-BasePath / -SiteUrl https://...` options as its successful release. For another host, rebuild and replace/redeploy the exported files or Node application there. Verify the restored public site using section 8.

## 10. Troubleshooting and command reference

| Problem | Action |
| --- | --- |
| `npm`/`git` is not recognized | Install the tool and reopen the terminal |
| PowerShell blocks `npm.ps1` | Use `npm.cmd` in place of `npm` for the shown commands; no execution-policy change is needed |
| Port 3300 or 3400 is occupied | Stop the known server, or choose another port and open that address; development accepts `npm run dev -- --port 3301` |
| JSON/media validation fails | Use the reported file/field; fix translations, references, approval flags or missing files before rebuilding |
| Strict validation fails | Complete the real content/contact/legal review; regular preview success is not final launch approval |
| `github-echend` cannot resolve or SSH access fails | Configure SSH or use the publisher's `-Repository https://github.com/EchenD/Mandegar.git` option; source pushes also need a working origin |
| Need HTTPS for source pushes on a new machine | Use `git remote set-url origin https://github.com/EchenD/Mandegar.git`, then authenticate and retry |
| Pushed source but public page did not update | Run the publisher; then wait for Pages deployment and verify the public URL |
| Publishing build fails | Inspect the first build error; do not upload an old `out/` to work around it |
| Push to published branch is rejected | Check access or concurrent publication; rerun after resolving it so the script clones the current branch; do not force-push |
| Assets request `/Mandegar` on a root domain | Rebuild with `-BasePath /` and the correct `SiteUrl` |
| Assets request the root on the project URL | Rebuild using the default `/Mandegar` options |
| Links work in dev but fail on static hosting | Upload every export file, retain normalized segment files and review the host's rewrites/directory serving |
| Custom domain disappears after publishing | Commit `public/CNAME` on source so the publisher retains it |
| Domain/certificate not ready | Check GitHub Pages custom-domain status and DNS; allow propagation |
| Large video is rejected by GitHub | Optimize it or use the approved external media/CDN workflow in the content guide |
| Image/text still appears old | Confirm the published build, hard refresh and inspect cache/versioned asset filenames |
| Next.js warns headers do not apply to static export | Configure those headers on the hosting server if needed; the exported site does not run a Next.js server |

### Available publishing commands

| Command/option | Meaning |
| --- | --- |
| `npm run build:pages` | Build/normalize `out/` only, using the default GitHub Pages destination settings |
| `npm run content:publish` | Build and publish with default destination settings |
| `npm run deploy:pages` | Alias for the same publishing script |
| `-Repository` | Git destination; changing `origin` alone does not change the publisher's default |
| `-Branch` | Generated output branch; defaults to `main`; it must match the GitHub Pages setting |
| `-BasePath` | URL prefix, defaults to `/Mandegar`; `/` means no prefix |
| `-SiteUrl` | Full public base URL, including a subfolder if used |
| `-BuildOnly` | Script option used by `build:pages`; avoids publishing |
| `-SkipBuild` | Reuses existing `out/`; advanced only, after a fresh verified export for the same destination |

Options are passed after npm's `--`, for example:

```powershell
npm run build:pages -- -BasePath / -SiteUrl 'https://www.your-domain.com'
```

The regular publishing command intentionally rebuilds. `-SkipBuild` neither applies a changed URL configuration to old output nor validates current content by rebuilding it; stale exports can publish the wrong content or break paths.

### Routine update sequence

For the current GitHub Pages site, after editing/reviewing and passing the appropriate browser tests:

```powershell
Set-Location 'D:\Projects\Navid\Mandegar'
npm run content:check
if ($LASTEXITCODE -ne 0) { throw 'Content validation failed.' }
npm run lint
if ($LASTEXITCODE -ne 0) { throw 'Lint failed.' }
npm run typecheck
if ($LASTEXITCODE -ne 0) { throw 'Typecheck failed.' }
git diff --check
if ($LASTEXITCODE -ne 0) { throw 'Review the diff before committing.' }
git add -- content public
# Stage any additional edited source files individually before the commit.
git diff --cached --stat
git commit -m 'feat: update website content'
if ($LASTEXITCODE -ne 0) { throw 'Source commit failed.' }
git push origin source
if ($LASTEXITCODE -ne 0) { throw 'Source push failed.' }
npm run content:publish
if ($LASTEXITCODE -ne 0) { throw 'Publication failed.' }
```

For the **final public content launch**, also require `npm run content:check -- --strict` to pass before committing/publishing. For a **custom domain**, use its domain options on the final publish command. Finish every release with the public checks in section 8.
