# Mandegar Web 3D Asset Contract

All architectural homepage geometry is authored in 3ds Max and delivered as GLB modules matching the slots in `components/experience/scene-config.ts`. Runtime-generated geometry is reserved for light paths, audience traces, particles, ripples, and data connections; it must not replace the hall, stage, halo, booth, screen, or other architectural surfaces.

## Scene and hierarchy

- Work in metres, Z-up in 3ds Max, with the exported glTF converted to Y-up by the exporter.
- Reset transforms before export. Keep scale at `1,1,1` and avoid negative scale.
- Put each module's logical origin on the finished-floor centreline. Use a floor-level pivot for booths, stage, screens, and signage; use the suspension centre for the halo.
- Required prefixes: `hall_`, `hero_`, `ring_`, `stage_`, `led_`, `booth_`, `photo_`, `game_`, `touch_`, `signage_`, `audience_`, and `fxAnchor_`.
- Keep independently activated objects as separate named nodes. Static internal pieces may be merged when that reduces draw calls without harming replacement or LOD.
- Name media meshes `media_MAIN_16x9`, `media_CURVE_L`, `media_CURVE_R`, `media_PHOTO`, and `media_GAME`; orient their normals toward the audience and preserve clean, non-overlapping UV0.

## Materials and textures

- Use a small shared metallic/roughness PBR set: matte warm white, soft silver, dark screen surround, translucent accent, and emissive media/light materials.
- Do not bake video or changing brand media into base-color textures.
- Bake static lighting/AO where it materially improves the result. Runtime light anchors are empties named `fxAnchor_light_*`.
- Mobile texture target: 1024 px per map; desktop maximum: 2048 px unless a reviewed hero surface proves that 4096 px is necessary.
- Deliver KTX2/Basis textures where supported. Use WebP/AVIF posters for media, linear color for data maps, and sRGB for base color/emissive.
- Avoid unique 4K maps, unused channels, hidden geometry, and per-object material duplicates.

## Geometry, animation, and export

- Keep curves visually smooth at the closest approved camera while supplying lower-detail modules for mobile.
- Preserve physically plausible thickness; do not model single-plane architectural shells visible from both sides.
- Asset-owned animation clips use `idle_*`, `activate_*`, or `loop_*`. The code camera remains the fallback until an approved authored master camera is delivered.
- An optional authored camera handoff uses a camera named `camera_mandegar_master` and one clip named `camera_master_loop`. Its first and final transforms must match exactly, and its timing must follow the nine scene checkpoints in `components/experience/scene-config.ts`.
- Export GLB with embedded buffers, normals, tangents only when needed, UV0, vertex colors only when used, and no unapproved lights. Export the named master camera only when it is part of the reviewed camera handoff.
- Starting budgets: hall 2.0 MB, hero zone 2.5 MB, each booth 500 KB, halo 350 KB, and audience module 600 KB after compression.
- Run glTF Transform prune, deduplicate, inspect, and tested Meshopt/Draco compression. Record triangles, draw calls, texture memory, and final size for every module.

## Delivery check

Each delivery includes the `.max` source, optimized `.glb`, texture source folder, a reference render, recorded budgets, expected node names, and a note listing any animation clips or authored camera. Validate pivots, color space, normals, media UVs, mobile LOD, loop-matched camera endpoints, and visual parity before replacing a slot.
