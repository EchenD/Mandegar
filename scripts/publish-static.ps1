param(
  [string]$Repository = "git@github-echend:EchenD/Mandegar.git",
  [string]$Branch = "main",
  [string]$BasePath = "/Mandegar",
  [string]$SiteUrl = "https://echend.github.io/Mandegar",
  [switch]$BuildOnly,
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$exportDirectory = Join-Path $projectRoot "out"
$generatedExportDirectory = Join-Path $projectRoot ".next-static"
$temporaryClone = Join-Path ([System.IO.Path]::GetTempPath()) ("mandegar-pages-" + [guid]::NewGuid().ToString("N"))
$previousStaticExport = $env:MANDEGAR_STATIC_EXPORT
$previousBasePath = $env:NEXT_PUBLIC_BASE_PATH
$previousSiteUrl = $env:NEXT_PUBLIC_SITE_URL

try {
  if (-not $SkipBuild) {
    $env:MANDEGAR_STATIC_EXPORT = "1"
    $env:NEXT_PUBLIC_BASE_PATH = $BasePath
    $env:NEXT_PUBLIC_SITE_URL = $SiteUrl.TrimEnd("/")
    if (Test-Path -LiteralPath $generatedExportDirectory) {
      $resolvedGeneratedExport = (Resolve-Path $generatedExportDirectory).Path
      $expectedGeneratedExport = Join-Path $projectRoot ".next-static"
      if ($resolvedGeneratedExport -ne $expectedGeneratedExport) {
        throw "Refusing to clean an unexpected static-build cache: $resolvedGeneratedExport"
      }
      Remove-Item -LiteralPath $resolvedGeneratedExport -Recurse -Force
    }
    Push-Location $projectRoot
    try {
      & npm.cmd run build
      if ($LASTEXITCODE -ne 0) { throw "Static export failed." }
    } finally {
      Pop-Location
    }

    if (-not (Test-Path -LiteralPath (Join-Path $generatedExportDirectory "fa\index.html") -PathType Leaf)) {
      throw "Next.js did not generate a complete static export in $generatedExportDirectory."
    }
    if (Test-Path -LiteralPath $exportDirectory) {
      $resolvedExport = (Resolve-Path $exportDirectory).Path
      if ($resolvedExport -ne (Join-Path $projectRoot "out")) {
        throw "Refusing to replace an unexpected export directory: $resolvedExport"
      }
      Remove-Item -LiteralPath $resolvedExport -Recurse -Force
    }
    New-Item -ItemType Directory -Path $exportDirectory | Out-Null
    Copy-Item -Path (Join-Path $generatedExportDirectory "*") -Destination $exportDirectory -Recurse -Force
  }

  if (-not (Test-Path -LiteralPath $exportDirectory -PathType Container)) {
    throw "Static export folder not found: $exportDirectory"
  }
  if (-not (Test-Path -LiteralPath (Join-Path $exportDirectory "fa\index.html") -PathType Leaf)) {
    throw "The export is incomplete: fa/index.html was not generated."
  }

  $finaleLogoExport = Join-Path $exportDirectory "images\mandegar-finale-logo.webp"
  if (-not (Test-Path -LiteralPath $finaleLogoExport -PathType Leaf)) {
    throw "The export is missing the finale logo: $finaleLogoExport"
  }

  if ($BuildOnly) {
    Write-Host "Static website export is ready at $exportDirectory."
    return
  }

  & git clone $Repository $temporaryClone
  if ($LASTEXITCODE -ne 0) { throw "Could not clone $Repository." }

  Push-Location $temporaryClone
  try {
    $currentBranch = (& git branch --show-current).Trim()
    & git show-ref --verify --quiet "refs/remotes/origin/$Branch"
    $remoteBranchExists = $LASTEXITCODE -eq 0
    $branchPrepared = $false
    if ($currentBranch -eq $Branch) {
      # An empty repository can already be on an unborn branch with no ref yet.
      $branchPrepared = $true
    } elseif ($remoteBranchExists) {
      & git checkout $Branch
      $branchPrepared = $LASTEXITCODE -eq 0
    } else {
      & git checkout --orphan $Branch
      $branchPrepared = $LASTEXITCODE -eq 0
    }
    if (-not $branchPrepared) { throw "Could not prepare branch $Branch." }

    $resolvedClone = (Resolve-Path $temporaryClone).Path
    $temporaryRoot = (Resolve-Path ([System.IO.Path]::GetTempPath())).Path
    if (-not $resolvedClone.StartsWith($temporaryRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw "Refusing to clean a deployment directory outside the system temporary folder."
    }

    Get-ChildItem -LiteralPath $resolvedClone -Force |
      Where-Object { $_.Name -ne ".git" } |
      Remove-Item -Recurse -Force
    Copy-Item -Path (Join-Path $exportDirectory "*") -Destination $resolvedClone -Recurse -Force
    [System.IO.File]::WriteAllText((Join-Path $resolvedClone ".nojekyll"), "")

    & git add --all
    & git diff --cached --quiet
    if ($LASTEXITCODE -eq 0) {
      Write-Host "GitHub Pages content is already up to date."
      exit 0
    }

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss K"
    & git commit -m "deploy: publish Mandegar static build ($timestamp)"
    if ($LASTEXITCODE -ne 0) { throw "Could not commit the static export." }
    & git push origin "HEAD:$Branch"
    if ($LASTEXITCODE -ne 0) { throw "Could not push the static export." }

    Write-Host "Published $exportDirectory to $Repository ($Branch)."
  } finally {
    Pop-Location
  }
} finally {
  $env:MANDEGAR_STATIC_EXPORT = $previousStaticExport
  $env:NEXT_PUBLIC_BASE_PATH = $previousBasePath
  $env:NEXT_PUBLIC_SITE_URL = $previousSiteUrl
  if (Test-Path -LiteralPath $temporaryClone) {
    $resolvedClone = (Resolve-Path $temporaryClone).Path
    $temporaryRoot = (Resolve-Path ([System.IO.Path]::GetTempPath())).Path
    if ($resolvedClone.StartsWith($temporaryRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
      Remove-Item -LiteralPath $resolvedClone -Recurse -Force
    }
  }
}
