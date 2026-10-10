# Mobile composition review — 2026-10-10

The mobile layout gives instructions an upper area below the header, controls a lower area, and phase status a separate bottom row. Services use their linked titles above the illustration and descriptions below it. Partners is restored in all locales and in navigation.

Review the [eleven hero phases](../../mobile-camera/composition-20261010/overview.png), [services, Partners and finale](overview.png), and [desktop project](project-desktop.png).

| Reported issue | Result | Capture |
| --- | --- | --- |
| Photo instruction collides with View work and sound | Short upper instruction, compact sound icon, mobile View work removed | [Photo](../../mobile-camera/composition-20261010/activation.png) |
| Lighting instruction collides with utilities and progress | Upper prompt and separate bottom progress | [Lighting](../../mobile-camera/composition-20261010/reveal.png) |
| Game controls cover steering instructions | Upper instruction, lower steering dock, one Skip control | [Game](../../mobile-camera/composition-20261010/experiences.png) |
| Drawing controls cover the instruction | Upper instruction, lower drawing dock, redundant visible scroll hint removed | [Drawing](../../mobile-camera/composition-20261010/connection.png) |
| Intelligence text and actions crowd the bottom | Upper title and short instruction, two lower actions; copy clears during inspection and pinned-person station markers hide | [Intelligence](../../mobile-camera/composition-20261010/intelligence.png) |
| Service counter overlaps the illustration | Mobile counter and scroll hint removed; linked title above, illustration centered, description below | [Content service](service-content.png) |
| Partners heading overlaps cards and is incorrectly renamed | Partners heading and sample-content notice above the ring; header and mobile-menu link added | [Partners](partners.png) |
| Closing message has a stranded caret and distant CTA arrow | Balanced heading, removed carets, compact single-row conversation link | [Finale](finale.png) |
| View project label overlays the image | Label removed; title and featured image remain linked, background cards stay outside keyboard navigation | [Project](project-desktop.png) |

Primary captures use Persian at 390×844 with device pixel ratio 3. Additional service captures cover a [320×500 short phone](service-short-phone.png) and [844×390 landscape](service-landscape.png). Next.js development overlays are hidden in these captures. The outline on the first service title shows keyboard focus after section navigation.

The later [Partners and navigation review](../partners-page-review-20261010/README.md) shows the centered homepage ring, matching home/inner header placement, and the new standalone Partners page. Its screenshots supersede the Partners composition above.

Targeted Playwright checks passed for Persian, English and Arabic, 320×568 and other narrow viewports, 390×360 split-screen, 568×320 landscape, touch and keyboard Skip, intelligence inspection and marker restoration, reduced motion, featured-image navigation, Partners navigation from inner pages and the footer, Back/Forward restoration after resizing, and the ending transition in both scroll directions. Header geometry checks covered all locales at 761, 844, 1003 and 1440 pixels, plus short mobile menus.

Lint, TypeScript, content validation and the production build passed. Partner cards retain their sample-content notice.

## Mobile interaction lens polish

The later focus captures enlarge the [touch monitor](../../mobile-camera/focus-final-20261010/engagement-390x844.png), [game](../../mobile-camera/focus-final-20261010/experiences-390x844.png), and [writing wall](../../mobile-camera/focus-final-20261010/connection-390x844.png). At 390×844, their vertical FOV changes from 84.76° / 86.63° / 82.83° to 67.58° / 67.58° / 65.14°, increasing the displayed screen dimensions by approximately 36% / 41% / 38%.

Each lens holds throughout its interaction window and eases only during camera travel, with identical behavior when scrolling backward. Game framing reserves extra room at heights up to 600px and smoothly blends into the tighter lens by 760px. The [390×600 final game](../../mobile-camera/focus-final-20261010/experiences-390x600.png) clears its instruction and dock; the [rejected tighter trial](../../mobile-camera/focus-final-20261010/rejected-game-short-trial.png) shows why this allowance is necessary. Other viewing windows and the authored desktop/landscape lens retain their framing.

Final captures cover 320×568, 390×600, 390×844, 430×932, 568×320, and 844×390. Runtime values are in [focus measurements](../../mobile-camera/focus-final-20261010/measurements.json); geometry comparisons are in [projection review](../../mobile-camera/focus-final-20261010/projection-review.json). The baseline and first trial folders preserve earlier comparisons; `focus-final-20261010` is the final composition.

The lens/resize math checks and forward/reverse browser check passed. Physical monitor controls passed touch and keyboard checks in Persian and Arabic at 390×600 and 390×844. Direct touch steering, pause, drawing strokes, and Undo passed at 320×568 and 390×844, recorded in [input checks](../../mobile-camera/focus-final-20261010/input-checks.json).

Lint, TypeScript, content validation, and the production build also passed for the lens polish.

## Mobile phases with lower copy

The [Discovery heading](../lower-copy-20261010/fa-discovery-375x668.png), [lighting scroll prompt](../lower-copy-20261010/fa-reveal-375x668.png), [Projects heading](../lower-copy-20261010/fa-proof-375x668.png), [Intelligence text and actions](../lower-copy-20261010/fa-intelligence-375x668.png), and [invitation with its project button](../lower-copy-20261010/fa-invitation-375x668.png) now occupy the empty area below the exhibition. Photo, touch, game, and writing instructions keep their upper placement. These captures supersede the earlier upper composition for the five requested phases.

Intelligence text ends 24px above its explore buttons and still hides while a person or station is selected. At viewport heights of 540px or less, its text stays above the scene so it clears the interactive markers, including the bottom safe area. The other four phases reserve space above the progress rail at heights of 420px or less. The compact invitation omits its eyebrow and reduces the button's top spacing.

The [layout measurements](../lower-copy-20261010/measurements.json) and 30 captures cover Persian at 375×668 and 320×568, English at 390×844, Arabic at 360×640, and compact Persian views at 390×360 and 568×320. The geometry checks verify visible copy, action separation, pointer access to the invitation button, and no horizontal overflow.

Hero layout checks passed in all three locales and short landscape. Invitation pointer and keyboard navigation passed on desktop and mobile. The layout test now pauses the game before measuring its controls so the round cannot finish during those assertions.

## Finale title and caret

The finale title fits one line with its typing caret directly beside the text: [Persian at 320px](../lower-copy-20261010/fa-finale-mobile.png), [English at 390px](../lower-copy-20261010/en-finale-mobile.png), and [Arabic at 360px](../lower-copy-20261010/ar-finale-mobile.png). These captures supersede the earlier finale image. The caret had been removed during the overlap cleanup; it is now restored inside the heading, whose font size scales with viewport width. Scroll typing remains in place.

The browser checks passed for all three locales, resizing each to 320×568, inline caret geometry, and reduced motion. The blue outline on the conversation link is keyboard focus after section navigation. Lint and TypeScript passed for the source and test changes.

## Final safe-area review

The release review found lighting copy overlapping the progress row when a phone reserves 34px at the bottom, and Intelligence copy touching station markers just above the previous compact breakpoint. A shared safe-area inset now moves lower narrative copy together with its controls. Lighting also limits its lower position to retain clearance above progress. Intelligence uses its upper compact composition through 540px, with a smaller title on the narrowest phones.

The [verified measurements](../release-verified-20261010/measurements.json) and 45 captures cover 320×421, 390×430, 320×568, 390×600, 390×500, 390×501, 320×540 and 320×541, with both zero and 34px bottom insets. The Persian narrative captures retain at least 20.6px above the status row. Review the [lighting prompt with a bottom inset](../release-verified-20261010/reveal-320x568-safe34.png), [compact Intelligence](../release-verified-20261010/intelligence-320x421-safe34.png), and [lower Intelligence above the compact breakpoint](../release-verified-20261010/intelligence-320x541-safe34.png). These supersede the initial `release-baseline-20261010` and intermediate `release-final-20261010` captures.

The new `hero-mobile-safe-area.spec.ts` regression checks all three locales, lower narrative/status clearance, and the complete 44px station targets at compact breakpoint boundaries. The safe area is simulated through the shared inset variable because desktop Chromium does not expose a physical phone's bottom inset.

## Static release navigation

The production review reproduced a [Next.js Windows export issue](https://github.com/vercel/next.js/issues/92339): the browser requests dotted segment filenames such as `__next.$d$locale.about.__PAGE__.txt`, while the exporter writes nested directories. This caused navigation data requests to return 404. The publishing script now runs `normalize-static-segments.mjs` to add the requested aliases with identical bytes. It validates all conflicts before writing, retains the original files, and makes repeated runs and already-flat exports safe. The current export needs 62 aliases.

Four script regressions passed for locale, deep project, parallel-route and encoded-root segment keys, exact bytes, idempotency, already-flat files, collisions without partial writes, invalid export roots, and unrelated media preservation. All six production smoke cases passed: Persian, English and Arabic on mobile and desktop. The checks exercise actual exported navigation, home section links, matching header/menu placement, keyboard project navigation, Partners labels and locale URLs, and the finale title/caret. There were no HTTP or browser errors; navigation cancellations are recorded separately in the [production results](../release-production-20261010/results.json).

The production captures show [Discovery](../release-production-20261010/fa-mobile-home-discovery.png), the [centered Partners ring](../release-production-20261010/fa-mobile-home-partners.png), the [one-line finale at 320px](../release-production-20261010/fa-mobile-finale-320px.png), and the [standalone Partners page](../release-production-20261010/fa-mobile-partners-page.png). The same mobile views are recorded for English and Arabic in `release-production-20261010`.

The release regression run also passed 23 browser and camera checks for all locales, dense displays, forward/reverse lenses, viewport and display-density changes, tab suspension, live reduced-motion preferences, invitation pointer/keyboard navigation, Partners fold geometry, featured project navigation, and the finale title/caret. Lint, TypeScript, content validation, camera timing, and the 65-page static production build passed. Existing sample content and review drafts remain labelled; content validation still reports 27 such entries.
