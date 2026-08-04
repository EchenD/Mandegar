# Visual tuning quick map

Use the **search term** column in the named file. These are the shortest paths to every major visual control.

## Core files

| Area | File |
| --- | --- |
| Global site palette, typography, common component sizing | `styles/globals.css` |
| Homepage DOM text, loader, controls, blur and responsive sizes | `components/experience/MandegarExperience.module.css` |
| 3D palette, phase timing, camera path and quality limits | `components/experience/scene-config.ts` |
| Renderer, bloom, depth of field, background, fog, lights and materials | `components/experience/ExperienceCanvas.tsx` |
| Scroll feel and copy reveal motion | `components/experience/ScrollMotion.tsx` |

## Fast lookup

| Change | File and search term | What to edit |
| --- | --- | --- |
| Global colors | `globals.css` → `:root` | `--bg`, `--paper`, `--ink`, `--muted`, `--accent`, lines and radii |
| Homepage UI colors | `MandegarExperience.module.css` | Search `#` or `rgba(`; `#225cff` is the main UI blue, `#16191d` the main ink |
| 3D color palette | `scene-config.ts` → `sceneTokens.colors` | Fog, silver, charcoal, cobalt, cyan, magenta and amber |
| Particles | `scene-config.ts` → `sceneTokens.particles` | Count, idle color, four-color palette, HDR luminance, opacity and core/glow size |
| Particle motion and formations | `ExperienceCanvas.tsx` → `makeSignalField` / `SignalField` | Spatial distribution, pointer response, breathing and transitions into network/ring formations |
| Canvas background | `ExperienceCanvas.tsx` → `quietBackground` / `activeBackground` | Start and energized background colors; `lerp(..., reveal * 0.72)` controls the blend amount |
| Fog | `ExperienceCanvas.tsx` → `<fog` | First value is color, then near and far distance (`13`, `40`) |
| ACES exposure | `ExperienceCanvas.tsx` → `toneMappingExposure` | Higher is brighter; current value is `1.04` |
| Bloom | `ExperienceCanvas.tsx` → `new UnrealBloomPass` | Arguments after resolution: strength, radius, threshold. Lower threshold blooms more pixels |
| Animated bloom | `ExperienceCanvas.tsx` → `bloomPass.strength` | Base full/adaptive strength plus reveal and assembly boosts; tune this as well as the constructor |
| Depth of field | `ExperienceCanvas.tsx` → `new BokehPass` | `aperture` controls strength; `maxblur` caps blur; focus distance follows the camera target automatically |
| Lights | `ExperienceCanvas.tsx` → `<ambientLight`, `<hemisphereLight`, `<directionalLight`, `<pointLight` | Color, intensity, position and distance. Animated maximums are immediately above these elements |
| Material finish | `ExperienceCanvas.tsx` → `envMapIntensity`, `roughness`, `metalness` | Lower roughness is glossier; higher metalness is more metallic |
| Wireframe/reveal | `ExperienceCanvas.tsx` → `revealBindings` / `beaconVisibility` | Per-object bottom-to-top reveal, lift distance, wire opacity and reveal-light visibility |
| Authored 3D camera | `scene-config.ts` → `sceneTokens.authoredCamera` | Enable/disable the GLB camera, mobile use, node/clip names and depth-of-field focus target |
| Fallback 3D camera | `scene-config.ts` → `cameraKeyframes` | Used on mobile or when the authored camera/clip is missing; controls progress, position, target, roll and FOV |
| Pointer movement | `scene-config.ts` → `pointerParallax` | Desktop camera response; mobile is intentionally zero |
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
