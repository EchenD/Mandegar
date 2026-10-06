# Touch phase polish

The visual source is the existing main hero: its broad concave LED wall,
terracotta steps, black fascia, central podium and five compact spotlights.
The discarded arch/pavilion concept is not used.

Implementation steps:

1. Save four matching monitor views and the circular-button modeling reference.
2. Preserve authored monitor materials; introduce dynamic surfaces only at their
   phase, fade them in and retain the last painted content after departure.
3. Model bronze/graphite circular controls in a separate Blender asset, with
   5 mm cap travel. Fit their bases to the existing sloped Touch counter.
4. Replace the unrelated monitor illustration with the four hero-stage views,
   blend view changes, and ease the physical controls in and out.
5. Remove the Touch HTML control bar, Finish, Skip and visible explanatory copy.
   Keep localized accessible names and keyboard control of the physical buttons.
6. Validate only these changes: rendered surface ownership, section gating,
   physical placement, press/release, keyboard, native scroll and mobile RTL.

Camera animation, camera breathing/pointer motion, phase frame boundaries,
photo booth, lighting cues, game rules and the ending transition are outside
this change. The monitor material policy also applies to the game and writing
monitors, as explicitly requested.

Generated image prompts and their provenance are in `references/prompts.json`.
These are views of Mandegar's own fictional hero installation, not client work.

The editable model is `touch-button.blend`; its build source is
`scripts/build-touch-button.py`. The GLB contains four named meshes and the
`touch_button_press` clip. The master is 160 mm across, 23 mm high, with 5 mm
cap travel. The web version widens its footprint to 220 mm while preserving
height and travel, and fits the bases 1.5 mm above the measured table plane.
Vertex colors supply the finish without adding lights to the hero.

The monitor canvas is 1031 × 540. Production WebP views preserve that aspect.
View changes blend over 750 ms, including rapid changes from the current
painted frame. The physical controls enter with a slight stagger and retreat
over the existing 400 ms departure. Their transparent semantic targets follow
the projected circles; the visible focus treatment is on the 3D ring.
Scrolling continues the camera through the authored phase. Escape still exits
and restores keyboard focus. There is no Touch Finish or Skip control.

Preview captures: `assembled.png`, `parts.png`, `details.png`, `image.png`,
`before-touch.png`, `touch-fa-mobile.png`, and `touch-ar-mobile.png`.
