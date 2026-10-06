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
