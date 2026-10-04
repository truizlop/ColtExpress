# Colt Express

A playable tabletop train heist, built with React and Three.js. Choose a bandit, program your moves, and rob a moving train against locally trained neural opponents.

**[Play in your browser](https://truizlop.github.io/ColtExpress/)** · [Rules coverage](docs/RULES.md) · [AI model card](MODEL_CARD.md) · [Training](docs/TRAINING.md)

![The Colt Express game board](docs/design/desktop-render.jpg)

## Play

- One human and **1–5 AI opponents**. The official two-player variant gives each side two bandits.
- All six base-game characters, five rounds, special powers, round events, hidden cards, shooting, punching, loot and the marshal.
- Standard and expert deck rules, four difficulty levels, automatic local save/resume, game history, replayable match downloads and built-in help.
- A detailed cutaway 3D train, original illustrated cards and portraits, mobile carriage navigation, keyboard controls and reduced-motion support.
- Runs entirely in your browser. No account, inference service or API key. Your saved game stays on that browser and origin.

This is an unofficial fan implementation of the **2016 base game**, not an expansion collection. Game design is by Christophe Raimbault; Colt Express is published by Ludonaute. The application uses original generated illustrations and procedural 3D geometry. See [asset credits](docs/design/ASSETS.md) and [notices](public/NOTICE.txt).

## Run locally

Node 22+ and pnpm 11.19:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

```sh
pnpm format:check
pnpm test
pnpm build
pnpm preview
```

Python is only needed for training and experiments. The selected model is included in `public/models/champion.json`. [Training instructions](docs/TRAINING.md) cover installation, the improvement experiments, export parity and the frozen benchmark protocol.

## AI and evidence

The improved **Express128 planning-league** model combines richer observations, a larger policy/value network, population PPO and information-set Monte Carlo planning. It receives only information its player can see and shares the browser’s TypeScript rules engine with training.

The improvement campaign generated **320,512 additional training games and 26.08 million learner decisions** across six main branches. We compared longer training, larger representations, planning opponents, value calibration and search variants, then selected a checkpoint on separate standard/expert suites. The selected network’s direct new lineage is 46,080 games; campaign volume includes alternatives that were rejected.

In **840 fresh final games**, the new Legend faced the previous release’s strongest Legend in every other seat. Weights and search settings were frozen beforehand.

| Suite vs old Legend   | Games | New Legend winning share | 95% interval | Equal-strength reference |
| --------------------- | ----: | -----------------------: | -----------: | -----------------------: |
| Standard, 3–6 players |   480 |               **37.29%** | 33.12–41.46% |                   23.75% |
| Expert, 3–6 players   |   240 |               **37.92%** | 32.08–44.17% |                   23.75% |
| Two-player teams      |   120 |               **69.17%** | 60.83–77.50% |                   50.00% |

The equal-strength reference is mathematical, not a measured opponent. Results split ties and report the two-player variant separately; the confidence intervals are stratified bootstrap estimates.

Bandit no longer has injected random mistakes. Outlaw now plans across four sampled worlds, and Legend uses twelve worlds with broader candidate evaluation. All computation runs locally in a browser worker. A completed game’s **Save match** button downloads a replayable record with the exact model version for investigating weaknesses; nothing is uploaded.

These are **engine-opponent results, not human trials**. Beating every human has not been established. The [model card](MODEL_CARD.md) records the architecture, per-player-count results, uncertainty, runtime measurements and limitations. The [reproduction guide](docs/TRAINING_V2.md) explains how to rerun the tournament from committed weights.

## Project structure

- `src/game`: deterministic rules, visibility boundary and legal actions.
- `src/ai`: features, browser inference, difficulty policies and sampled-world planning.
- `src/components`, `src/scene`: accessible game controls and Three.js board.
- `training`: PyTorch training, shared Node bridge, evaluation and report scripts.
- `experiments`: frozen protocol, training curves, per-game results and analysis.
- `docs`: rule sources, design concepts, [visual comparison](docs/design/FIDELITY.md) and [QA record](docs/QA.md).

GitHub Actions verifies formatting, tests and the production build, then deploys `main` to GitHub Pages. Relative assets support the `/ColtExpress/` path. Local release verification includes 64 tests, 300 complete engine simulations, 200 PyTorch/JavaScript parity probes, desktop/mobile browser games and exact match replay.
