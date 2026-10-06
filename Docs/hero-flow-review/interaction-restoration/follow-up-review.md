# Restoration follow-up review

This review compares the implementation at `47cb775` with the approved restore
list and the earlier audit of `5cce261` through `9a5a03a`. It covers the hero
restoration, rather than the later full-site validation round.

Implementation: `d480b4d` fixes completion input handling; `688d6b4` aligns
recovery and navigation validation with the authored flow.

## Gaps found and corrected

1. Native scroll events from wheel motion that began before completion were
   cancelling the result's queued advance. A regression reproduced a completed
   result that never advanced. Cancellation now follows new scroll input and
   explicit seeks, while the earlier wheel motion can finish normally.
2. New scroll input immediately after Finish could arrive before React installed
   the result listeners. A second regression reproduced an unwanted automatic
   advance after that input. The permanent input tracker now records an input
   version at completion, so the result effect honours input received before
   its listeners were installed.
3. Recovery helpers still assumed the old page hold and used a reverse position
   inside the new authored viewing window. Fresh visits now leave that window
   before approaching it again. Recovery checks use automatic completion,
   authored Skip scrolling, section shortcuts, and keyboard-only entry focus.
   The Escape-in-motion check observes real intermediate frames instead of
   depending on the fake clock to advance GSAP's ticker.

## Earlier removals checked

| Earlier removal or change | Verified disposition |
| --- | --- |
| Camera breathing and pointer spring motion | Restored, including during participation. The spring, damping, position offsets, and pitch/yaw/roll modulation remain. |
| Camera descent and gradual turn at the ending | Restored after frame 2500, with the original four-unit descent and gradual turn toward the center monitor. |
| Ending duration, overlap, smoothing, and project reading time | Retained from the original ending. Desktop/mobile handoff checks cover forward travel, reverse travel, and resizing. |
| Interaction suppression of breathing/mouse motion and touch camera tilt | Removed as requested. Interaction entry no longer changes the camera pose or suppresses its ambient motion. |
| Game-only vignette/color presentation | The game-specific vignette is removed. The hero renderer retains no postprocessing, `NoToneMapping`, and exposure 1. Ordinary section lighting and vignette remain. |
| Finger-release, mobile quiet periods, large-wheel guard, and wheel grace | Restored. The old chapter-relative 70% touch trigger stays replaced by the authored viewing window. |
| Result reading protection and duplicate completion guard | Restored: 900 ms after a paint opportunity, one completion per attempt, followed by the agreed 850 ms native-scroll advance. The old indefinite wait for another scroll is intentionally replaced. |
| Restart/departure cleanup | Completion work, departure timers, and running Finish motion are cancelled before a fresh attempt. Installation, race, and drawing state reset on entry. A fresh race retains the visitor's best score. |
| Shared keyboard focus and body fallback | Keyboard entry focuses Skip without scrolling. Exit restores previous focus when the interaction owns focus or removed controls leave it on the body. Pointer/wheel arrival retains existing focus. |
| Page holds, virtual camera progress, accumulated Skip thresholds, and held-swipe forwarding | Intentionally remain removed. Native scroll traverses the authored phase and can take over the completion advance. |
| Lamp holds and literal wheel/swipe step thresholds | Intentionally remain replaced by reversible authored frame cues and their existing fades. |
| Fixed camera anchors, timing warp, equal phase lengths, and repeating clip playback | Intentionally remain replaced by direct source-frame sampling, authored windows/travel gaps, and final-frame clamping. |
| Previous text midpoint calculation and shared blank intervals | The approved authored-window timing remains. The earlier desktop/mobile text review verified intelligence and invitation visibility and bounds; this review changes no text timing values. |
| Old effect timing ranges | The effects remain mapped to the authored phase timing. Their old fixed ranges are not reinstated. |

The updated GLB, handoff values, responsive FOV, longer camera scroll distance,
and ending configuration are unchanged by this follow-up. The camera export
check confirms `camera_master_loop` lasts 83.3333 seconds and validates all eleven
phases and eleven effect cues.

Handoff validation still permits camera-travel gaps, optional rest frames, and a
photo Ready cue later than the window's first frame. The old contiguous-window
rules are not restored. Development-only render-count instrumentation remains
removed; CreativePanel breathing and pointer tuning controls remain available.
The earlier work-shortcut test change did not remove project category UI from
the application, and this pass introduces no category change.

The prior client changes also remain: installation buttons and monitor views,
reversible photo playback with localized Ready, Mandegar lighting artwork without
dark masks, asset loading percentages, section navigation, the scroll cue, and
service detail links. The old puzzle, countdown, and timer-driven photo/lighting
playback are intentionally not restored.

The game still has no Replay control. Its existing `onReset` callback is not
currently invoked by the game UI; live retry validation therefore covers leaving
the window and starting a fresh forward visit. No new retry UI was introduced.

## Validation boundaries

Fourteen focused Chromium scenarios passed across the review runs:

- Five completion cases: readable result and duplicate Finish, new wheel input,
  earlier wheel motion, Escape during advance, and input immediately after Finish.
- Two keyboard/focus cases: Escape restores focus without scrolling; fresh
  installation visits cover keyboard arrival, wheel arrival, and authored Skip.
- Desktop and mobile race completion, including a fresh run and retained best score.
- Reverse arrival and section navigation while completion is queued.
- Desktop and mobile ending after frame 2500, including reverse and resize.
- Live reduced-motion fallback and blocked interaction reopening.

Scoped ESLint, TypeScript, the camera export check, and `git diff --check` passed.

The focused recovery/navigation tests were aligned with the current authored
flow. The complete suite and full-site visual review remain scheduled for the
final validation round. Other legacy photo/lighting checks that assert the old
held interaction are outside this restoration pass and still need alignment
during that round. The earlier visual captures and text samples remain in
[README.md](README.md).
