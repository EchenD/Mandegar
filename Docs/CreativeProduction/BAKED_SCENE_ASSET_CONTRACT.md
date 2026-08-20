# Mandegar baked scene asset contract

The production renderer is implemented behind:

```env
NEXT_PUBLIC_MANDEGAR_BAKED_SCENE=1
```

Leave it at `0` until every required file below exists. The legacy
`mandegar_hero.glb` remains the fallback and is not replaced by this workflow.

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
├─ crowd_table
├─ crowd_photo
├─ crowd_game
├─ crowd_general
└─ crowd_slots
   └─ crowdSlot_*
```

The crowd is loaded only shortly before it is needed. `crowd_slots` is
optional and is reserved for later procedural variation; do not make a fourth
positions GLB. Crowd meshes must use the same baked UV atlas layout as the
exhibition texture pair. Until the named production groups are present, the
runtime deliberately uses a neutral unlit fallback material instead of sampling
the exhibition atlas with incompatible placeholder UVs.

## Four baked textures

Deliver the lossless authoring masters to:

```text
public/textures/mandegar/lossless/env_quiet.png
public/textures/mandegar/lossless/env_peak.png
public/textures/mandegar/lossless/exhibit_quiet.png
public/textures/mandegar/lossless/exhibit_peak.png
```

For browser review, export matching lightweight runtime copies to:

```text
public/textures/mandegar/baked/env_quiet.jpg
public/textures/mandegar/baked/env_peak.jpg
public/textures/mandegar/baked/exhibit_quiet.jpg
public/textures/mandegar/baked/exhibit_peak.jpg
```

The quiet/peak pair for each atlas must retain identical dimensions and UV
layout across its lossless and runtime copies. Keep baked direct light, soft
shadow, reflection and broad highlights in RGB. Avoid view-dependent
razor-sharp reflections because the website camera moves. The runtime uses no
Three.js lights, shadows, tone mapping, bloom or depth of field in baked mode.
The runtime does not add a view-dependent Fresnel. It only gives bright pixels
in the approved peak bake a restrained lift, so specular and reflection detail
must remain authored in the V-Ray texture.

After visual approval, replace the JPG runtime copies with GPU-compressed KTX2
and update only the runtime paths in `bakedSceneContract.textures`. The four
logical texture slots and their lossless masters remain unchanged.

## Screen media

Optional videos are configured in `sceneTokens.bakedScene.screens`. Supported
web formats are MP4, WebM and OGV; videos are muted, looped and only play while
their authored stage activation is above zero. When no video is supplied, code
uses project poster media or a lightweight generated fallback.

## Activation and verification

1. Copy all three GLBs, four lossless masters and four matching runtime review
   textures to the paths above.
2. Set `NEXT_PUBLIC_MANDEGAR_BAKED_SCENE=1` in `.env.local`.
3. Restart `npm run dev`.
4. Open `/fa?intro=1&creative=1`.
5. Check the browser console. Missing contract nodes are reported by exact name.
6. Review all nine resting stages and the loop seam.

The creative panel now exposes section reveal, quiet/peak mix, all four screens,
crowd, data flow, transition particle strength/size/motion, reveal edge width,
and turbulence.
