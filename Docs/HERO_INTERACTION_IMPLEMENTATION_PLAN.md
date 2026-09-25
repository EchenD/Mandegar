# Mandegar Hero Interaction Implementation Plan

## 1. Purpose

This document defines the implementation sequence for revising only the pinned
homepage hero and its modular GLB scene. All post-hero sections are frozen and
must remain unchanged.

The revised hero keeps the existing eleven-step structure while changing steps
3–7 into deliberate, short interactive demonstrations:

| Step | Existing internal ID | Revised purpose |
| --- | --- | --- |
| 1 | `arrival` | Quiet arrival; no change |
| 2 | `discovery` | Full exhibition discovery; no change |
| 3 | `activation` | Simulated photo-booth capture |
| 4 | `engagement` | Touch-display content composition |
| 5 | `reveal` | Central-stage beam control |
| 6 | `experiences` | Short game-zone interaction |
| 7 | `connection` | Freehand drawing on the right monitor |
| 8 | `proof` | No conceptual change |
| 9 | `intelligence` | No conceptual change |
| 10 | `invitation` | No conceptual change |
| 11 | `loop` | No conceptual change and handoff to the page |

The existing internal phase IDs should remain stable during this work. They are
used by camera timing, stage presets, copy timing, tests, query-string previews,
and creative tooling. Changing their public meaning is substantially safer than
renaming them throughout the runtime.

## 2. Creative principle

The result should feel like a virtual exhibition demonstration, not five
unrelated website widgets. Each station follows the same simple pattern:

1. The camera arrives and settles.
2. One intentional hotspot invites interaction.
3. The visitor explicitly enters the interaction.
4. Narrative copy becomes secondary or temporarily hides.
5. The interaction produces an immediate response on the real GLB screen or at
   an authored effect anchor.
6. The visitor exits or completes it and scrolling resumes.

Interactions must be optional. A visitor must always be able to continue the
narrative without playing them.

## 3. Scope boundaries

### In scope

- The hero's loader, intro, scroll narrative, camera, copy, GLB scene, screen
  media, particles, sound, interaction UI, and fallback presentation.
- GLB node-contract additions needed to locate interaction cues and effects.
- Desktop mouse, keyboard, mobile touch, RTL, reduced-motion, and save-data
  behavior for the hero.
- Tests directly related to the hero and GLB contract.

### Out of scope

- `ConnectedJourney` and every section after the hero.
- Character, crowd, architecture, or skeletal animation.
- A real camera feed, real photo capture, file upload, phone transfer, QR
  delivery, authentication, or backend persistence.
- Public storage or moderation of drawings.
- Rebuilding geometry unless a separately approved GLB export is supplied.

## 4. Existing UI to remove first

The current scene contains proximity-driven technical annotations that can
appear unexpectedly when the pointer approaches projected GLB anchors. The
current screen controller can also show generic `LEARN MORE` labels on hover.
These behaviors conflict with the new deliberate interaction cues.

Phase 1 will remove:

- The `SpatialLabels` DOM overlay and proximity activation behavior.
- Technical labels such as `MEDIA CORE`, `EXPERIENCE NODE`, measurements, and
  their projected dots.
- Generic `LEARN MORE` hover sprites on scene screens.
- Pointer/click navigation on screens outside an active, intentional station.
- Dead phase-rail code unless the rail is intentionally restored as a separate
  navigation task.

Phase 1 will preserve:

- Narrative headings and body copy.
- The authored screen images.
- The transition particle field and ambient dust.
- The step-9 intelligence/data-flow visual. It is a named narrative effect and
  is not the random proximity HUD. It can be removed separately if requested.
- Keyboard-accessible hero controls, with their labels updated for the new
  interactions.

No replacement interaction should be added until this cleanup passes its tests.

## 5. GLB interaction-anchor contract

The existing screen meshes remain the surfaces that receive live textures:

| Purpose | Existing mesh |
| --- | --- |
| Touch display | `screen_interactive_16x9` |
| Central stage | `screen_video_wall_21x9` |
| Game display | `screen_game_16x9` |
| Drawing display | `screen_main_16x9` |

The photo booth does not currently have a dedicated screen contract, so it uses
authored empty nodes for its hotspot, flash, and phone result.

### Required new node names

Add the following empty/helper nodes to the exhibition scene with these exact
names:

```text
root_exhibition
├─ section_left
│  ├─ fxAnchor_interaction_photo_hotspot
│  ├─ fxAnchor_interaction_photo_flash
│  ├─ fxAnchor_interaction_photo_phone
│  └─ fxAnchor_interaction_touch_hotspot
├─ section_central
│  ├─ fxAnchor_interaction_stage_hotspot
│  ├─ fxAnchor_stage_beam_origin_01
│  ├─ fxAnchor_stage_beam_origin_02
│  ├─ fxAnchor_stage_beam_origin_03
│  ├─ fxAnchor_stage_beam_origin_04
│  ├─ fxAnchor_stage_beam_origin_05
│  ├─ fxAnchor_stage_beam_target_01
│  ├─ fxAnchor_stage_beam_target_02
│  ├─ fxAnchor_stage_beam_target_03
│  ├─ fxAnchor_stage_beam_target_04
│  └─ fxAnchor_stage_beam_target_05
└─ section_right
   ├─ fxAnchor_interaction_game_hotspot
   └─ fxAnchor_interaction_draw_hotspot
```

### Placement rules

- Export anchors as empty transform nodes with no renderable geometry or
  material.
- Keep the same meters, origin, axes, and unapplied world placement as the rest
  of the modular scene.
- Parent each anchor to the section shown above.
- Place each `interaction_*_hotspot` at the center of the physical object the
  visitor is expected to select, slightly in front of its visible surface to
  avoid depth ambiguity.
- Place `photo_flash` at the visible light/camera source inside the booth.
- Place `photo_phone` where a phone/result treatment can appear without
  covering the booth or important crowd silhouettes.
- Place beam origins at five visually useful points in the suspended ceiling or
  ring system.
- Place the matching beam target with the same numeric suffix on the stage or
  floor. Each origin/target pair defines one complete beam.
- Do not rename existing `section_*`, `screen_*`, reveal, signal, or camera
  nodes.
- All node names are case-sensitive and form a runtime API.

Five beam pairs are the baseline. More can be added later using the same
zero-padded naming convention, but the first implementation and tests will
require exactly `01` through `05`.

### Contract rollout

1. Add the names to `baked-scene-contract.ts` as optional development anchors.
2. Log one precise development warning for each missing anchor.
3. Export and install the revised `mandegar_exhibition.glb`.
4. Inspect the nodes in the browser at every relevant camera checkpoint.
5. Promote them to required contract nodes only after the GLB is approved.

This two-stage rollout prevents the current production scene from breaking
while the revised asset is being prepared.

## 6. Shared interaction architecture

All five experiences must use one controller rather than independent ad-hoc
event handlers.

### Interaction state

```text
unavailable → available → active → completing → complete
                         ↘ cancelled ↗
```

The shared state should contain:

- Active station: `photo | touch | stage | game | draw | null`.
- Lifecycle state from the diagram above.
- Whether scrolling is temporarily locked.
- Whether the narrative copy is visible, dimmed, or hidden.
- Station-specific progress and result data.
- Input method: keyboard, pointer, or touch.
- A session-only completion flag for each station.

Station state must reset on route change and WebGL teardown. It must not leak
between locales or persist to a server.

### Entry rules

- A station becomes available only inside its assigned narrative range.
- Availability begins after the camera has substantially settled, not at the
  first frame of the phase transition.
- The hotspot must be a deliberate, stable button projected from its GLB anchor.
- Hover alone never starts an interaction.
- Clicking/tapping the underlying GLB screen can enter the same interaction,
  but only while that station is available.
- Keyboard focus exposes the same action and visible focus treatment.

### Active-mode rules

- Freeze narrative progression at its current point without changing the
  camera composition.
- Temporarily prevent wheel/touch scrolling from leaving the phase.
- Do not disable browser zoom or normal accessibility shortcuts.
- Hide or dim narrative copy when it obstructs the interaction.
- Display a consistent close/continue control.
- `Escape` cancels on desktop.
- A phase change, route change, visibility change, or WebGL fallback must cleanly
  exit active mode.

### Exit rules

- Restore scrolling and the exact narrative position.
- Restore copy and scene controls without a layout jump.
- Preserve the result for the remainder of the current hero session when useful.
- Never force completion before allowing the visitor to continue.

### Rendering approach

- Use HTML for buttons, instructions, text entry alternatives, focus handling,
  and accessibility.
- Use `CanvasTexture` for live monitor content.
- Use scene-space lines/planes/particles for flashes and beam effects.
- Continue using the existing baked material for static architecture.
- Do not introduce runtime lights that attempt to relight the baked GLB.
- Any perceived illumination must be authored as additive geometry, shaders,
  screen content, or restrained overlay color.

## 7. Phased implementation and test gates

Every phase must be implemented, reviewed, and tested before the next begins.

### Phase 0 — Baseline capture and safety

#### Work

- Record screenshots at all eleven phase preview URLs on desktop and mobile.
- Record current camera position/composition at steps 3–7.
- Confirm the exact overlays targeted by Phase 1.
- Record current console warnings, asset sizes, and initial load behavior.
- Add no new visual behavior.

#### Tests

- `npm run typecheck`
- `npm run lint`
- Existing narrative score, camera, stage-preset, and baked-contract tests.
- Desktop and mobile screenshots for steps 1–11.

#### Acceptance gate

- We have a reliable before-state and can distinguish planned changes from
  regressions.

### Phase 1 — Remove random information UI

#### Work

- Remove projected proximity annotations and measurement UI.
- Remove generic hover labels.
- Gate or remove existing screen navigation handlers.
- Delete corresponding dead state, refs, callbacks, CSS, and test expectations.
- Verify that step 9's intentional intelligence layer remains intact.

#### Tests

- No spatial annotation nodes appear at any pointer position.
- No generic `LEARN MORE` sprite appears.
- Screens cannot navigate unexpectedly in steps 1–11.
- Narrative copy, camera, screen images, particles, and step-9 data flow remain.
- Keyboard traversal contains no invisible dead controls.

#### Acceptance gate

- The current hero is visually clean and stable before interaction work begins.

### Phase 2 — GLB anchors and runtime contract

#### Work

- Add the optional anchor contract and validation.
- Install the revised GLB containing the approved anchors.
- Add a development-only anchor visualizer behind a query flag such as
  `?anchors=1`.
- Project each anchor to screen space and verify it remains attached throughout
  the associated camera shot.

#### Tests

- Automated contract test for all approved anchor names.
- No missing-anchor warnings with the approved GLB.
- Origin/target beam pairs have matching numeric suffixes.
- Anchor visualizer is absent in production and without the query flag.

#### Acceptance gate

- Every cue and effect can be positioned from authored GLB data; no important
  placement relies on hard-coded screen coordinates.

### Phase 3 — Shared interaction shell

#### Work

- Implement the shared state machine and station registry.
- Add phase-aware projected hotspots.
- Add enter, cancel, complete, continue, and cleanup behavior.
- Integrate interaction locking with GSAP/Lenis/native scrolling.
- Add consistent DOM controls and localized copy placeholders.
- Add reduced-motion and WebGL-fallback representations.

#### Tests

- Only the correct station is available in each phase.
- Entering interaction mode holds camera and narrative progress.
- Wheel, touch, keyboard, close, Escape, and phase cleanup behave correctly.
- The page resumes at the same scroll position after exit.
- RTL and LTR placement remains inside the viewport.
- Reduced-motion visitors can understand each demonstration without animation.

#### Acceptance gate

- A placeholder interaction can be entered and exited reliably at all five
  stations before any station-specific effect is built.

### Phase 4 — Photo booth

#### Experience

1. A single camera hotspot appears at the photo booth.
2. The visitor taps/clicks it.
3. A short countdown or ready pulse appears.
4. The authored `photo_flash` point produces a strong but brief flash.
5. One prepared portrait is selected from an approved local set.
6. The portrait appears as a result card and animates toward the authored phone
   position.
7. The visitor can replay once or continue.

#### Content requirements

- Approved prepared portraits in consistent dimensions and visual treatment.
- No implication that a real photograph was captured or transferred.
- Optional localized explanation such as “Experience preview.”

#### Tests

- Flash is restrained or removed under reduced motion.
- Result selection never requests camera permission or network access.
- Repeated activation does not leak textures or timers.
- Phone/result remains legible on desktop and mobile.
- Cancel works before and after the flash.

#### Acceptance gate

- The complete fake-capture sequence is understandable without explanatory
  body text.

### Phase 5 — Touch-display composer

#### Experience

- The display presents a small set of draggable visual ingredients rather than
  ordinary navigation buttons.
- Dragging or tapping changes a composed visual on
  `screen_interactive_16x9` immediately.
- Provide three clear presets as keyboard and touch alternatives.
- A reset action restores the initial composition.

#### Tests

- Pointer drag, touch drag, keyboard selection, reset, and cancel work.
- Input remains within the interaction and does not accidentally scroll.
- Canvas texture updates are throttled and disposed correctly.
- Output is not distorted on the authored screen UVs.

#### Acceptance gate

- A first-time visitor can create an obvious visual change in one action.

### Phase 6 — Central-stage beam control

#### Experience

- Five controls correspond to the five authored beam pairs.
- Hover/focus previews a beam; click/tap activates it.
- Activated beams can accumulate into a short complete stage look.
- Completion triggers one restrained finale on the central monitor.
- Sound, if included, is optional, muted initially, and uses the existing sound
  preference.

#### Tests

- Every beam starts and ends at the matching GLB anchors.
- Beam effects never affect static-geometry raycasting.
- Adaptive mode uses a reduced-cost effect.
- Reduced motion shows a stable illuminated composition rather than sweeps.
- No sound starts without a user gesture.

#### Acceptance gate

- The effect reads as stage control while preserving the baked scene's visual
  quality.

### Phase 7 — Game zone

#### Experience

- Implement one short, single-action rhythm or target game within
  `screen_game_16x9`.
- A session lasts approximately 8–10 seconds.
- The visitor taps/clicks/presses one key when a target reaches its timing zone.
- Show immediate feedback and a non-competitive completion result.
- Allow replay or continue; no leaderboard or server storage.

#### Tests

- Identical rules for mouse, touch, and keyboard.
- Game timing pauses when the tab is hidden or interaction is cancelled.
- No timers or animation frames survive teardown.
- The game remains readable on the narrow/portrait-looking authored display.
- Result language avoids unverifiable claims or persistent scoring.

#### Acceptance gate

- The game is understandable within two seconds and finishes without delaying
  the hero journey.

### Phase 8 — Freehand drawing wall

#### Experience

- Entering the station clears a local drawing canvas.
- Pointer or touch produces a luminous stroke on `screen_main_16x9`.
- Provide undo-last-stroke, clear, finish, and continue controls.
- On finish, the drawing can emit a brief particle/line echo from the monitor.
- The drawing remains local to the current session and is never uploaded.

#### Tests

- Pointer capture keeps strokes continuous when moving quickly.
- Touch drawing does not scroll or zoom the page while active.
- Coordinates map correctly into monitor texture space at all viewports.
- Clear, undo, cancel, phase exit, and route teardown dispose all resources.
- A keyboard-accessible preset mark is available for visitors who cannot draw
  with pointer input.

#### Acceptance gate

- Drawing feels immediate, does not distort, and leaves no persistent user data.

### Phase 9 — Narrative and visual integration

#### Work

- Replace steps 3–7 copy with approved text matching each station.
- Tune camera holds so interaction hotspots do not appear while the camera is
  still moving significantly.
- Resolve copy/monitor/crowd overlap at desktop, portrait, and mobile sizes.
- Normalize hotspot, control, completion, and transition styling.
- Decide whether completed station results leave a subtle session-only trace.
- Keep steps 1–2 and 8–11 visually and behaviorally unchanged except where a
  necessary transition seam is approved.

#### Tests

- Screenshot comparison for all eleven phases in `fa`, `en`, and `ar`.
- One visible narrative copy block at a time outside active interactions.
- No horizontal overflow or clipped controls.
- Direction, font, focus order, and localized labels are correct.
- Direct phase URLs still settle on the intended camera and station.

#### Acceptance gate

- The five stations feel like one designed system and the unchanged phases have
  no unintended regressions.

### Phase 10 — Performance, accessibility, and release QA

#### Work

- Profile initial load, interaction entry, canvas texture updates, and teardown.
- Defer station-specific code and media until shortly before each station.
- Cap canvas resolution and update frequency per quality profile.
- Audit focus management, labels, contrast, reduced motion, and touch targets.
- Run production-build tests, not only development-server tests.

#### Tests

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- Focused Playwright tests for every station.
- Full hero desktop/mobile/RTL/reduced-motion suite.
- No WebGL errors, missing contract warnings, console errors, or duplicate
  resource loads.
- No sustained animation work when the page or hero is outside the viewport.
- Interaction resources return to baseline after repeated enter/exit cycles.

#### Acceptance gate

- Production build is stable, accessible, responsive, and approved visually.

## 8. Test organization

Prefer small focused files rather than adding every scenario to
`mandegar.spec.ts`:

```text
tests/e2e/hero-interaction-shell.spec.ts
tests/e2e/hero-photo.spec.ts
tests/e2e/hero-touch.spec.ts
tests/e2e/hero-stage.spec.ts
tests/e2e/hero-game.spec.ts
tests/e2e/hero-draw.spec.ts
tests/e2e/hero-interaction-responsive.spec.ts
```

Pure timing, state, coordinate, and contract behavior should be tested without a
browser where practical. Browser tests should concentrate on observable input,
visual state, scrolling, accessibility, and WebGL integration.

## 9. Proposed code organization

The exact structure can evolve during implementation, but the intended
responsibilities are:

```text
components/experience/interactions/
├─ interaction-types.ts
├─ interaction-state.ts
├─ interaction-registry.ts
├─ InteractionDirector.tsx
├─ InteractionHotspot.tsx
├─ InteractionChrome.tsx
├─ PhotoBoothInteraction.tsx
├─ TouchComposerInteraction.tsx
├─ StageBeamInteraction.tsx
├─ GameInteraction.tsx
├─ DrawingInteraction.tsx
├─ interaction-texture.ts
└─ HeroInteractions.module.css
```

`InteractionDirector` owns phase availability and lifecycle. Individual station
components own only their local behavior and must not manipulate scroll or
camera state independently.

## 10. Decisions required before each station

The shared foundation can proceed before final media is approved. Each station
requires the following decision before its implementation phase begins:

### Photo

- Final prepared portrait set.
- Countdown versus immediate shutter.
- Phone/result visual design.

### Touch

- What the visitor composes: poster, color world, motion graphic, or campaign
  treatment.
- Number and form of visual ingredients.

### Stage

- Final beam count and colors.
- Whether optional sound is part of the approved experience.
- What the completed stage composition reveals.

### Game

- Rhythm or target mechanic.
- Approved visual language and completion message.

### Drawing

- Brush appearance and palette.
- Finish behavior: hold, replay, particle echo, or line-network echo.

## 11. Recommended execution order

Do not build all station visuals simultaneously. Use this order:

1. Baseline and cleanup.
2. GLB anchor contract.
3. Shared interaction shell.
4. Drawing station as the first technical proof, because it validates touch,
   pointer capture, canvas textures, cleanup, and monitor mapping.
5. Photo station.
6. Touch composer.
7. Stage beams.
8. Game.
9. Narrative integration and full QA.

This order validates the riskiest shared browser mechanics early while the
creative sequence presented to visitors remains steps 3 through 7.

## 12. Definition of complete

The hero-interaction project is complete only when:

- Random proximity information UI has been removed.
- All approved GLB anchors pass the runtime contract.
- Steps 3–7 each provide an optional, polished interaction.
- All five interactions share one predictable entry and exit language.
- Mouse, touch, keyboard, RTL, mobile, reduced-motion, fallback, and cleanup
  behavior are verified.
- Steps 1–2 and 8–11 retain their approved behavior.
- Frozen post-hero sections have not changed.
- Lint, typecheck, production build, focused interaction tests, and the hero
  regression suite pass.
