# Mandegar baked scene asset contract

The production renderer uses the modular assets below directly. All required
files must be present before starting the application.

## Coordinate rules

- Export every GLB with the same world origin, scale and forward axis.
- Use meters and apply object scale before export.
- Do not move an object merely to export it separately.
- Preserve names exactly; code uses them as a stable API.
- Keep all baked meshes UV channel 1 in the 0–1 range with no unintended overlap.
- Quiet and peak maps for one material must have identical dimensions and UV layout.
- Do not export V-Ray lights, reflection probes or production render cameras.
- Do export the one authored Three.js camera and its animation in the environment GLB.

## 1. Environment

File: `public/models/mandegar/mandegar_environment.glb`

```text
root_environment
├─ env_shell
├─ fxAnchor_reveal_environment
└─ camera_mandegar_master
```

The camera animation clip must be named `camera_master_loop`.

`env_shell` contains only floor, walls and ceiling. Assign the source material
`MAT_ENV_BAKED`; code replaces it with the runtime unlit material.

### Camera pacing handoff

Revise the complete master clip for all eleven hero chapters. Author every
approach, main composition, transition, and the final camera framing for the
page handoff. Keep the existing opening pose to preserve the intro seam. The
camera and content timing will be integrated together across all chapters.

Send a review export of `mandegar_environment.glb` with the same camera and clip
names, together with a filled copy of
[camera-timing-handoff.template.json](camera-timing-handoff.template.json).
The completed handoff is the runtime source of truth, imported by
`components/experience/hero-timeline-config.ts`. Run the preflight checker after
every camera export or frame edit to validate it against the actual GLB.

- `fps`: the source animation frame rate, including its fractional part if used.
- `firstFrame` and `lastFrame`: the source frames corresponding to the exported
  clip's start and end. Cue values use this same absolute source frame numbering.
- `phaseStartFrames`: the start of each chapter's viewing window. Arrival begins
  at `firstFrame`. For interaction chapters, this is where the authored camera
  reaches its usable composition.
- `phaseEndFrames`: the end of each viewing window and the target when an
  interaction finishes. A gap before the next window is authored camera travel;
  windows may not overlap. Null derives the end from the next chapter's start.
  The final loop may be a single checkpoint at `lastFrame` rather than a window.
- `phaseRestFrames`: optional main-view checkpoints within the viewing window.
  For installation buttons (engagement), race (experiences), and drawing
  (connection), null defaults to the window's start. Set another value only if
  the usable composition is reached later; it must precede the window's end.
  Other chapters default to their midpoint. These values do not add automatic
  camera pauses.
- `photoTextReady`: the first frame when the section text and Ready cue should
  start appearing, within the photo viewing window. It can follow camera arrival;
  text and Ready share this same cue. Ready remains until capture.
- `photoCapture`: the capture moment and beginning of photo delivery.
- `photoDelivered`: the moment the photo reaches the phone.
- `photoExit`: the moment the photo and delivery result have disappeared.
- `lightingBeam1` through `lightingBeam5`: the five lamp activation moments.
- `heroHandoffStart` and `heroHandoffEnd`: the interval when the hero UI fades
  and releases into the following page content. Author any camera movement
  needed during that interval in the clip itself.

Viewing windows must follow the narrative order; the four photo cues and five
lamp cues must be ordered within their respective windows.
All frames must be within the exported range. Leave unknown values null while
drafting; they must not be treated as frame zero. Complete chapter starts,
viewing window ends, and the effect cues before integration. The chapter
IDs follow the existing narrative order: arrival, discovery, photo booth (activation),
installation buttons (engagement), lighting (reveal), race (experiences), drawing
(connection), proof, intelligence, invitation, and loop.

Export the camera's animated transforms, including any authored targeting or
constraints needed to reproduce its view. Check framing at both landscape and
portrait aspect ratios. A preview recording helps review the movement but does
not replace the GLB or cue frame numbers.

Code will normalize source cue frames as
`(frame - firstFrame) / (lastFrame - firstFrame)` and verify that the exported
clip duration agrees with `(lastFrame - firstFrame) / fps`. One scroll playhead
will sample the clip directly and drive every chapter and effect. Relative
camera pacing comes from the authored animation; overall scroll distance and
shared input smoothing remain code settings. Increasing the total clip duration
alone does not slow a scroll-driven experience.

For example, source frames 1 through 2500 at 30 FPS span `(2500 - 1) / 30`, or
83.3 seconds between the first and last keys. Source frame zero is valid too.
Camera time uses the actual exported clip duration so its first and last poses
are sampled exactly. The preflight reads binary animation timestamps rather than
trusting duration metadata. It allows up to half a frame of rounding in exported key times and
rejects incorrect FPS, missing camera animation, overlapping chapter boundaries,
misordered effects, and incomplete source timing.

Run `npm run camera:check` to inspect the current draft. It reports pending data
without installing anything. To check a review export, use:

```powershell
npm run camera:check -- --asset "D:\path\to\mandegar_environment.glb"
```

Use `--handoff "D:\path\to\camera-timing.json"` for a separate filled cue file.
Set its status to `ready` when authoring is complete, then add `--require-ready`
to make missing or invalid data fail the check. `--json` provides the frame
report for development tooling. These paths are examples, not asset locations.

The current handoff is ready and integrated for frames 0–2500 at 30 FPS.
The camera clip samples native scroll directly, with its original breathing and
mouse response restored. Phase text stays inside each viewing window, photo
delivery follows its four cues, and lamps fade on over eight source frames after
their activation cues. Touch, game and drawing enter automatically on settled
forward arrival and keep native scroll available. Finish moves native scroll to the current window's end in
850 ms and new wheel, touch or scroll-key input takes over immediately.
The original ending follows the completed camera clip at frame 2500. Its
desktop/mobile timeline durations remain 3.88/3.47 with the original 90svh per
timeline unit, 0.55 scrub, project reading time, and four-unit camera descent
toward the center monitor. That scroll space is additional to the camera track,
so it does not shorten the authored phase windows. The source handoff cues stay
in the JSON; they no longer compress the page transition into the last 50 camera
frames. `components/experience/hero-ending.ts` holds the original ending values.

### Integration steps

1. **Prepare the full camera and cue handoff.** Author all chapters in one clip
   and fill the frame template. The code preparation isolates the existing
   camera mapping without changing runtime behavior.
2. **Integrate camera and timing together for every chapter.** Import the revised
   clip and derive chapter boundaries, text, screens, lamps, photo delivery,
   audience effects, and the page handoff from one playhead. Remove equal-stage
   camera remapping, the narrative velocity warp, automatic scroll locks, and
   the separate virtual camera progression. During the hero sequence, remove
   interaction camera tilt while retaining the original breathing and mouse
   response over the authored clip. Preserve responsive FOV and the separate
   pre-hero assembly intro. Actual game and drawing input retain their own state;
   activities start automatically at a settled forward arrival. The original
   ending descent and look-at run after the camera's final frame.
   While participating, control gestures belong to the activity; ordinary scroll
   still advances the real playhead through the viewing window. Skip progress is
   the current scroll fraction within that window, with no separate accumulated
   threshold or virtual camera. Finish initiates a short, smooth movement of the
   actual page scroll position to the window's end, sampling every intervening
   camera frame. New scroll input immediately takes control. The subsequent
   camera travel remains scroll-controlled. Photo and lighting stay entirely
   scroll-controlled too.
3. **Calibrate with a development timeline preview.** Display the animation frame,
   chapter, and active cues while scrubbing forward or backward. Tune overall
   desktop/mobile scroll distance and shared smoothing while preserving the
   authored relative camera pacing.
4. **Validate the complete hero sequence.** Check uninterrupted forward/reverse
   motion, cue alignment, fast scrolling, explicit interactions, keyboard access,
   Persian/Arabic layouts, mobile framing, reduced motion, and the intro/page
   seams. Each implementation step receives focused checks and its own commit.
   The broader site review follows the remaining visual polish.

## 2. Exhibition

File: `public/models/mandegar/mandegar_exhibition.glb`

```text
root_exhibition
├─ section_central
│  ├─ central_architecture_*
│  ├─ screen_video_wall_21x9
│  ├─ fxAnchor_reveal_central
│  ├─ fxAnchor_hud_central
│  └─ fxAnchor_signal_central
├─ section_left
│  ├─ left_architecture_*
│  ├─ screen_interactive_16x9
│  ├─ fxAnchor_reveal_left
│  ├─ fxAnchor_hud_left
│  └─ fxAnchor_signal_left
└─ section_right
   ├─ right_architecture_*
   ├─ screen_game_16x9
   ├─ screen_main_16x9
   ├─ fxAnchor_reveal_right
   ├─ fxAnchor_hud_right
   └─ fxAnchor_signal_right
```

Assign `MAT_EXHIBIT_BAKED` to all non-screen architecture. Every screen must
remain a separate simple mesh with clean 0–1 UVs and forward-facing normals.
Screen materials in the DCC are placeholders; code replaces them independently.

Reveal anchors are the artistic origins of the center-out transitions. HUD
anchors are where the technical labels point. Signal anchors are the origins and
destinations for the intelligence/data-flow layer.

## 3. Crowd

File: `public/models/mandegar/mandegar_crowd.glb`

```text
root_crowd
├─ Human_00
├─ Human_01
├─ …
├─ Human_28
└─ crowd_slots (optional)
```

The crowd is loaded only shortly before it is needed. The current asset stores
`Human_00` through `Human_28` directly under `root_crowd`; `crowd_slots` remains
optional and reserved for later procedural variation. Every human uses the same
baked shader, quiet/peak texture pair, reveal edge, and turbulence controls as
the exhibition meshes. Crowd UVs must therefore match the exhibition atlas.

## Baked textures

Keep the four lossless 4096x4096 PNG source textures outside the deployed
`public/` tree. The expected source names are `env_quiet.png`, `env_peak.png`,
`exhibit_quiet.png`, and `exhibit_peak.png`.

Run the reproducible conversion pipeline from the repository root:

```powershell
npm run assets:textures -- "D:\Projects\Navid\mandegar3d\Texture\Update"
```

For a single updated source, append its contract name so the other maps are not
re-encoded:

```powershell
npm run assets:textures -- "D:\Projects\Navid\mandegar3d\Texture\Update" --texture env_quiet
```

The script requires Khronos KTX-Software (`toktx` and `ktx`) and generates a
complete mip chain. It normalizes source color to 8-bit sRGB before producing
4K desktop WebP/KTX2 files. Desktop KTX2 uses UASTC quality 3 without RDO to
avoid visible rate-distortion artifacts. Mobile uses UASTC quality 2 with RDO
lambda 0.75 to control transfer size. The atlases remain opaque RGB so they do
not consume an unnecessary alpha channel. Runtime sampling uses 8x desktop and
4x mobile anisotropy, capped by device support.

```text
public/textures/mandegar/baked/env_quiet.webp
public/textures/mandegar/baked/env_quiet.ktx2
public/textures/mandegar/baked/env_peak.webp
public/textures/mandegar/baked/env_peak.ktx2
public/textures/mandegar/baked/exhibit_quiet.webp
public/textures/mandegar/baked/exhibit_quiet.ktx2
public/textures/mandegar/baked/exhibit_peak.webp
public/textures/mandegar/baked/exhibit_peak.ktx2
```

It also generates equivalent 2048x2048 files under
`public/textures/mandegar/baked/mobile/`. Full quality loads the 4K WebP set;
adaptive quality loads the 2K WebP set. KTX2 files remain checked-in fallback
assets so device testing can switch the runtime back without regenerating the
atlases. Do not export the 16-bit source directly to runtime:
all four members of the set must use the same color and bit-depth pipeline.

The quiet/peak pair for each atlas must retain identical dimensions and UV
layout. Keep baked direct light, soft shadow, reflection and broad highlights
in RGB. Avoid view-dependent razor-sharp reflections because the website
camera moves. The runtime uses no Three.js lights, shadows, tone mapping, bloom
or depth of field in baked mode. The runtime does not add a view-dependent
Fresnel. It only gives bright pixels in the approved peak bake a restrained
lift, so specular and reflection detail must remain authored in the V-Ray
texture.

Do not hand-edit generated files. Re-run `npm run assets:textures` when a source
changes, validate the complete set, and commit the generated outputs together.
High-resolution authoring files are not part of the repository or production
build.

## Screen media

Optional videos are configured in `sceneTokens.bakedScene.screens`. Supported
web formats are MP4, WebM and OGV; videos are muted, looped and only play while
their authored stage activation is above zero. When no video is supplied, code
uses project poster media or a lightweight generated fallback.

## Activation and verification

1. Copy all three GLBs and generate both desktop and mobile texture sets.
2. Restart `npm run dev`.
3. Open `/fa?intro=1&creative=1`.
4. Check the browser console. Missing contract nodes are reported by exact name.
5. Review all nine resting stages and the final Loop-to-page handoff.

The creative panel now exposes section reveal, quiet/peak mix, all four screens,
crowd, data flow, transition particle strength/size/motion, reveal edge width,
and turbulence.
