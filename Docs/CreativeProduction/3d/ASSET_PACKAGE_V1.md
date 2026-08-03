# Mandegar Modular Asset Package v1

This is the first buildable proxy package derived from the locked K1 architecture and the A2-A4 modeling views. It is intentionally replaceable: final sculpting, UV work, baked light, and production optimization remain an art-production pass, while names, pivots, scale, media slots, and runtime anchors are now concrete.

## Editable source

- `Docs/CreativeProduction/3d/max/Mandegar_Hero_v1.max`
- Generator: `scripts/3dsmax/build-mandegar-hero-v1.ms`
- Authoring application: Autodesk 3ds Max 2022
- Units: meters
- World origin: center of the central core at floor level
- Up axis: Z in Max; exporter converts for glTF runtime

## Web modules

The generator writes these files under `public/models/mandegar-v1/`:

- `mandegar_hall_shell_v1.glb`
- `mandegar_hero_core_v1.glb`
- `mandegar_halo_v1.glb`
- `mandegar_experience_pods_v1.glb`
- `mandegar_hero_assembled_v1.glb`

The assembled file supports the first fidelity pass. Separate modules remain the production loading/replacement boundary.

## Naming contract

- `hall_`: floor and spatial boundary
- `hero_`: core shell, ribs, canopy, veil
- `ring_`: signature halo and signal surface
- `stage_`: stage mass and activation edge
- `led_`: known-aspect-ratio media meshes
- `booth_`: attached pod shells and portals
- `wing_`: layered architectural links between pods and central pavilion
- `touch_`: interaction surfaces
- `fxAnchor_`: camera, light, signal, and interaction anchors

Media mesh names contain their intended aspect ratio. Runtime media replaces material content; it must not replace or resize the mesh.

The verified assembled export contains 92 named nodes and 88 meshes. It includes symmetrical pod, stage, veil, and media pivots plus independently addressable left/right wing canopies and signal strips.

## Material contract

- `mat_warm_white`: main matte architectural shell
- `mat_soft_fog`: secondary pale surface
- `mat_charcoal`: inactive media / identity contrast
- `mat_cobalt_signal`: persistent Mandegar activation signal
- `mat_cyan_media`: supporting screen and light response
- `mat_translucent_veil`: limited translucent accent

Materials are deliberately few and reusable. Production assets should preserve these semantic roles even if final shader implementation changes.

## Replacement rules

1. Preserve each module's world-space origin and scale.
2. Preserve node prefixes and media/anchor names.
3. Keep halo, core, stage, veil, and pods independently exportable.
4. Reset transforms before export and keep logical pivots at module attachment points.
5. Do not bake camera choreography into GLB animation clips.
6. Keep static lighting baked or texture-based where practical; runtime lights are authored in code.
7. Record triangle count, draw calls, texture memory, and compressed size for every replacement.

## Current proxy limitations

- The curved stage is a parametric massing proxy, not the final sculpted form.
- Ribbing is modeled for silhouette testing and may be consolidated or baked for mobile.
- Pod interiors and real media are placeholders.
- No final UV/lightmap or texture-compression pass is included yet.
- Audience and signal paths remain runtime systems rather than GLB geometry.
