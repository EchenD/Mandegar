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
