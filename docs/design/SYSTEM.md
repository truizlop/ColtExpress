# Tabletop design system

Visual references: desktop-concept.png (1536x1024), mobile-concept.png (portrait). Assets: public/art/{portraits,actions,desert}.webp (lossless source masters in docs/artwork). All gameplay text and controls are live HTML; train, bandits, loot and track are actual Three.js geometry, as requested.

Palette: parchment #f2e8d4, paper #faf2df, ink #292721, secondary #766853, oxblood #943e32, brass #b9914c. Portraits use six character colors. Body Source Sans 3 (16px, 1.45), display Rye (24px desktop, 19px mobile), controls 15px semibold, captions 12px. Thin ink/brass rules, ticket-corner geometry, 4px or smaller corners. Primary actions oxblood, secondary ink outlines. Focus rings 3px green. Minimum controls 44px.

Desktop structure: compact wordmark/navigation header; opponent rail and round/phase rail; large train scene with narrow action-queue sidebar; action prompt; own character and hand along bottom. Native setup ticket overlays the table on first visit. Mobile: compact header and horizontally scrolling opponents; round bar; 36vh train with car-navigation; collapsible queue; prompt and horizontally scrolling hand; fixed-safe-area-friendly actions. No content hidden behind fixed elements.

Required states: setup, trained-model loading/failure/retry, private team reserve selection, programming including hidden Ghost/tunnel cards, cover action, expert keep/discard, action resolution with destinations/targets/loot, AI thinking, round-end event summary, final ranking, saved-game resume, new-game confirmation, rules dialog, sound preference and reduced motion. Dialogs trap focus and restore it.

Allowed primary copy: Colt Express, New game, How to play, Sound on/off, Round N / 5, Schemin’, Stealin’, The plan, Your turn [name], Play a card or draw 3 cards, Draw 3 cards, Fit train, Previous car, Next car, Continue, Board the train. Additional copy is permitted only to explain an actual rules decision or error.

Intentional deviations: exact hidden opponent totals in generated concepts are replaced with visible token counts; hand composition and card counts reflect engine state. Fake next-tunnel hint appears only when known current round requires it. No illustration baked into functional buttons or train scene. Logo is typeset text (original asset licensing and clean scaling), with no invented tagline. Station/round screens extend the same ticket/paper system.
