/** Generate observation-only policy-improvement targets from the measured stronger planner. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createGame, observe, legalActions, applyAction } from '../src/game/engine';
import { encodeV2 } from '../src/ai/features-v2';
import { infer, sample, softmax, validateModel, type Model } from '../src/ai/network';
import { plan, type PlannerOptions } from '../src/ai/planner';
import { seeded } from '../src/game/random';
import { baseline } from '../src/ai/tactics';
const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? fallback : process.argv[i + 1];
};
const modelPath = arg('--model', 'experiments/v2/models/express64-release.json'),
  target = Number(arg('--positions', '10000')),
  seed = Number(arg('--seed', '1100000001'));
const output = arg('--output', 'training/runs/v2-search-data');
fs.mkdirSync(output, { recursive: true });
const model = JSON.parse(fs.readFileSync(modelPath, 'utf8')) as Model;
validateModel(model);
const options: PlannerOptions = {
  worlds: Number(arg('--worlds', '12')),
  warmup: 4,
  finalists: 4,
  opponents: 'mixed',
};
const rng = seeded(seed + 918),
  file = fs.openSync(path.join(output, 'positions.jsonl'), 'wx'),
  start = performance.now();
let positions = 0,
  games = 0,
  changed = 0;
const phases: Record<string, number> = {};
const manifest = {
  model: modelPath,
  modelSha256: createHash('sha256').update(fs.readFileSync(modelPath)).digest('hex'),
  featureVersion: 2,
  seed,
  options,
  targetPositions: target,
};
fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
try {
  while (positions < target) {
    const players = games % 10 === 0 ? 2 : 3 + (games % 4),
      s = createGame({
        players,
        expert: players > 2 && games % 4 === 0,
        seed: (seed + games * 31337) >>> 0,
      });
    const rows: {
      state: number[];
      actions: number[][];
      target: number[];
      player: number;
      choice: number;
      phase: string;
      round: number;
      value?: number;
    }[] = [];
    let steps = 0;
    while (s.phase !== 'finished' && steps++ < 1500) {
      const legal = legalActions(s);
      let index = 0;
      if (legal.length > 1) {
        const o = observe(s, s.actor, false),
          prediction = infer(model, o);
        const eligible = ['scheme', 'cover', 'execute'].includes(o.phase);
        if (
          eligible &&
          positions + rows.length < target &&
          rng() < (o.phase === 'execute' ? 0.25 : 0.5)
        ) {
          const result = plan(model, o, Math.floor(rng() * 2 ** 32), options),
            f = encodeV2(o);
          index = result.index;
          const finalists = result.estimates.filter((x) => x.finalist),
            values = finalists.map((x) => x.value - 0.015 * x.prior),
            probs = softmax(values, 0.035);
          const teacher = legal.map(() => 0);
          finalists.forEach((x, i) => {
            teacher[x.index] = 0.8 * probs[i];
          });
          teacher[index] += 0.2;
          rows.push({
            ...f,
            target: teacher,
            player: s.actor,
            choice: index,
            phase: s.phase,
            round: s.round,
          });
          phases[s.phase] = (phases[s.phase] ?? 0) + 1;
          if (index !== prediction.logits.indexOf(Math.max(...prediction.logits))) changed++;
        } else
          index =
            games % 5 === 0 && s.actor !== 0
              ? baseline(o, 'strategist', rng)
              : sample(prediction.logits, rng, 0.3);
      }
      applyAction(s, legal[index], false);
    }
    if (s.phase !== 'finished') throw new Error('Nonterminating training game');
    const cash = softmax(s.scores, 500);
    for (const row of rows) {
      row.value =
        0.9 * (s.winners.includes(row.player) ? 1 / s.winners.length : 0) + 0.1 * cash[row.player];
      fs.writeSync(file, JSON.stringify(row) + '\n');
    }
    positions += rows.length;
    games++;
    if (games % 10 === 0) {
      const progress = {
        positions,
        games,
        changed,
        seconds: (performance.now() - start) / 1000,
        phases,
      };
      fs.writeFileSync(path.join(output, 'progress.json'), JSON.stringify(progress, null, 2));
      console.log(JSON.stringify(progress));
    }
  }
} finally {
  fs.closeSync(file);
}
fs.writeFileSync(
  path.join(output, 'complete.json'),
  JSON.stringify(
    { ...manifest, positions, games, changed, seconds: (performance.now() - start) / 1000, phases },
    null,
    2,
  ),
);
