# Mandegar Motion Animatic v1

Output: `Docs/CreativeProduction/animatic/Mandegar_K1-K7_Animatic_v1.mp4`

Rebuild with:

```powershell
npm run creative:animatic
```

The animatic is a low-cost motion gate, not a finished film. It tests the camera rhythm, activation spacing, reveal contrast, invitation hold, and return-to-arrival logic before those timings are made expensive in 3D.

## Timing sequence

| Beat | Source | Hold | Camera / action |
| --- | --- | ---: | --- |
| Arrival | K7c loop return | 2.8 s | Centered, quiet, almost imperceptible push |
| Discovery | K2 | 2.5 s | Slow approach; first trail and screen |
| LED wake | K3a | 1.5 s | Second screen answers the first |
| Media wake | K3b | 1.6 s | Rear veil wakes left-to-right |
| Booth wake | K3c | 1.6 s | Signals branch to attached modules |
| Brand + audience | K3d | 1.8 s | Camera settles near frontal; people gather |
| Reveal ignition | K4a | 1.3 s | Signal climbs core and enters halo |
| Peak reveal | K4b | 2.1 s | One deliberate push/lift; controlled color burst |
| Reveal settle | K4c | 2.5 s | Exposure returns to the bright premium base |
| Invitation | K7a | 3.2 s | Calm pullback; DOM copy and CTA receive the frame |
| Condensation | K7b | 2.0 s | Screens sleep; signals return to the halo |
| Loop return | K7c | 2.8 s | Camera and light align exactly with Arrival |

Crossfades are 0.55 seconds. They stand in for continuous 3D interpolation and must not become literal dissolves in the browser implementation.

## Motion rules carried into production

- Arrival, Discovery, and Invitation use long breathing intervals.
- Individual activations are short, distinct beats rather than equal scroll scrubs.
- K4a to K4b is the only high-acceleration camera move.
- K4b is intentionally brief; K4c is the usable active world for project proof.
- The final CTA receives the longest readable pause.
- The loop preserves architecture and exposure; only signals, media, audience, and camera alignment reset.
- Pointer input may add local parallax but never changes the authored camera path.
- Reduced-motion mode uses K1, K2, K4c, K7a, and K7c as discrete accessible states.

## Browser motion lock — visual review pass

The live homepage currently uses the animatic as a direction, not as literal timing. These decisions are locked for the next visual review:

- The completed Loop is the final 3D state. Continuing downward releases the sticky scene into the project, About and testimonial sections, followed by the global footer.
- The GSAP playhead follows native scroll continuously. It does not magnetically snap or wrap at either boundary.
- The current review runway is deliberately slow: `1450svh` on desktop and `1300svh` on mobile, with a `0.9` second scrub response. Shortening it requires a new visual sign-off.
- Each phase has one copy statement. Copy enters and exits line-by-line through depth, clipping, and blur; it never persists as an editorial panel.
- Copy has no card, border, radius, or box shadow. Only a soft unbounded radial blur may separate it from the scene.
- Non-centred copy is physically anchored on the left in Persian, Arabic, and English. Invitation and Loop remain centred. Primary navigation stays top-centre.
- Project proof is mapped to the GLB LED meshes. Photo, game, and touch responses belong to the named GLB modules; the data diagram belongs to the 3D signal field. Do not restore the former HTML cards or controls beneath the copy.
- Architectural geometry must come from the approved GLB. Runtime-generated geometry is limited to authored effects: light paths, audience traces, particles, and data connections.
- The signal field stays visible and alive in quiet states, bends around the pointer, emits a press/touch ripple, reorganizes into the Intelligence network, and condenses into its final Loop composition before the page handoff.
- The code camera is a review placeholder: distant approach, selective lateral changes, one top view, restrained roll, and an end pose that matches Arrival. It is replaceable by an approved authored camera animation.

Automated timing and browser checks remain paused until the current visual review is approved.
