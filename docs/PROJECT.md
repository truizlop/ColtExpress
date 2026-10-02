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
- https://arxiv.org/abs/1711.00832
