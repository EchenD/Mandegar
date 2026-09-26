# Mandegar Hero Interaction Implementation Report

## Outcome

The pinned homepage hero now contains five exhibition-station interactions at narrative steps 3–7. Their primary visuals and pointer/touch input live on authored objects in the 3D scene: screen content is supplied through live `CanvasTexture` materials, screen input is resolved from Three.js raycast UVs, entry cues and photo/beam effects are scene-space objects, and the HTML layer is limited to a compact accessible control dock. The former proximity HUD, measurements, projected dots, generic `LEARN MORE` sprites, and unintended screen navigation have been removed.

Steps 1–2 and 8–11 retain their existing narrative meaning and scene behavior. `ConnectedJourney` and all post-hero components remain unchanged. The pre-existing `next-env.d.ts` development-route import was preserved after production builds normalized it.

## Delivered behavior

| Phase | Station | Delivered interaction |
| --- | --- | --- |
| `activation` | Photo | Explicit booth entry, countdown, restrained flash, prepared local portrait result, phone/result treatment, replay, and continue. No camera, upload, or network request is used. |
| `engagement` | Touch | A three-part Experience Composer that opens automatically after the engagement shot settles, crossfades from the authored monitor artwork, and introduces Space, Story, People, and the controls in sequence. Each element joins a compact orbit around the display before the final synthesis pulse; Close and Continue reverse the transition back to the authored artwork. |
| `reveal` | Stage | Five independently previewable/activatable beam controls, accumulated stage look, additive scene-space beam lines, monitor finale, and reduced-motion stable presentation. |
| `experiences` | Game | Eight-second timing interaction using pointer, touch, or keyboard, immediate non-competitive feedback, visibility pause/resume, replay, and continue. Reduced motion uses a shorter stable session. |
| `connection` | Drawing | Genuine pointer-captured freehand drawing, live GLB monitor texture, undo, clear, keyboard-accessible preset mark, finish echo, local-only session state, and continue. |

Station entry is explicit; hover never starts an experience. The authored 3D cue or underlying GLB screen can request entry only for the currently available station. Once active, the touch, stage, game, and drawing screens receive normalized scene UV events directly. Touch now keeps its visible controls on the 3D monitor and exposes only a visually hidden semantic keyboard/screen-reader mirror; the other stations retain the accessible dock. Availability is delayed until the camera has settled, and active mode freezes narrative progress, prevents accidental wheel/touch scrolling without breaking the sticky WebGL composition, preserves browser zoom shortcuts, supports `Escape`, restores exact scroll position, and cleans up on cancel, completion, phase exit, client route change, tab visibility change, or scene teardown.

## Architecture and files

The shared system is in `components/experience/interactions/`:

- `interaction-types.ts`, `interaction-registry.ts`, and `interaction-state.ts` define station mapping and the `unavailable → available → active → completing → complete/cancelled` lifecycle.
- `InteractionDirector.tsx` owns availability, entry/exit, focus, scroll lock/restoration, session completion flags, route/visibility cleanup, and the development anchor debugger.
- `interaction-runtime.ts` bridges the DOM interactions to Three.js without station components owning scene or scroll state.
- `interaction-anchors.ts` resolves the 17 authored GLB interaction nodes and retains deterministic fallbacks for a damaged or older asset.
- `InteractionHotspot.tsx` remains as a keyboard/fallback entry control; in WebGL mode the visible entry point is a scene-space cue. `InteractionChrome.tsx` provides the compact accessible control dock.
- `PhotoBoothInteraction.tsx`, `TouchComposerInteraction.tsx`, `StageBeamInteraction.tsx`, `GameInteraction.tsx`, and `DrawingInteraction.tsx` contain only station-local behavior.
- `interaction-copy.ts` contains English, Persian, and Arabic controls and instructions.
- `HeroInteractions.module.css` contains responsive station presentation, focus treatment, motion fallbacks, and effects.

Scene integration changes:

- `BakedMandegarScene.tsx` resolves/projects authored anchors, renders scene-space cues/photo/beam effects, restricts direct GLB entry to the active phase, and routes screen raycasts to station logic with normalized UV coordinates.
- `BakedScreenController.tsx` accepts and disposes live `CanvasTexture` overrides for the interactive, video-wall, game, and main monitors. Generic hover sprites and navigation were removed.
- `ExperienceCanvas.tsx`, `MandegarExperience.tsx`, and `ScrollMotion.tsx` connect runtime quality, narrative phase, fallback mode, interaction locking, and cleanup.
- `baked-scene-contract.ts` declares and validates the required authored interaction-anchor contract separately from the base scene nodes.
- `scene-config.ts` and `experience-state.ts` no longer carry the removed proximity/screen-navigation state.
- `SpatialLabels.module.css` and `spatial-hud.ts` were deleted.
- `app/[locale]/page.tsx` now describes the five stations consistently in Persian, English, and Arabic.
- `playwright.config.ts` accepts `PLAYWRIGHT_PORT`, allowing production verification when the default port is occupied.

Focused tests were added in the seven files specified by the plan: `hero-interaction-shell`, `hero-photo`, `hero-touch`, `hero-stage`, `hero-game`, `hero-draw`, and `hero-interaction-responsive`.

## Phase results

| Planned phase | Result |
| --- | --- |
| 0 — Baseline | Captured the untouched `HEAD` from a detached temporary worktree and the final release at all 11 direct phase URLs, desktop and mobile: 22 baseline plus 22 release PNGs in `test-results/`. Recorded existing nodes, asset sizes, warnings, and initial-load behavior. |
| 1 — Cleanup | Removed the proximity HUD, technical labels, measurements, dots, generic screen hover labels, dead focus/navigation state, and unintended screen navigation. The intentional step-9 intelligence effect remains. |
| 2 — Anchors | Integrated and validated all 17 exact authored nodes from the revised GLB, including matching beam pairs, projection, cleanup, deterministic damaged-asset fallbacks, and development-only `?anchors=1` visualization. |
| 3 — Shared shell | Added the shared reducer/director, registry, scene-space entry cue, compact accessible dock, localized controls, focus trap/restore, explicit input tracking, scroll/camera hold, exact restoration, session flags, and teardown paths. |
| 4 — Photo | Complete local simulated-capture sequence with timer cleanup, reduced-motion path, local demo portrait, flash, phone result, replay, cancel, and continue. |
| 5 — Touch | Complete Space/Story/People composer with automatic settled-shot entry, authored-artwork crossfade, staged monitor intro/outro, direct scene-UV input, frame-coalesced updates, forgiving tap/drag activation, reset/continue/close controls, semantic keyboard parity, three localized scene-space signals, and a completion pulse. |
| 6 — Stage | Complete five-beam control with anchor pairs, focus/hover preview, accumulation, monitor finale, additive rendering, adaptive/reduced behavior, and no runtime relighting or autoplay sound. |
| 7 — Game | Complete short timing game, pointer/keyboard parity, pause/resume, animation-frame cleanup, non-persistent result, functional replay, and continue. |
| 8 — Drawing | Complete freehand pointer/touch drawing with pointer capture, correct canvas mapping, undo, clear, preset mark, finish echo, and listener/texture cleanup. |
| 9 — Integration | Replaced steps 3–7 copy in all three locales, moved the primary visual/input path onto the physical 3D screens, reduced the DOM layer to accessible controls, fixed active-mode sticky-canvas loss, and captured release checkpoints at desktop/mobile sizes. |
| 10 — Release QA | Lint, TypeScript, production build, focused station suites, regression suites, locale/mobile/RTL, touch, reduced motion, save-data fallback, WebGL fallback, route teardown, visibility teardown, and visual captures completed. |

## GLB anchor status

The current `public/models/mandegar/mandegar_exhibition.glb` is 1,914,492 bytes. Its interaction contract is complete:

```text
root_exhibition
├─ section_left
├─ fxAnchor_interaction_photo_hotspot
├─ fxAnchor_interaction_photo_flash
├─ fxAnchor_interaction_photo_phone
├─ fxAnchor_interaction_touch_hotspot
└─ screen_interactive_16x9
├─ section_central
├─ fxAnchor_interaction_stage_hotspot
├─ fxAnchor_stage_beam_origin_01
├─ fxAnchor_stage_beam_origin_02
├─ fxAnchor_stage_beam_origin_03
├─ fxAnchor_stage_beam_origin_04
├─ fxAnchor_stage_beam_origin_05
├─ fxAnchor_stage_beam_target_01
├─ fxAnchor_stage_beam_target_02
├─ fxAnchor_stage_beam_target_03
├─ fxAnchor_stage_beam_target_04
├─ fxAnchor_stage_beam_target_05
└─ screen_video_wall_21x9
└─ section_right
├─ fxAnchor_interaction_game_hotspot
├─ fxAnchor_interaction_draw_hotspot
├─ screen_game_16x9
└─ screen_main_16x9
```

The obsolete `fxAnchor_hud_left`, `fxAnchor_hud_central`, and `fxAnchor_hud_right` nodes were removed from the contract. The runtime now reports no missing interaction anchors. Defensive fallbacks remain for older/damaged assets and are removed on scene teardown. `?anchors=1` shows projected station anchors and fallback status only in development; its client-only flag is initialized after hydration so the debug route no longer causes an SSR/client mismatch.

## Validation evidence

Final commands and results:

```text
npm run lint
PASS

npm run typecheck
PASS

npm run build
PASS — Next.js 16.2.12 production build, 59/59 static pages generated

PLAYWRIGHT_PORT=3001 npx playwright test \
  tests/e2e/baked-scene-contract.spec.ts \
  tests/e2e/hero-interaction-shell.spec.ts \
  tests/e2e/hero-photo.spec.ts \
  tests/e2e/hero-touch.spec.ts \
  tests/e2e/hero-stage.spec.ts \
  tests/e2e/hero-game.spec.ts \
  tests/e2e/hero-draw.spec.ts \
  tests/e2e/hero-interaction-responsive.spec.ts
PASS — 28 tests
```

Existing regression evidence:

```text
baked-scene assets/contract, camera projection, intro score,
narrative score/progress/copy timing, and stage presets
PASS — 41 tests

targeted existing mandegar hero regression scenarios
PASS — 14 tests
```

The final focused run covered all five station lifecycles, exact phase availability, scene-cue entry, direct raycast input on the touch/drawing/game/stage GLB screens, completion, replay/reset/undo paths, scroll locking/restoration, Escape, removed legacy UI, touch input, mobile overflow, locales, and reduced fallback. It also loaded the exact reported `/en?intro=0&phase=reveal&anchors=1` URL and asserted that no hydration or missing-anchor error was emitted. The route test used a client-side Next navigation and verified active UI and scroll interception were removed; visibility dispatch likewise cancelled active mode.

`git diff --check` passes. The diff contains no `ConnectedJourney.tsx` or downstream section changes. Searches find no removed HUD labels or `LEARN MORE` content outside negative regression assertions.

## Manual browser verification matrix

| Area | Evidence/result |
| --- | --- |
| `/fa`, `/en`, `/ar` | Production Playwright route/layout checks pass; station controls and phase narratives are localized. Persian and Arabic are RTL, English LTR. |
| Desktop | All 11 baseline and release phases captured at 1440×900 and visually sampled. |
| Mobile | All 11 baseline and release phases captured at 390×844; locale interaction panels report no horizontal overflow. |
| Keyboard-only | Focusable fallback entry controls and dock controls, visible focus, focus trap/restore, Escape cancellation, presets, beam buttons, game Space/Enter, and drawing preset were exercised. |
| Touch/pointer | A real `hasTouch` browser context opened the mobile photo station; desktop tests dragged directly across the rendered touch and drawing screens, clicked the game monitor, and activated all five stage-wall UV zones. |
| Reduced motion | WebGL fallback and immediate station availability pass; flash/sweeps are removed or stabilized and game duration is shortened. |
| Save data | Production smoke with `navigator.connection.saveData = true` showed the fallback scene and correct stage hotspot. |
| WebGL fallback | Reduced/save-data runtime uses the fallback surface while retaining accessible station controls. |
| Direct phase URLs | All 11 URLs captured; steps 3–7 expose exactly one matching station after settle. |
| Cleanup | Escape, continue, visibility, client route, phase mismatch, unmount, animation-frame/timer/listener cleanup, texture disposal, and exact scroll restoration are covered. |

To verify locally:

```powershell
npm install
npm run dev
```

Open `http://localhost:3000/fa`, `/en`, and `/ar`. Useful direct checks are:

```text
/en?intro=0&phase=activation
/en?intro=0&phase=engagement
/en?intro=0&phase=reveal
/en?intro=0&phase=experiences
/en?intro=0&phase=connection
/fa?intro=0&phase=connection
/ar?intro=0&phase=reveal
/en?intro=0&phase=reveal&anchors=1   (development only)
```

If port 3000 is occupied:

```powershell
npm run dev -- -p 3100
```

For the production bundle:

```powershell
npm run build
$env:PORT = "3100"
npm start
```

## Performance and accessibility findings

- Live canvases are bounded: touch/drawing use 960×540, stage uses 1050×450, and the portrait game uses 540×720.
- Touch composition coalesces canvas updates through `requestAnimationFrame`; the game owns an animation frame only while playing and pauses when hidden.
- Photo timers, game frames, drawing listeners/pointer capture, runtime fallback helpers, screen media, materials, and `CanvasTexture` instances have explicit cleanup/disposal paths.
- Station media is mounted only with its station. The neutral portrait is 82,130 bytes and loads locally. Station modules remain in the hero client chunk because they are small; no network service or dynamic remote media is introduced.
- Static architecture retains baked/unlit materials. Flash and beams use overlays/additive geometry; no runtime relighting was added.
- Dialogs expose `role="dialog"`, `aria-modal`, labelled titles, status regions, `aria-pressed` state, 44px-class controls, focus trapping/restoration, visible focus, Escape, and keyboard alternatives.
- Scroll prevention deliberately excludes Ctrl/Meta wheel zoom and standard modifier shortcuts.
- Headless Chromium may emit its environment-level software-WebGL/SwiftShader notice. The untouched baseline also emitted an existing LCP suggestion for `interactive-wall.webp`. Focused tests observed no application console exceptions or shader errors.

## Replaceable media and known limitations

- `public/media/placeholders/photo-experience.webp` is an explicitly neutral local demo portrait. Replace it with an approved prepared portrait of similar aspect ratio; no interaction code needs to change.
- The GLB stores geometry, materials, screens, and anchor transforms; interaction state and input logic necessarily remain in the application runtime. The implementation keeps that boundary while ensuring the user-facing result is rendered and manipulated in 3D rather than in a duplicate DOM canvas.
- No real capture, upload, persistence, authentication, QR/phone transfer, leaderboard, public drawing storage, or backend was added by design.
- Baseline reconstruction initially exposed an isolated-worktree Turbopack symlink restriction; a lockfile-local dependency install produced the genuine untouched capture set. This affected evidence collection only, not the application.
