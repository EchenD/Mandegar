# Hero final polish

## Current behavior

- A fresh forward visit automatically starts a new photo, puzzle, lighting, race, or drawing experience. Replay controls are removed. Reverse travel does not start an interaction, and a fast pass does not pull the camera back.
- Photo, race, lighting, and drawing start at the chapter's authored midpoint. The tabletop puzzle starts at 70% of its chapter because its midpoint still frames the photo booth. The engagement review URL uses this playable composition too.
- Forward scroll fills a shared Skip indicator and gently advances the camera within the current chapter. The virtual and native timelines transfer the exact displayed position on release, preserving fractional motion and dropping arrival momentum. Playing gestures retain ownership and do not scroll the page.
- Puzzle, race, and drawing use 1080 pixels of wheel input or 540 pixels of outside touch movement to fill Skip. Wheel packets are capped at 120 pixels so oversized notches do not instantly skip. Passive sections use 360/180 pixels while their short automatic sequence completes.
- The photo countdown lasts 1.5 seconds, then delivery takes 0.55 seconds. Lighting builds over 2.4 seconds. The 0.9-second result period starts after the message commits and reaches an animation frame; rendering delays do not consume it. Earlier scroll packets do not queue departure. The next onward scroll continues. Click Skip, Escape, and reverse scrolling can leave during the sequence.
- Every exit coordinates a 0.4-second artwork/control fade with camera departure. Reduced motion retains the readable semantic journey without requiring interactions.
- The shared instruction, Skip, and continuation hint occupy one reserved lower area. Completed stations show a short result and continuation hint, without Skip or Replay. The chapter rail, scroll cue, sound control, and work shortcut stay hidden through active, result, unlocked-result, and departing states, then return after departure. Mobile puzzle/steering/drawing controls sit above this area.
- A swipe that releases Skip continues with the same finger. Its release packet is forwarded once, and later packets use the same immediate scroll owner. Pending wheel easing is canceled and fractional movement is preserved, so the handoff does not depend on touch-event bubbling. A reverse departure immediately rearms the station, including a turn forward during the 0.4-second fade.
- Generic interaction chapter headings and paragraphs are replaced with short relevant cues. Drawing retains useful Undo, Clear, and Finish tools; the race retains Pause/Resume and mobile steering.

## Puzzle

The illustration connects an architectural sketch to a finished warm event installation: space, content screens, lighting, a photo booth, and people. The tabletop is the playable surface. The wall monitor progressively restores the ordered story as pieces reach their places, instead of offering a duplicate puzzle and control row.

Completion says: “Mandegar brings every part together into one experience.” Persian and Arabic versions carry the same meaning. Puzzle state and saved artwork are separate from monitor ownership, so the active board does not remain displayed during the booth chapter.

The board is 1.20 by 0.80 world units, shifted 0.35 units along the counter's right direction into the space between the foreground visitors. Its center is approximately `[-12.0995, 0.7696, 8.9375]`. Corners and edge midpoints still fit actual tabletop triangles with a 0.04-unit inset. The original counter and figures stay in place. Desktop framing retains the existing small downward pitch; mobile retains its accessible tile grid.

## Race

The race remains a canvas-based overhead game. Generated blue, ivory, bronze, and silver car sprites and terracotta/asphalt road materials follow the approved warm miniature direction. Painted lane markings align with the simulation's road bounds. The monitor has a compact distance/best display and a small Pause/Resume control. The static monitor image matches the new game.

A traffic collision ends a race. There is no time limit. Independent autonomous driving takes over after departure and never changes the visitor's best score. Pointer presses made during entrance are retained; captured steering continues outside the monitor and releases on cancellation, departure, or focus loss.

Speed rises smoothly from 205 to 365 over 40 seconds of active driving, using `smoothstep(elapsed / 40)`: approximately 212 at 5 seconds, 230 at 10, 285 at 20, and 340 at 30. Pausing freezes difficulty and a fresh attempt resets it. Steering remains 235 pixels per second; conservative single-car traffic spawning preserves room to change lanes. Simulation steps remain at most 1/120 second, with incoming stalls capped at 0.25 seconds.

## Artwork and configuration

All four assets were generated with the built-in imagegen tool. PNG originals are archived in `Docs/hero-flow-review/artwork/`; runtime WebP files total approximately 1.72 MB:

- `public/media/hero/race-cars.webp`: transparent four-car atlas, preserving exact source crop coordinates.
- `public/media/hero/race-road.webp`: overhead asphalt and terracotta shoulder texture; traffic, markings, and HUD are rendered separately.
- `public/media/hero/race-idle.webp`: overhead race image for the static monitor and handoff.
- `public/media/hero/connected-experience.webp`: coherent idea-to-event illustration for the puzzle and idle wall monitor.

Generation prompt set: strict orthographic overhead generic cars without trademarks on a transparent atlas; a vertically continuous charcoal road with terracotta paving and cream/bronze curbs without cars or markings; a matching overhead race with blue player and ivory/bronze traffic without UI; one continuous sculptural illustration evolving from planning linework into a warm event installation, connecting space, content, lighting and participation without text or fabricated client claims.

Asset URLs use the configured public base path. No CMS schema, credentials, environment variables, or GLB source replacement are required.

## Validation

Validated locally on 2026-10-05 with Chromium and one Playwright worker:

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- Race simulation: all eight scenarios passed, covering the speed ramp, pause/resume, fresh reset, 5–144 fps, collision detection between frames, steering at maximum speed, autonomous driving, and invalid/stalled deltas. Both tabletop geometry/atlas scenarios passed too.
- The broad 68-case run finished with 58 passes and 10 failures. Those failures exposed outdated scroll-sample expectations, test observer/seek races and overall timeouts, and the result-release ownership race. The result timer and touch handoff were corrected; test setup was synchronized with actual entry and ownership. Useful interaction assertions remain in place.
- The final focused run passed **23/23 in 15.5 minutes**, including every previously failed case and all seven final-polish cases. It covers sustained booth scrolling, all nine physical desktop puzzle targets and dragging, fresh forward returns, rapid reverse/forward travel, protected results, active/unlocked/departing rail visibility, small RTL screens, reduced motion, entrance steering, fractional easing, same-finger touch continuation, delayed artwork, and painted puzzle/drawing handoffs.
- The broad run also passed the remaining puzzle pointer-cancellation and Persian/Arabic keyboard/touch cases, game blur/multitouch cases, artwork fallback, drawing tools, real intro traversal, fast passes, autonomous best-score isolation, and mobile steering/insights. These were not rerun after the final focused input fixes; the focused run exercises those changed input and result paths.
- `npm run build`: passed; all 59 static pages generated, including `/fa`, `/en`, and `/ar`. The build emitted an existing-process warning that `NODE_TLS_REJECT_UNAUTHORIZED=0` disables TLS certificate verification. Environment settings and credentials were not changed by this task.
- After building, the existing development server still listened on port 3300 (PID 34272). HTTP checks returned 200 for all three home routes, with `rtl` for Persian/Arabic and `ltr` for English. No commit or deployment was made during that polish validation.
- Before committing, the Intelligence-to-lighting reverse-handoff check passed **1/1 in 18.5 seconds**. Its stale midpoint assertion was corrected from 0.5 to 0: the scroll lighting sequence starts at the chapter midpoint.

Final focused command:

```powershell
npx playwright test tests/e2e/hero-polish.spec.ts tests/e2e/hero-artwork-recovery.spec.ts tests/e2e/hero-flow.spec.ts tests/e2e/hero-interaction-recovery.spec.ts tests/e2e/hero-monitor-handoff.spec.ts tests/e2e/hero-scroll-hold.spec.ts tests/e2e/hero-draw.spec.ts --workers=1 --grep 'late puzzle artwork|scroll scenes are reversible|photo and beams return|photo countdown and delivery|slow scroll tail|race result protects|puzzle releases its monitor|reverse then forward input|stage advances its camera|a completed touch|held mobile photo swipe|three longer mobile swipes|small scrolls fill Skip|a completed drawing|next onward scroll fades|continuous scrolling shows|the tabletop puzzle stays clear|keeps the progress rail clear|small RTL screens|reduced motion|a press during' --reporter=line
```

Review captures are saved in `Docs/hero-flow-review/final-polish/`:

- [Desktop tabletop](hero-flow-review/final-polish/puzzle-desktop.png) and [connected result](hero-flow-review/final-polish/puzzle-result.png) at 1440 × 900. The [1680 × 900 tabletop](hero-flow-review/final-polish/puzzle-wide.png) and [wide result](hero-flow-review/final-polish/puzzle-wide-result.png) show the board between the figures, approximately x675–1190 and above the shared controls. All nine tiles accept actual WebGL presses and a real mouse drag at both desktop sizes.
- [Small Persian puzzle](hero-flow-review/final-polish/puzzle-fa-mobile.png).
- [Photo result](hero-flow-review/final-polish/photo-result.png) and [lighting result](hero-flow-review/final-polish/lighting-result.png), with the rail hidden after unlocking.
- [Desktop race](hero-flow-review/final-polish/race-desktop.png), [Persian mobile race](hero-flow-review/final-polish/race-fa-mobile.png), and [Arabic mobile race](hero-flow-review/final-polish/race-ar-mobile.png).
