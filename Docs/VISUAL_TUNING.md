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
| Fallback 3D camera | `scene-config.ts` → `cameraKeyframes` | Used on mobile or when the authored camera/clip is missing; controls progress, position, target, roll and FOV |
| Camera breathing | `scene-config.ts` → `cameraMotion.breathing` | Local position/rotation amplitudes, three low frequencies and mobile scale |
| Pointer camera response | `scene-config.ts` → `cameraMotion.pointer` | Local position/rotation range plus frame-rate-independent spring stiffness and damping |
| Spatial labels | `scene-config.ts` → `spatialLabels` | Per-story moment ranges, GLB node names, appearance colors and desktop/compact safe areas |
| Spatial label styling | `SpatialLabels.module.css` → `.label`, `.leader`, `.dimension` | Label widths/type, leader lines, measurement line and compact-mode density |
| Total scroll speed | `MandegarExperience.module.css` → `.root` | Smaller than `1450svh`/`1300svh` makes the story advance faster; larger makes it slower |
| Smooth-scroll response | `ScrollMotion.tsx` → `new Lenis` | Larger `lerp` reacts faster; smaller feels heavier. Current value is `0.05` |
| Phase timing | `scene-config.ts` → `scenePhases` | Start/end/preview point for each narrative phase |
| Object activation timing | `scene-config.ts` → `activationSequence` | Wire assembly, trails, screens, booths, reveal and loop reset ranges |
| Copy transition | `ScrollMotion.tsx` → `renderCopyState` | Entry/exit timing, vertical travel, depth, blur and bottom-to-top clip mask |
| Font family | `globals.css` → `body` and `app/[locale]/layout.tsx` | CSS family and Fontsource import; currently `Vazirmatn Variable` |
| Global type scale | `globals.css` → `h1`, `h2`, `h3`, `p` | Site-wide font sizes and weights |
| Homepage title/body type | `MandegarExperience.module.css` → `.sceneCopy h2` / `.sceneCopy p` | Desktop size, weight, line height and text color |
| Homepage eyebrow/controls | `MandegarExperience.module.css` → `.sceneCopy > span`, `.phaseButtons`, `.soundControl` | Small-label sizes and colors |
| Text background blur | `MandegarExperience.module.css` → `.sceneCopy::before` | `backdrop-filter`, saturation and radial mask; background stays transparent |
| Loader | `MandegarExperience.module.css` → `.loaderMark` | Size, white spark, orbit particles, glow and progress ring |
| Responsive overrides | Both CSS files → `@media` | Mobile sizes/positions are near the bottom of each file |

## Find every remaining literal color or size

```powershell
rg -n '#[0-9a-fA-F]{3,8}|rgba?\(|font-size:|clamp\(' styles components/experience
```

After tuning, run `npm run typecheck`, `npm run lint`, and `npm run build`.
