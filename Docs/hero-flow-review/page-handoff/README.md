# Hero page handoff review

The fixed next-section overlap previously started the transition around frame
2229 on desktop, covering intelligence and invitation. Its layout and entrance
now use the unchanged `heroHandoffStart` / `heroHandoffEnd` cues at 2450–2500.
The entrance follows physical scroll directly and reverses over the same range.
Viewport changes recalculate the overlap and journey track from the hero's
measured scroll distance.

- Invitation at frame 2400: [desktop](desktop-invitation.png), [mobile](mobile-invitation.png).
- Transition midpoint at frame 2475: [desktop](desktop-handoff.png), [mobile](mobile-handoff.png).

Focused desktop/mobile tests passed for intelligence and invitation visibility,
invitation CTA pointer access and keyboard focus, the handoff's start/midpoint/
end, reverse scrolling, resizing, RTL, and horizontal overflow. The existing
reduced-motion work shortcut also passed. TypeScript and lint for the changed
source and test passed.

The camera GLB and frame handoff values are unchanged by this fix. The full site
validation remains for the final review round.
