/** Stronger evaluation: coherent per-game opponents, fixed seats and behavioral diagnostics. */
import fs from 'node:fs';
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
  players: number[];
  expert?: boolean;
  lineup?: 'mixed' | 'homogeneous';
  output: string;
}
const config = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) as Config;
const models = new Map<string, Model>();
for (const spec of [config.candidate, ...config.opponents])
  if (spec.model && !models.has(spec.model)) {
    const model = JSON.parse(fs.readFileSync(spec.model, 'utf8')) as Model;
    validateModel(model);
    models.set(spec.model, model);
  }
if (!config.games || !config.opponents.length || config.players.some((n) => n < 2 || n > 6))
  throw new Error('Invalid arena configuration');
const timing: number[] = [];
function choice(spec: PolicySpec, o: Observation, rng: () => number) {
  if (spec.baseline) return baseline(o, spec.baseline, rng);
  const m = models.get(spec.model!)!;
  if (spec.planner) return plan(m, o, Math.floor(rng() * 2 ** 32), spec.planner).index;
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
const start = performance.now();
for (let game = 0; game < config.games; game++) {
  const players = config.players[game % config.players.length],
    seat = Math.floor(game / config.players.length) % players;
  const seed = (config.seed + game * 31337) >>> 0;
  const state = createGame({ players, expert: !!config.expert, seed });
  const policies = state.players.map((p) =>
    p.id === seat
      ? config.candidate
      : config.opponents[
          (game + (config.lineup === 'homogeneous' ? 0 : p.id)) % config.opponents.length
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
  if ((game + 1) % 10 === 0) process.stderr.write(`${config.name}: ${game + 1}/${config.games}\n`);
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
  config,
  seconds: (performance.now() - start) / 1000,
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
};
fs.writeFileSync(config.output, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, records: undefined }, null, 2));
