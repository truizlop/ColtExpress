# Project record

## Delivered scope

Repository: `~/Development/ColtExpress`, public remote `truizlop/ColtExpress`. The user requested small commits and no push before complete local verification. The implementation covers the 2016 base game, two-player teams and 3–6 player free-for-all, standard/expert decks, all six bandits, a responsive Three.js board and four locally evaluated AI difficulty settings.

## Technical decisions

React/Vite/TypeScript and Three.js provide the static browser application. Python/PyTorch trains a small policy/value network against the exact TypeScript engine through a Node bridge. Exported weights execute in a browser worker; no inference backend or API keys are required. Observation boundaries keep hidden state out of policy inputs and search roots.

A conventional AlphaZero implementation is a poor direct fit for this multiplayer, partially observed game. The selected implementation combines imitation, population PPO and small information-set Monte Carlo planning. It is an experimentally supported practical choice for this project, not proof that this is the globally best architecture.

## Research outcome

Six training runs generated 199,680 games and 19,479,876 learner decisions. Two widths, 40 PPO checkpoints and alternative search strategies were compared. Express64 at PPO iteration 900 was selected before final holdout testing. Legend scored 50.11% winning share against tactical opponents across 900 standard games and 45.83% across 480 expert games. The [model card](../MODEL_CARD.md) includes uncertainty, player-count breakdowns, other opponents and calibration details.

The user's aspiration to beat every human remains unproven. There have been no human evaluation matches. Future research should test humans and broader opponent leagues rather than equating baseline wins with universal superiority.

## Design revision

After the user asked for a more ambitious result closer to the concepts, the UI gained a standalone engraved wordmark, stronger comic portraits, transparent illustrated cards, decorative frames, material textures, richer procedural train details and a tighter mobile composition. Original concepts, final renders and a detailed comparison are retained in [design/FIDELITY.md](design/FIDELITY.md).

## Release gates

- Deterministic rules and visibility tests, including 300 complete seeded standard/expert/team games.
- 56 tests, strict TypeScript production build, source formatting and Python lint checks.
- Selected-model PyTorch/JavaScript export parity on 100 probes.
- Complete standard, team and production-path expert browser games; representative paths across all player counts.
- Desktop 1536×1024, tablet 1024×768, phone 390×844 and 320×740 inspection.
- GitHub Pages workflow verifies formatting, tests and build before deploying.

[QA details](QA.md) distinguish automated coverage, observed browser paths and platform limitations. The original saved browser game was preserved when automatic approval review rejected a reset; separate origins were used for subsequent tests.
