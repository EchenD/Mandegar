# Stages 01–03: art direction and 3D production brief

These three stages form one sentence: **silence → discovery → coordinated activation**. Do not treat them as three unrelated effect shots. The architecture remains the same world; attention and energy are the things that change.

## Shared rules

- Preserve the current intro end frame as the exact home frame of stage 01.
- Keep one dominant subject per stage. Background detail must support that subject rather than compete with it.
- Camera movement belongs in the authored GLB clip `camera_master_loop`. Code adds only restrained breathing and pointer response.
- Keep geometry modular and instanced where possible. Bake static light/shadow information into compact textures; reserve real-time lights for the guided signal and activation accents.
- Test the exact resting points with `?intro=0&phase=arrival`, `discovery`, and `activation`.

## 01 — Arrival / silence and scale

**Meaning:** an intact but dormant exhibition world, waiting for an idea.

**Composition**

- Use a wide, legible establishing shot with a strong central negative space for the centered copy.
- The model silhouette should read immediately, but small interactive details should not ask for attention yet.
- Keep the horizon, major architectural frame and central core stable enough that the intro-to-loop seam feels invisible.

**Motion and light**

- Camera breathing and pointer response are intentionally near-still.
- Only a sparse atmospheric particle field remains; no routed signals or halo activity.
- Use broad neutral light, low contrast and almost no colored spill.
- Do not show spatial HUD labels in this stage.

**3D work**

- Finalize the large silhouette first: floor, canopy, rear veil, left/right wings and central core.
- Prefer a low-poly shell with authored normals over small geometric detail.
- Create clean lightmap/texture gradients that keep the center quiet behind the copy.

## 02 — Discovery / one guided signal

**Meaning:** the visitor notices one organizing intelligence inside the dormant space.

**Composition**

- Move closer on a shallow diagonal; preserve enough of the overall architecture to understand where the core lives.
- The central core is the only hero. Screens and booths remain secondary silhouettes.
- Leave a clean copy-safe region on the authored text side of the frame.

**Motion and light**

- Introduce one restrained floor/surface trace that leads toward `hero_core_shell`.
- Increase particle presence modestly and permit a small pointer response, without turning the field into a celebration.
- A single cool guided light may separate the core from the background.
- Show the assembly/core HUD annotation only during this stage.

**3D work**

- Give `hero_core_shell` a simple readable volume and a controlled emissive seam.
- Keep `stage_signal_edge` continuous and topology-clean so particles can sample it reliably.
- Place `fxAnchor_camera_focus` at the visual center of the core, not merely the model origin.

## 03 — Activation / systems wake together

**Meaning:** the discovered core sends a coordinated pulse through the experience system.

**Composition**

- Traverse laterally enough to reveal a relationship between the core, one wing and its interaction surface.
- At the `.31` resting point, the left activation system should be the clear subject. The right system becomes the bridge toward the reveal.
- Preserve readable depth layers: foreground interaction, midground core, background architecture.

**Motion and light**

- Routed particles now connect the core to screens and interaction surfaces.
- Pointer response becomes noticeable but remains subordinate to scroll.
- Contrast, localized cyan/magenta accents and screen energy increase together.
- The left activation HUD owns progress `.225–.34`; the right activation HUD owns `.34–.455`.

**3D work**

- Keep these named nodes stable: `booth_left_shell`, `touch_left_surface`, `booth_right_shell`, `touch_right_surface`, `led_left_screen_16x9`, `led_right_screen_16x9` and `led_central_media_21x9`.
- Add `fxAnchor_left_interaction` and `fxAnchor_right_interaction` at the real visual interaction points.
- Use separate low-cost emissive materials for signal edges and screens so code can activate them independently.
- Screen meshes need clean UVs; their media can change without re-exporting the model.

## Current code controls

| Concern | Location |
| --- | --- |
| Exact resting anchors | `narrative-score.ts` → `arrival`, `discovery`, `activation` previews |
| Stage energy and behavior | `stage-presets.ts` → first three presets |
| Authored camera animation | GLB node `camera_mandegar_master`, clip `camera_master_loop` |
| Fallback camera blockout | `scene-config.ts` → `cameraKeyframes` |
| HUD ranges and model nodes | `scene-config.ts` → `spatialLabels` |
| Routed particle anchors | `scene-config.ts` → `particles.modelNodes.signalRoutes` |
| Material activation | `MandegarModel.tsx` |
| Environment and accent lights | `WorldEnvironment.tsx` |

## Acceptance check

- Stage 01 is understandable with particles temporarily disabled.
- Stage 02 has exactly one obvious focal path and one hero object.
- Stage 03 reads as a coordinated system, not a collection of blinking parts.
- Each resting frame leaves the active copy readable at desktop, portrait and mobile aspect ratios.
- The transition into stage 04 has visibly more energy available; stage 03 must not spend the reveal climax early.
