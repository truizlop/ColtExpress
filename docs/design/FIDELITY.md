# Concept-to-browser fidelity review

Reviewed on 2026-10-03 with the Codex in-app browser. Both original concepts and both latest browser screenshots were inspected with `view_image` in the same final QA pass.

- [Desktop concept](desktop-concept.png), native **1536×1024**; [desktop implementation](desktop-render.jpg), captured at **1536×1024**.
- [Mobile concept](mobile-concept.png), native **853×1844**; [mobile implementation](mobile-render.jpg), captured at **390×844 CSS pixels**, the corresponding practical phone layout and near-identical aspect ratio. Testing the concept's 853 image pixels as CSS pixels would invoke a tablet breakpoint, so the phone was verified at its logical width. An additional 320×740 check found no document overflow.
- Screenshots use the browser screenshot API. Responsive emulation changes viewport dimensions only; game progress came from real UI controls.

## Fidelity ledger

| Comparison | Concept evidence | Render evidence and correction |
| --- | --- | --- |
| Main composition | Shallow logo band, portraits/round band, dominant train, right-hand plan, physical hand below | Desktop follows the same order and proportions: header ends near y=197, scene ends near y=692, hand below. The train and controls remain the focal point. |
| Wordmark | Engraved COLT EXPRESS lettering, locomotive silhouette, ALL ABOARD FOR TROUBLE | Replaced the early typeset approximation with a standalone transparent generated wordmark carrying the same text and motif. |
| Portraits | Large colored circular comic portraits with ink contours | Generated a stronger comic atlas and enlarged desktop portraits, especially the human player. Portraits and character-colored names form the same open rail. |
| Palette and texture | Cream parchment, charcoal ink, oxblood buttons, wood/brass train | Added a dedicated paper/wood/iron/sand atlas, restrained cream paper wash and warm scene lighting. No generic glass panels or unrelated color gradient. |
| Typography | Heavy western display, slab-serif guidance, readable small labels | Alfa Slab One headings, Roboto Slab prompts and Source Sans labels are explicitly sized across chrome and game controls. The fonts interpret the image lettering; they are not a pixel-identical typeface extraction. |
| Action cards | Concave double-line frames, ink illustrations, paper background | Added faithful native SVG frames, transparent action vignettes and physical duplicate cards. Titles and rules remain native HTML; cards show the actual hand. |
| Plan | Vertical bordered rail on desktop; horizontal card row on phone | Rebuilt entries as miniature action/back cards with colored meeples and order markers. Phone queue expands/collapses and scrolls horizontally; desktop queue scrolls vertically. |
| Train and environment | Open carriages, warm timber, iron locomotive, brass trim, loot and desert props | Added textured timbers, rounded edges, rivets, roof clamps, cutaway windows, benches, posters, cloth purses, jewels, strongboxes, cacti, barrels, crates and signs. The user requested real Three.js models: the result is interactive geometry rather than the concept's photoreal painted train. |
| Phone hierarchy | Compact header/rail, close train view, plan, owner/draw, turn prompt and hand | Reduced scene/queue padding and card height so this sequence fits a useful phone viewport. Carriage framing stays close; arrows and Fit train control navigation. Controls have 44px targets. |
| Motion and interaction | Tangible tabletop metaphor | Smooth camera and pawn movement, physical card hover/focus, reduced-motion support. Rendering sleeps when the scene is still. Camera reset, duplicate-card play, help focus return and mobile plan collapse/expand were exercised. |

## Above-the-fold copy diff

Preserved: **Colt Express**, **All aboard for trouble**, **New game**, **How to play**, character names, **Round N / 5**, **Schemin’ / Stealin’**, **The plan**, **Your turn**, **Draw 3 cards**, and action names.

Intentional functional deviations:

- Opponents show visible loot-token counts rather than the concept's exact purse dollars; purse values are private under the game rules.
- Actual hand cards, remaining deck counts, wounds and fired bullets replace illustrative counts. Duplicate cards remain individually selectable.
- The actual round schedule and event replace the concept's invented next-turn banner. Tunnel prompts explain hidden programming when applicable.
- Inspect train, history, playback speed, save/resume, setup controls and unofficial-game credit support the requested playable product.
- The human's real character power replaces the decorative quotation. Turn instructions adapt to the current legal decision.
- Mobile puts help inside the game menu to preserve room for the logo; sound is an on/off control rather than the concept's unimplemented volume slider.
- Native vectors implement directional icons, meeples and card borders. Train, loot and scenery geometry intentionally support the requested interactive 3D board.

The implementation was faithfully verified against the concepts' composition, palette, typography hierarchy, portrait/card treatment and responsive sequence. It is not a pixel-perfect rendering of the painted concept: the documented rules-driven content and real-time 3D interpretation are intentional. No unresolved material clipping, overflow, inert-control or asset-loading issue remained in the inspected layouts. Browser functional coverage is recorded in [QA](../QA.md).
