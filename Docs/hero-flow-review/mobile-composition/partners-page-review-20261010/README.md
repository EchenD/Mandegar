# Partners and navigation review

The homepage partner ring is centered on normal mobile viewports. Its compact layout reserves room for the heading on short screens, then folds into the same center as the next section's canvas. The ring clears the back-to-top control in both RTL and LTR layouts.

The header has the same dimensions and placement on home and inner pages. Home navigation seeks sections; inner navigation opens Projects, Services, About, Partners, and Contact pages. The footer uses the same destinations.

Section navigation also waits for the static layout to settle when motion preferences change. Queued scroll and focus work is replaced by the newest destination and canceled during layout cleanup. The reduced-motion Work shortcut focuses its visible project title.

The new Partners page uses the shared editorial introduction and closing CTA, with the site's paper background, fine rules, blue accents, and illustrative marks. Current sample content stays explicitly labelled.

- [Centered homepage ring](home-partners-centered.png)
- [Persian mobile page](partners-fa-mobile.png)
- [English desktop page](partners-en-desktop.png)
- [Arabic narrow page](partners-ar-narrow.png)

Browser checks cover the three locales, short mobile screens, desktop, landscape, keyboard links, reduced motion, heading/card clearance, card folding, menu scroll-lock release, and homepage history navigation. Header geometry was compared across fifteen locale/viewport combinations. The Partners page accessibility check reported no violations.

Final validation passed: ESLint, TypeScript, local content validation, the production build, and the focused keyboard/reduced-motion regression checks. The build generated Partners routes in Persian, English, and Arabic. Local home and Partners previews both returned HTTP 200.
