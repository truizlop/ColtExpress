/** Quiet-machine latency check on actual browser difficulty functions and legal positions. */
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createGame, observe, legalActions, applyAction } from '../src/game/engine';
import type { Observation } from '../src/game/types';
import { seeded } from '../src/game/random';
import { baseline } from '../src/ai/tactics';
import { difficultyChoice, type Difficulty } from '../src/ai/difficulty';
import { validateModel, type Model } from '../src/ai/network';
import { search } from '../src/ai/search';

const modelPath = process.argv[2] ?? 'public/models/champion.json';
const output = process.argv[3] ?? 'experiments/v2/browser-policy-latency.json';
const model = JSON.parse(fs.readFileSync(modelPath, 'utf8')) as Model;
const old = JSON.parse(
  fs.readFileSync('experiments/v2/models/express64-release.json', 'utf8'),
) as Model;
validateModel(model);
const probes: { players: number; observation: Observation }[] = [];
for (const players of [2, 3, 4, 5, 6]) {
  const game = createGame({ players, seed: 771921 + players, expert: players % 2 === 1 });
  const rng = seeded(513 + players);
  let collected = 0;
  for (let step = 0; step < 1300 && game.phase !== 'finished'; step++) {
    const actions = legalActions(game);
    const o = observe(game, game.actor, false);
    if (actions.length > 1 && step % 7 === 0 && collected < 20) {
      probes.push({ players, observation: o });
      collected++;
    }
    applyAction(game, actions[baseline(o, 'tactical', rng)], false);
  }
}
const reports = [];
for (const level of ['released-legend', 'greenhorn', 'bandit', 'outlaw', 'legend']) {
  const rows = probes.map(({ players, observation: o }, i) => {
    const rng = seeded(34719 + i);
    const start = performance.now();
    const index =
      level === 'released-legend'
        ? search(old, o, Math.floor(rng() * 2 ** 32), {
            samples: 8,
            maxCandidates: 3,
            rollout: 'policy',
            horizon: 'round',
          }).index
        : difficultyChoice(model, o, level as Difficulty, rng);
    const milliseconds = performance.now() - start;
    if (!o.legal[index]) throw new Error(`Illegal ${level} choice`);
    return { players, phase: o.phase, round: o.round, legalActions: o.legal.length, milliseconds };
  });
  const values = rows.map((r) => r.milliseconds).sort((a, b) => a - b);
  reports.push({
    level,
    decisions: rows.length,
    mean: values.reduce((a, b) => a + b, 0) / values.length,
    p50: values[Math.floor(values.length * 0.5)],
    p95: values[Math.floor(values.length * 0.95)],
    max: values.at(-1),
    rows,
  });
}
const report = {
  model: modelPath,
  modelSha256: createHash('sha256').update(fs.readFileSync(modelPath)).digest('hex'),
  runtime: process.version,
  scope:
    'Single-thread Node measurements of browser decision functions on legal game observations. Not a mobile-device benchmark or a strength test.',
  reports,
};
fs.writeFileSync(output, JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    reports.map(({ rows, ...summary }) => summary),
    null,
    2,
  ),
);
