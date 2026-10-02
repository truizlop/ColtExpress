# Colt Express

A browser-based fan implementation of Colt Express with an interactive Three.js train and locally trained opponents. Work in progress; no claims of human-level or superhuman performance are made.

## Scope

The original base game, six bandits, 3–6 player free-for-all and official two-player team rules. Browser-only execution suitable for GitHub Pages. Original generated illustrations and procedural 3D assets; game design credited to Christophe Raimbault / Ludonaute.

## Architecture

- TypeScript rules engine shared by browser and training workers.
- React + Vite + Three.js for accessible responsive play.
- Python / PyTorch for learning; exported small neural networks run locally in a browser worker.
- Reproducible seeded experiments, held-out tournament opponents, information-leakage tests.

The project is initially local only. Publishing is gated on complete local functional and visual verification.
