# Interaction restoration

The authored camera now retains breathing and mouse response throughout
participation. The game-only vignette override is removed, so opening the game
uses the section's normal appearance. The GLB, frame handoff, responsive FOV,
scroll length, and original ending after frame 2500 are unchanged in this pass.

Automatic entry waits for finger release and settled mobile scrolling, and
excludes a recent large wheel packet. Keyboard entry focuses Skip without
scrolling; exit restores previous focus even when removed controls leave focus
on the page body. Completion reports once per attempt. A completed result gets
900 ms of reading time after painting before the existing 850 ms native-scroll
advance. Ordinary scrolling remains available and cancels queued advancement;
Escape also stops an advance already in motion. Exit and restart clear old
completion/departure work before another attempt begins.

Twelve focused Chromium checks passed across the camera, arrival, focus,
completion, native-scroll takeover, fresh forward attempts, game appearance,
authored Finish, and drawing keyboard completion. Scoped ESLint and TypeScript
checks passed. Clock-controlled assertions keep short result windows open while
the test runner inspects them. This does not replace the later full-site review.

Text timing was reviewed at twelve source frames on desktop and mobile. The
intelligence and invitation messages reach full opacity within their windows,
stay within the viewport, and leave their boundary gaps clear. No copy timing
values were changed. Samples are recorded in [text-review.json](text-review.json).
These captures use Persian; the game is paused to keep its capture stable.

The subsequent [follow-up review](follow-up-review.md) records two completion
timing gaps, their fixes, and the disposition of every item in the earlier
removal audit. New scroll input takes priority even before the result effect
is installed; motion from an earlier wheel gesture no longer cancels completion.

- [Desktop intelligence, frame 2250](desktop-intelligence.png)
- [Desktop invitation, frame 2420](desktop-invitation.png)
- [Mobile intelligence, frame 2250](mobile-intelligence.png)
- [Mobile invitation, frame 2420](mobile-invitation.png)
- [Desktop game with normal scene appearance](desktop-game-normal-appearance.png)

Implementation commits:

- `4b9c500`: camera movement and scene appearance during interactions.
- `3824933`: settled automatic entry and keyboard focus.
- `0f0e1e1`: result reading, completion protection, and departure cancellation.
