# Tabletop design system

Visual references: desktop-concept.png (1536x1024), mobile-concept.png (portrait). Assets: see ASSETS.md (lossless source masters in docs/artwork). All gameplay text and controls are live HTML; train, bandits, loot and track are actual Three.js geometry, as requested.

Palette: parchment #f2e8d4, paper #faf2df, ink #292721, secondary #766853, oxblood #943e32, brass #b9914c. Portraits use six character colors. Body Source Sans 3 (16px, 1.45); editorial prompts and button copy Roboto Slab; action titles and opponent names Alfa Slab One; engraved wordmark from the concept. Desktop prompt 25px, mobile 19px. Metadata 11–14px. Thin ink/brass rules, ticket-corner geometry, 4px or smaller corners. Primary actions oxblood, secondary ink outlines. Focus rings 3px green. Minimum controls 44px.

Desktop structure: compact wordmark/navigation header; opponent rail and round/phase rail; large train scene with narrow action-queue sidebar; action prompt; own character and hand along bottom. Native setup ticket overlays the table on first visit. Mobile: compact header and horizontally scrolling opponents; round bar; 36vh train with car-navigation; expanded horizontal card queue with collapse control; own bandit/draw row, then prompt and horizontally scrolling hand; fixed-safe-area-friendly actions. No content hidden behind fixed elements.

Required states: setup, trained-model loading/failure/retry, private team reserve selection, programming including hidden Ghost/tunnel cards, cover action, expert keep/discard, action resolution with destinations/targets/loot, AI thinking, round-end event summary, final ranking, saved-game resume, new-game confirmation, rules dialog, sound preference and reduced motion. Dialogs trap focus and restore it.

Allowed primary copy: Colt Express, New game, How to play, Sound on/off, Round N / 5, Schemin’, Stealin’, The plan, Your turn [name], Play a card or draw 3 cards, Draw 3 cards, Fit train, Previous car, Next car, Continue, Board the train. Additional copy is permitted only to explain an actual rules decision or error.

Intentional deviations: exact hidden opponent totals in generated concepts are replaced with visible token counts; hand composition and card counts reflect engine state. Fake next-tunnel hint appears only when known current round requires it. No illustration baked into functional buttons or train scene. The engraved logo and “ALL ABOARD FOR TROUBLE” tagline are original generated assets matching the concept, restored in response to the user’s fidelity feedback. Station/round screens extend the same ticket/paper system.

## Second visual pass (2026-10-03)

The user requested a more ambitious implementation closer to the concepts. Restored the engraved wordmark, comic portraits, larger physical action cards, ornate backs, soft paper grain, wood/iron textures, cutaway windows, brass fittings, 3D desert props, warmer directional light and readable physical loot. Desktop round information shares the opponent rail for up to three opponents; crowded tables get a full-width rail. Mobile focuses the current car, offers 44px navigation, and keeps a visible horizontal plan. Camera and pawn transitions invalidate only while moving; reduced motion skips interpolation.
