# Mandegar Browser Production Report

## Delivered world

The homepage is one persistent, localized exhibition world derived from the locked K1 reference. It uses the exported Mandegar GLB as the architectural source of truth and keeps the pale luxury base, suspended signature halo, ribbed central pavilion, attached experience pods, curved stage mass, translucent veil, and cobalt activation language intact across desktop and portrait layouts.

The final browser journey contains nine beats:

1. Arrival — quiet pale hall and complete halo silhouette.
2. Discovery — light paths begin to identify the Mandegar zone.
3. Activation — LED screens, media wall, booths, branding, and audience wake in order.
4. Reveal — the assembled environment reaches its brightest state.
5. Experiences — keyboard, pointer, and touch-addressable photo, game, and touch zones alter the corresponding 3D surfaces.
6. Project proof — three CMS-addressable project slots remain in the same world.
7. Event intelligence — a restrained line-and-node layer suggests future intelligence without a dashboard or unverified claims.
8. Invitation — localized project CTA, with Persian as the primary route.
9. Loop — lights, media, particles, and camera return to the quiet Arrival state.

## Asset evidence

- Editable Max source: `Docs/CreativeProduction/3d/max/Mandegar_Hero_v1.max`
- Repeatable generator: `scripts/3dsmax/build-mandegar-hero-v1.ms`
- Browser assembly: `public/models/mandegar-v1/mandegar_hero_assembled_v1.glb`
- Modular replacements: hall, hero core, halo, and experience-pod GLBs in the same directory
- Verified assembled structure: glTF 2.0, 92 named nodes, 88 meshes, six shared materials
- Semantic runtime hooks: `hall_`, `hero_`, `ring_`, `stage_`, `led_`, `booth_`, `touch_`, `wing_`, and `fxAnchor_`

The corrected export centers the stage, veil, media wall, pods, and interaction surfaces. Left and right architectural wings are individually named and preserve the replaceable module boundary.

## CMS and content behavior

The proof beat reads the three featured projects selected in the homepage CMS. If no CMS dataset is connected, it uses the existing repository project inventory. Those fallback records remain explicitly marked `DEMO`; the implementation does not invent clients, awards, metrics, or outcomes.

Homepage copy continues to honor CMS overrides for space, interaction, proof, intelligence, and conversion content. Persian, English, and Arabic retain their route direction and localized CTA paths.

## Runtime tiers and fallbacks

- Full: higher DPR, antialiasing, shadows, 480-point atmospheric field, and 26 audience figures.
- Adaptive: reduced DPR, no shadow map, 180-point atmospheric field, and 12 audience figures.
- Fallback: used for reduced motion, save-data, disabled immersive CMS flag, or unavailable WebGL; it retains the complete semantic story and CTA as normal document content.
- The renderer pauses while the page is hidden and owns one persistent canvas for the entire journey.

## Production profile

Measured against `next start` on a local production build in Chromium with an empty browser context:

| Viewport | First WebGL frame | FCP | Model transfer | Total resource transfer | JS transfer |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1440 × 900 | 1,690 ms | 200 ms | 244 KB | 1,034 KB | 449 KB |
| 390 × 844 | 1,100 ms | 120 ms | 244 KB | 1,003 KB | 442 KB |

The source assembled GLB is 913,084 bytes and is served compressed to roughly 244 KB in the production measurement.

## Review evidence

Final rendered checkpoints are preserved in `Docs/CreativeProduction/browser-review/`. They cover Arrival, Reveal, Experiences, Project Proof, Event Intelligence, Invitation, portrait Activation, portrait Proof, portrait Intelligence, and portrait Loop.

The continuity source pack, portrait references, and motion animatic remain in the sibling `keyframes/` and `animatic/` directories.

## Validation gates

- TypeScript: `npm run typecheck`
- ESLint: `npm run lint`
- Production compilation and 50 generated routes: `npm run build`
- Playwright: localized routes, desktop/tablet/mobile/ultrawide layouts, RTL/LTR, automated WCAG A/AA scan, keyboard controls, reduced-motion fallback, named scene checkpoints, single-copy-beat visibility, CMS project links, footer release, and visual review captures

Approved client project media and final verified outcomes remain a launch-content gate, not a code fallback: the site labels demos until that material is supplied through Sanity.
