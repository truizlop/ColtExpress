# Local release verification

## Express128 improvement release, 5 October 2026

The production build with model SHA `06cda0d0fd8fa86a3b856e1ee8166368f2031b8738fd050a1005662aa5d3fb00` was tested at `http://127.0.0.1:4327/` using the Codex in-app browser. The flow was new game → human choices → worker-backed AI responses → round progression → results and local match download. Browser automation used visible controls; it did not alter hidden application state.

| Check                           | Outcome                                                                                                                                 |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Six-player Legend, expert decks | Five AI opponents completed planning and resolution; retention and round two worked; reload restored the same game                      |
| Two-player Outlaw, 390×844      | Opening-card choice, Shoot cover, partner actions, all five rounds and final team ranking completed                                     |
| Three-player Bandit, Ghost      | Full standard-rule game, hidden first actions, final human-seat victory and exact downloaded replay completed                           |
| Match download                  | 110 moves replayed exactly from the beginning; model hash matched the new release; final scores `[1000, 4800]` and winning team matched |
| Old-save compatibility          | Earlier four-player saved game completed; its 164-move downloaded remainder replayed exactly and was marked `fromStart: false`          |
| Mobile layout                   | No document overflow (`scrollWidth = innerWidth = 390`); action rails, results and download controls remained usable                    |
| Page and console                | Correct title and URL, meaningful content, rendered train, no framework overlay or console errors/warnings                              |
| Build and tests                 | Formatting, TypeScript production build, 64 tests in seven files, training target tests and Python lint/format passed                   |
| Model export                    | 200 probes passed; maximum numerical error 0.00000743 below 0.0001                                                                      |

These mechanically played browser games verify integration and replay, not human strength. Screenshots were inspected at desktop 1280×720 and mobile 390×844. Physical mobile hardware and Safari were not tested. The game records stay in the ignored local run directory.

## Original Express64 release checks (historical)

Browser testing used the Codex in-app browser (IAB), with real UI interactions. No hidden application-state manipulation was used to progress games. A separate localhost origin preserved the original saved game.

## Functional paths

| Path                                                 | Observed outcome                                                                                            |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Four-player standard game                            | Complete five-round game and final ranking                                                                  |
| Two-player duel                                      | Opening-card selection, two bandits per side, Shoot cover, extra partner action, full game and team ranking |
| Three players / Doc                                  | Seven-card opening hand, three carriages, planning and execution through round three                        |
| Five players / Legend                                | Four AI opponents, six train sections, planning and resolution through round two; no runtime errors         |
| Six players / Ghost / expert                         | Hidden first action, keep/discard, deck recycle, saved-game resume and round progression                    |
| Production `/ColtExpress/` / Ghost / expert / Legend | Complete five-round game with selected Express64 model; final score screen; no browser errors               |
| Duplicate physical action cards                      | Clicking the second Move plays the equivalent legal card and updates the queue                              |
| Model unavailable                                    | Explicit error shown; restoring the file and Reload AI recovers without discarding the saved game           |
| Help dialog                                          | Focus trapped, Escape closes, focus restored to How to play                                                 |
| Initial setup                                        | Cannot dismiss into an uninitialized game                                                                   |
| Camera                                               | Previous/next car, drag rotation, Fit train restoration; reduced-motion path skips interpolation            |
| Mobile plan                                          | Horizontal physical card queue and collapse/expand control                                                  |

All two through six player counts are covered by complete engine simulations in automated tests. Browser QA covers representative paths, not every possible random game or every physical mobile device.

## Layout and delivery

- 320×740 and 390×844 mobile, 1024×768 tablet, and 1536×1024 desktop tested. No horizontal document overflow. Native dialogs and horizontal card/opponent rails remain usable.
- Train navigation and core controls use at least 44px targets. All game decisions also have HTML buttons, so gameplay does not require precise 3D clicking.
- Production build served at `http://127.0.0.1:4174/ColtExpress/`: model, worker, generated artwork, textures, fonts and scene load through relative asset paths.
- TypeScript production build, Prettier, and 56 Vitest tests pass. Rules tests include 300 complete seeded standard/expert/team games plus focused powers, events, score and visibility fixtures.
- The selected checkpoint passes 100 PyTorch/JavaScript numeric parity probes with maximum absolute error 0.00000503 (threshold 0.0001).
- The main scene is lazy-loaded; browser inference is in a worker; rendering sleeps while the board is still. Three.js remains a substantial bundle (~250 KB gzip for the scene chunk). Artwork is original generated WebP, fonts are bundled, and no inference service or user account is required.

Visual fidelity is documented separately in [design/FIDELITY.md](design/FIDELITY.md). This is Chromium/IAB testing, not a claim of physical-device Safari/Android certification.
