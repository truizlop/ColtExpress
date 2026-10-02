# Project plan and working record

## User requirements

Repository: ~/Development/ColtExpress. Public GitHub repository on truizlop, but no push until everything works locally. Small commits. Accurate base game, 3D Three.js train, excellent responsive desktop/mobile UI, variable AI opponent count and difficulty, strongest feasible trained model with experiments. Goal active in Codex.

## Completion gates

1. Accurate deterministic rules engine with source-backed round cards, loot, powers, events, standard/expert/two-player rules, visibility and tests.
2. Observation-safe baselines, reproducible training and export, held-out multi-seat and multi-character experiments; claims limited to observed evidence.
3. Full playable responsive UI, generated portraits/action art/background, detailed Three.js train; save/resume, help, all decisions and end game.
4. Desktop/mobile/browser QA, model parity, production build and full-game checks.
5. Small committed checkpoints, public repository and GitHub Pages deployment only after local gates.

## Decisions

React/Vite/TypeScript, Three.js. Exact TypeScript engine shared with Node rollout process; Python/PyTorch learning with small exported neural networks. No external inference service. Compare imitation initialization, PPO population self-play and information-set search at matched budgets. Preserve public/private state separation, no clairvoyance.

The user's 'beat any human player' is a research target, not a verifiable completion claim without human evaluation. Establish strong measured baselines and retain reproducible experiments.

## Design

Western tabletop: warm parchment, charcoal ink, brass and oxblood. Large cutaway 3D train and original illustrated portraits/cards. Compact game chrome, portrait-mobile rail navigation, native accessible controls. Image concept generated before UI implementation. Intentional deviations from concept: hidden opponent purse totals remain hidden, actual legal hands rather than all action types, correct queue and rounds, real Three.js geometry instead of rendered bitmap train.

## Progress

- Repository initialized. Hardware: Apple M1 Max, 64 GB RAM, 10 CPU cores. GitHub account verified as truizlop with escalated CLI network access.
- Skills read: Frontend App Builder, Anti-AI-Slop, Imagegen, frontend testing, React best practices. User explicitly chose GitHub Pages, so Sites hosting is not used.
- Desktop concept: docs/design/desktop-concept.png.

## References

- https://www.ludonaute.fr/en/colt-express-downloads/
- https://cdn.1j1ju.com/medias/f6/e9/06-colt-express-rulebook.pdf
- https://arxiv.org/abs/1707.06347
- https://eprints.whiterose.ac.uk/id/eprint/75048/
- https://arxiv.org/abs/1712.01815

- Rules engine implemented against 2016 edition. 47 tests passing, including 300 complete seeded standard/expert/team games and hidden-information boundary checks. Exact schedules transcribed from official card PDF and all six carriage floor counts inspected. PyTorch 2.14.1 with MPS installed. Original portrait/action/background production art generated.

## Working checkpoint (2026-10-02, ~23:15 Madrid)

- Full responsive UI implemented and committed (923ab22, 1cbe14a). Mobile complete four-player game verified in IAB. Six-player expert/Ghost game in progress; keep/discard and saved-game recovery tested. Model missing-file failure and explicit Reload AI recovery verified. New errors since removing Drei Html labels: none. Original generated art compressed to 0.99 MB total with source masters retained.
- 52 tests pass including sampled-world conservation/legal-action/hidden-seed checks. Root information-set Monte Carlo search implemented; Legend uses 12 samples × up to 6 candidates, complete tactical-policy rollouts. Uniform beliefs are approximate. Runtime around 1.1 s on a cold four-player decision. Full 200-game search evaluation still running.
- Completed two imitation architectures (32/64), 3,840 games each. Completed two width-32 PPO runs (32,000 games each). 20 checkpoints × 600 validation games. Best observed PPO exploratory iteration 300: 40.42% wins against tactical baseline vs average 29% chance (mixed 2–6 players). This is model-selection evidence, not a final holdout or a human-strength claim.
- Longer runs currently active: ppo-w64 (1,000 iterations ×64, lr .0003→.00005, seed24719, starts imitation-w64) and ppo-refined (1,000 ×64, lr .00008→.00002, entropy .03, seed34719, starts PPO exploratory300). Both seeded with strongest previous opponents, checkpoint every100.
- No remote created or push performed. Remaining: finish model experiments/holdout, strength levels validation, production subpath/browser QA including duel, responsive fidelity comparison, documentation/model card/repro commands, CI+Pages, final local gates, public repo and deployment.

## Visual revision checkpoint (2026-10-03)

- Rebuilt the visual treatment to better match the original desktop/mobile concepts, including new standalone logo, comic portrait atlas, transparent action art, card backs and material atlas; real Three.js scenery and textured train.
- Verified 320px, 390px, 1024px and 1536px layouts in IAB; no horizontal document overflow. Duplicate hand-card actions work; modal Escape restores focus. Existing rules tests and new neural-leaf search test pass (56 total). Production build passes.
- Automatic approval review rejected resetting the original saved QA game, so it was preserved. Further visual QA uses a separate localhost origin, without altering that save.
- Full-game search did not outperform policy-only on the initial 200-game comparison. New one-round neural-policy rollout/value-leaf search scored 44.5% vs policy-only 38.0% on the paired initial 200-game set; 600-game validation is running before any adoption. No human strength claim.
