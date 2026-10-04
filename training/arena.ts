/** Stronger evaluation: coherent per-game opponents, fixed seats and behavioral diagnostics. */
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createGame, observe, legalActions, applyAction } from '../src/game/engine';
import { baseline, type Baseline } from '../src/ai/tactics';
import { modelChoice, validateModel, type Model } from '../src/ai/network';
import { search, type SearchOptions } from '../src/ai/search';
import { plan, type PlannerOptions } from '../src/ai/planner';
import { seeded } from '../src/game/random';
import type { Observation } from '../src/game/types';
export interface PolicySpec {
  name: string;
  model?: string;
  rolloutModel?: string;
  baseline?: Baseline;
  temperature?: number;
  search?: SearchOptions;
  planner?: PlannerOptions;
}
interface Config {
  name: string;
  candidate: PolicySpec;
  opponents: PolicySpec[];
  games: number;
  seed: number;
  seedStride?: number;
  players: number[];
  expert?: boolean;
  lineup?: 'mixed' | 'homogeneous' | 'rotating';
  output: string;
}
const config = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) as Config;
const stopArg = process.argv.indexOf('--stop-after');
const stopAfter = stopArg < 0 ? Infinity : Number(process.argv[stopArg + 1]);
const models = new Map<string, Model>();
for (const spec of [config.candidate, ...config.opponents])
  for (const path of [spec.model, spec.rolloutModel])
    if (path && !models.has(path)) {
      const model = JSON.parse(fs.readFileSync(path, 'utf8')) as Model;
      validateModel(model);
      models.set(path, model);
    }
if (!config.games || !config.opponents.length || config.players.some((n) => n < 2 || n > 6))
  throw new Error('Invalid arena configuration');
const files = [
  'training/arena.ts',
  ...['src/game', 'src/ai'].flatMap((dir) =>
    fs
      .readdirSync(dir)
      .filter((name) => name.endsWith('.ts'))
      .sort()
      .map((name) => `${dir}/${name}`),
  ),
];
const sourceHash = createHash('sha256');
for (const path of files) sourceHash.update(path).update(fs.readFileSync(path));
const provenance = {
  sourceSha256: sourceHash.digest('hex'),
  node: process.version,
  models: Object.fromEntries(
    [...models.keys()].map((path) => [
      path,
      createHash('sha256').update(fs.readFileSync(path)).digest('hex'),
    ]),
  ),
};
const timing: number[] = [];
function choice(spec: PolicySpec, o: Observation, rng: () => number) {
  if (spec.baseline) return baseline(o, spec.baseline, rng);
  const m = models.get(spec.model!)!;
  if (spec.planner)
    return plan(
      m,
      o,
      Math.floor(rng() * 2 ** 32),
      spec.planner,
      spec.rolloutModel ? models.get(spec.rolloutModel)! : m,
    ).index;
  if (spec.search) return search(m, o, Math.floor(rng() * 2 ** 32), spec.search).index;
  return modelChoice(m, o, rng, spec.temperature ?? 0.08);
}
const records: {
  game: number;
  seed: number;
  players: number;
  seat: number;
  opponents: string[];
  win: number;
  score: number;
  scores: number[];
  decisions: number;
  wasted: number;
  programmed: number;
  draws: number;
  played: Record<string, number>;
}[] = [];
const progressPath = config.output + '.partial.json';
let elapsedBefore = 0;
if (fs.existsSync(progressPath)) {
  const saved = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
  if (
    JSON.stringify(saved.config) !== JSON.stringify(config) ||
    JSON.stringify(saved.provenance) !== JSON.stringify(provenance)
  )
    throw new Error('Arena resume configuration/source/model mismatch');
  records.push(...saved.records);
  timing.push(...saved.timing);
  elapsedBefore = saved.seconds;
}
const start = performance.now();
for (let game = records.length; game < config.games; game++) {
  const players = config.players[game % config.players.length],
    seat = Math.floor(game / config.players.length) % players;
  const seed = (config.seed + game * (config.seedStride ?? 31337)) >>> 0;
  const state = createGame({ players, expert: !!config.expert, seed });
  const policies = state.players.map((p) =>
    p.id === seat
      ? config.candidate
      : config.opponents[
          (config.lineup === 'rotating'
            ? Math.floor(Math.floor(game / config.players.length) / players) + p.id
            : game + (config.lineup === 'homogeneous' ? 0 : p.id)) % config.opponents.length
        ],
  );
  const rngs = state.players.map((p) => seeded((seed + 123 + p.id * 7919) >>> 0));
  let decisions = 0,
    wasted = 0,
    programmed = 0,
    draws = 0,
    steps = 0;
  const played: Record<string, number> = {};
  while (state.phase !== 'finished' && steps++ < 1500) {
    const actions = legalActions(state),
      actor = state.actor;
    if (
      actor === seat &&
      state.phase === 'execute' &&
      actions.length === 1 &&
      actions[0].kind === 'pass'
    )
      wasted++;
    let index = 0;
    if (actions.length > 1) {
      const o = observe(state, actor, false),
        t = performance.now();
      index = choice(policies[actor], o, rngs[actor]);
      if (actor === seat) {
        timing.push(performance.now() - t);
        decisions++;
      }
    }
    const a = actions[index];
    if (!a) throw new Error(`Illegal choice ${index}`);
    if (actor === seat && a.kind === 'draw') draws++;
    if (actor === seat && a.kind === 'play') {
      programmed++;
      const kind = state.players[seat].hand.find((c) => c.id === a.card)!.kind;
      played[kind] = (played[kind] ?? 0) + 1;
    }
    applyAction(state, a, false);
  }
  if (state.phase !== 'finished') throw new Error('Nonterminating game');
  records.push({
    game,
    seed,
    players,
    seat,
    opponents: policies.filter((_, p) => p !== seat).map((p) => p.name),
    win: state.winners.includes(seat) ? 1 / state.winners.length : 0,
    score: state.scores[seat],
    scores: state.scores,
    decisions,
    wasted,
    programmed,
    draws,
    played,
  });
  if ((game + 1) % 10 === 0 || game + 1 >= stopAfter) {
    const snapshot = {
      config,
      provenance,
      records,
      timing,
      seconds: elapsedBefore + (performance.now() - start) / 1000,
    };
    fs.writeFileSync(progressPath + '.tmp', JSON.stringify(snapshot));
    fs.renameSync(progressPath + '.tmp', progressPath);
    process.stderr.write(`${config.name}: ${game + 1}/${config.games}\n`);
  }
  if (game + 1 >= stopAfter && game + 1 < config.games) process.exit(0);
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const summarize = (rs: typeof records) => ({
  games: rs.length,
  winRate: mean(rs.map((x) => x.win)),
  chance: mean(rs.map((x) => 1 / x.players)),
  score: mean(rs.map((x) => x.score)),
  wastedPerGame: mean(rs.map((x) => x.wasted)),
  programmedPerGame: mean(rs.map((x) => x.programmed)),
  drawsPerGame: mean(rs.map((x) => x.draws)),
});
timing.sort((a, b) => a - b);
const report = {
  provenance,
  config,
  seconds: elapsedBefore + (performance.now() - start) / 1000,
  overall: summarize(records),
  byPlayers: Object.fromEntries(
    config.players.map((n) => [n, summarize(records.filter((r) => r.players === n))]),
  ),
  latency: {
    decisions: timing.length,
    mean: mean(timing),
    p50: timing[Math.floor(timing.length * 0.5)],
    p95: timing[Math.floor(timing.length * 0.95)],
    max: timing[timing.length - 1],
  },
  records,
  latencySamples: timing,
};
fs.writeFileSync(config.output, JSON.stringify(report, null, 2));
if (fs.existsSync(progressPath)) fs.unlinkSync(progressPath);
console.log(JSON.stringify({ ...report, records: undefined, latencySamples: undefined }, null, 2));
