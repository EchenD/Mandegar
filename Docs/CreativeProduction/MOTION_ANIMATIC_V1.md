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
