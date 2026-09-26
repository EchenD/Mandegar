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
