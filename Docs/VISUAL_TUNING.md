# Visual tuning quick map

Use the **search term** column in the named file. These are the shortest paths to every major visual control.

## Core files

| Area | File |
| --- | --- |
| Global site palette, typography, common component sizing | `styles/globals.css` |
| Homepage DOM text, loader, controls, blur and responsive sizes | `components/experience/MandegarExperience.module.css` |
| Model-anchored HUD label typography, lines and compact layout | `components/experience/SpatialLabels.module.css` |
| 3D palette, environment, particles, phase timing, camera path and quality limits | `components/experience/scene-config.ts` |
| Renderer, shaders, model materials and animated light behavior | `components/experience/ExperienceCanvas.tsx` |
| Scroll feel and copy reveal motion | `components/experience/ScrollMotion.tsx` |
| Authored source frames for eleven viewing windows and effect cues | `Docs/CreativeProduction/camera-timing-handoff.template.json` |
| Frame handoff validation and normalized runtime timing | `components/experience/hero-timeline.ts` and `hero-timeline-config.ts` |
| Text windows and per-stage copy animation | `components/experience/narrative-copy-timing.ts` |
| Per-stage camera, particles, lighting, labels and effects | `components/experience/stage-presets.ts` |
| Development creative controls | `components/experience/CreativePanel.tsx` and `CreativePanel.module.css` |
| Intro duration and camera/reveal handoff | `components/experience/ExperienceIntro.tsx` and `components/experience/intro-score.ts` |
| Shared header position and responsive navigation | `components/layout/Header.module.css` |

## Fast lookup

| Change | File and search term | What to edit |
| --- | --- | --- |
| Global colors | `globals.css` → `:root` | `--bg`, `--paper`, `--ink`, `--muted`, `--accent`, lines and radii |
| Homepage UI colors | `MandegarExperience.module.css` | Search `#` or `rgba(`; `#225cff` is the main UI blue, `#16191d` the main ink |
| 3D color palette | `scene-config.ts` → `sceneTokens.colors` | Fog, silver, charcoal, cobalt, cyan, magenta and amber |
| Story color escalation | `scene-config.ts` → `sceneTokens.visualStory` | Living-world and peak-reveal timing, particle population, audience presence and trail palette |
| Particles | `scene-config.ts` → `sceneTokens.particles` | Count, color palette, HDR luminance, separate core/glow opacity and size |
| Particle layers | `scene-config.ts` → `particles.layers` / `particles.surfaceNodes` | Atmosphere/surface/signal allocation plus object name, activation point, color and sampling weight |
| Particle motion and formations | `scene-config.ts` → `particles.motion` / `particles.modelNodes` | Drift, signal speed, surface offset, pointer response and model-anchored routes |
| Canvas background | `scene-config.ts` → `environment.background` | Quiet and energized light-gray background colors |
| Fog | `scene-config.ts` → `colors.fog` / `environment.fog` | Fog color and near/far distances |
| ACES exposure | `scene-config.ts` → `environment.exposure` | Higher is brighter; current value is `0.92` |
| Bloom | `scene-config.ts` → `environment.postprocessing` | Full-profile enable, strength, reveal/assembly boosts, radius and threshold; adaptive bloom is disabled |
| Depth of field | `scene-config.ts` → `environment.postprocessing` | Full-profile aperture/max blur; adaptive depth of field is disabled |
| Base lights | `scene-config.ts` → `environment.lights` | Ambient, hemisphere, key and fill intensity |
| Animated lights | `ExperienceCanvas.tsx` → `revealLight` / `interactionLight` | Point-light color, intensity, position and distance |
| Audience | `scene-config.ts` → `visualStory.audience` / `qualityProfiles.audiencePoints` | Gather timing, count, opacity, motion and muted silhouette palette |
| Material finish | `ExperienceCanvas.tsx` → `envMapIntensity`, `roughness`, `metalness` | Lower roughness is glossier; higher metalness is more metallic |
| Wireframe/reveal | `ExperienceCanvas.tsx` → `revealBindings` / `beaconVisibility` | Per-object bottom-to-top reveal, lift distance, wire opacity and reveal-light visibility |
| Authored 3D camera | `scene-config.ts` → `sceneTokens.authoredCamera` | Enable/disable the GLB camera, mobile use, node/clip names and depth-of-field focus target |
| Fallback 3D camera | `scene-config.ts` → `cameraKeyframes` | Used when the authored camera is disabled or unavailable; controls progress, position, target, roll and FOV |
| Camera sampling | `CameraRig.tsx` and `camera-timeline.ts` | The GLB position and rotation follow native scroll directly; only responsive FOV and the separate assembly intro are added |
| Spatial labels | `scene-config.ts` → `spatialLabels` | Per-story moment ranges, GLB node names, appearance colors and desktop/compact safe areas |
| Spatial label styling | `SpatialLabels.module.css` → `.label`, `.leader`, `.dimension` | Label widths/type, leader lines, measurement line and compact-mode density |
| Total scroll speed | `scene-config.ts` → `scrollLengthVh` | Current desktop/mobile values are `3325`/`2981.25`, 25% longer than before; smaller advances faster, larger advances slower |
| Transition into projects | `camera-timing-handoff.template.json` → `heroHandoffStart` / `heroHandoffEnd` | The next section's layout and entrance follow these source frames, including after viewport resizing |
| Smooth-scroll response | `ScrollMotion.tsx` → `new Lenis` | Larger `lerp` reacts faster; smaller feels heavier. Current value is `0.05` |
| Eleven review points | `camera-timing-handoff.template.json` → `phaseRestFrames` | Null uses the viewing-window start for participation chapters, otherwise the midpoint |
| Phase boundaries | `camera-timing-handoff.template.json` → `phaseStartFrames` / `phaseEndFrames` | Source viewing windows; gaps remain authored camera travel |
| Object activation timing | `narrative-score.ts` → `narrativeCueRanges` | Assembly, trails, screens, booths, reveal and loop-reset ranges |
| Stage-to-stage speed | `mandegar_environment.glb` → `camera_master_loop` | Author relative pacing in the camera animation; change `scrollLengthVh` for overall speed |
| Text windows | `narrative-copy-timing.ts` → `getNarrativeCopyTiming` | Text stays inside each viewing window; photo text starts at `photoTextReady` |
| Individual text timing | `narrative-copy-timing.ts` → `narrativeCopyStageTuning` | Per-stage entry/exit duration and line stagger inside the authored viewing windows |
| Copy transition | `ScrollMotion.tsx` → `renderCopyState` | Entry/exit timing, vertical travel, depth, blur and bottom-to-top clip mask |
| Font family | `globals.css` → `body` and `app/[locale]/layout.tsx` | CSS family and Fontsource import; currently `Vazirmatn Variable` |
| Global type scale | `globals.css` → `h1`, `h2`, `h3`, `p` | Site-wide font sizes and weights |
| Homepage title/body type | `MandegarExperience.module.css` → `.sceneCopy h2` / `.sceneCopy p` | Desktop size, weight, line height and text color |
| Homepage eyebrow/controls | `MandegarExperience.module.css` → `.sceneCopy > span`, `.phaseButtons`, `.soundControl` | Small-label sizes and colors |
| Text background blur | `MandegarExperience.module.css` → `.sceneCopy::before` | `backdrop-filter`, saturation, inset and radial mask; no colored panel, isolated directly behind the copy |
| Loader appearance | `MandegarExperience.module.css` → `.loader`, `.loaderMark` | Full-screen background, fade duration, centered spark, orbit particles, glow and progress ring |
| Loader/header stacking | `MandegarExperience.module.css` → `.root:has(.loader` | Keeps the loader above the global header until its fade has fully completed |
| Header geometry | `Header.module.css` → `.header` and desktop media query | One fixed width, top padding and exactly centered navigation shared by every localized page |
| Scroll cue and timeline | `MandegarExperience.module.css` → `.scrollCue`, `.phaseRail`, `.phaseTrack` | Initial animated hint, handoff animation, rail width and physical-scroll fill styling |
| Responsive overrides | Both CSS files → `@media` | Mobile sizes/positions are near the bottom of each file |

## Browser creative panel

Run the development server and open a stage with the creative flag:

```text
http://localhost:3100/fa?intro=0&phase=discovery&creative=1
```

The panel is deliberately excluded from production builds. It can:

- jump to any of the eleven review stages;
- tune particle presence, response, routed signal and halo strength;
- tune lighting energy, contrast and spatial-HUD prominence;
- preserve experiments in browser local storage;
- copy the current override set as JSON; and
- reset one stage or the entire experiment without changing authored defaults.

Use **Copy JSON** when a review is approved, then transfer those values into the matching entry in `stage-presets.ts`. Browser values are exploratory overrides, not production source of truth. Use **Reset all** after promoting values to confirm that the authored file reproduces the approved result.

The panel intentionally does not expose controls that are not yet production-wired. Reveal-boundary turbulence, edge width, convergence and palette controls should be added with the boundary particle-network step.

## Controls that should stay synchronized

- Change source frames in the handoff JSON and run `npm run camera:check -- --require-ready`. Camera, copy, effects and review markers use this one frame clock.
- Author relative camera pacing in the GLB. Tune overall playback speed with `scrollLengthVh`; native scroll is not warped.
- Tune message entrance and exit with `narrativeCopyStageTuning`; camera travel gaps stay clear.
- Keep the intro end frame equal to `experienceHomeFrame` in `intro-score.ts`; this preserves the seamless handoff into the loop.
- Both `--scroll-progress` and `--scene-progress` now follow the same physical page position.

## Recommended final-tuning order

1. Set the eleven source viewing windows and confirm the narrative order.
2. Tune `scrollLengthVh`; author relative timing in the GLB.
3. Tune per-stage text entry and exit inside the viewing windows.
4. Author the eleven camera shots and stage presets.
5. Tune particles, lighting, labels and post-processing per stage.
6. Finish typography, text blur, loader, scroll cue and responsive positions.

Use query parameters while reviewing the opening: `?intro=1` forces the intro, `?intro=0` skips it, and `?phase=activation` opens at an authored stage.

## Find every remaining literal color or size

```powershell
rg -n '#[0-9a-fA-F]{3,8}|rgba?\(|font-size:|clamp\(' styles components/experience
```

After tuning, run `npm run typecheck`, `npm run lint`, and `npm run build`.
