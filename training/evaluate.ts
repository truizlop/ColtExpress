import fs from 'node:fs';
import { createGame, observe, applyAction, legalActions } from '../src/game/engine';
import { baseline, type Baseline } from '../src/ai/tactics';
import { modelChoice, type Model } from '../src/ai/network';
import { search } from '../src/ai/search';
import { seeded } from '../src/game/random';
import { difficultyChoice, type Difficulty } from '../src/ai/difficulty';
const arg = (key: string, fallback: string) => {
  const i = process.argv.indexOf(key);
  return i < 0 ? fallback : process.argv[i + 1];
};
const candidate = arg('--candidate', 'tactical'),
  opponent = arg('--opponent', 'greedy'),
  games = Number(arg('--games', '500')),
  seed = Number(arg('--seed', '900001')),
  playerArg = arg('--players', 'mixed'),
  out = arg('--out', '');
const load = (v: string) =>
  v.endsWith('.json') ? (JSON.parse(fs.readFileSync(v, 'utf8')) as Model) : null;
const difficulty = arg('--difficulty', '') as Difficulty | '';
const banditMistakes = Number(arg('--bandit-mistakes', '0.15'));
const counts = playerArg === 'mixed' ? [2, 3, 4, 5, 6] : playerArg.split(',').map(Number);
if (!counts.length || counts.some((n) => !Number.isInteger(n) || n < 2 || n > 6))
  throw new Error('Player counts must be between 2 and 6.');
if (!Number.isInteger(games) || games < 1) throw new Error('Games must be a positive integer.');
const samples = Number(arg('--search', '0')),
  maxCandidates = Number(arg('--candidates', '6')),
  rollout = arg('--rollout', 'tactical') as 'tactical' | 'policy',
  expert = arg('--expert', 'false') === 'true',
  horizon = arg('--horizon', 'game') as 'game' | 'round';
let searchMs = 0,
  searchCount = 0;
const model = load(candidate),
  other = load(opponent),
  r = seeded(seed + 123),
  records: { players: number; seat: number; win: number; score: number; seed: number }[] = [];
const start = performance.now();
for (let game = 0; game < games; game++) {
  const players = counts[game % counts.length],
    seat = Math.floor(game / counts.length) % players,
    s = createGame({ players, expert, seed: seed + game * 31337 });
  let steps = 0;
  while (s.phase !== 'finished' && steps++ < 1500) {
    const legal = legalActions(s);
    if (legal.length === 1) {
      applyAction(s, legal[0], false);
      continue;
    }
    const o = observe(s, s.actor, false),
      isCandidate = s.actor === seat,
      m = isCandidate ? model : other,
      p = isCandidate ? candidate : opponent;
    let i: number;
    if (isCandidate && m && difficulty) {
      const started = performance.now();
      i = difficultyChoice(m, o, difficulty, r, banditMistakes);
      searchMs += performance.now() - started;
      searchCount++;
    } else if (isCandidate && m && samples) {
      const result = search(m, o, Math.floor(r() * 2 ** 32), {
        samples,
        maxCandidates,
        rollout,
        horizon,
      });
      i = result.index;
      searchMs += result.milliseconds;
      searchCount++;
    } else i = m ? modelChoice(m, o, r, 0.1) : baseline(o, p as Baseline, r);
    applyAction(s, legal[i], false);
  }
  if (s.phase !== 'finished') throw new Error('Nonterminating game');
  records.push({
    players,
    seat,
    win: s.winners.includes(seat) ? 1 / s.winners.length : 0,
    score: s.scores[seat],
    seed: s.seed,
  });
  if ((game + 1) % 10 === 0) process.stderr.write(`Evaluated ${game + 1}/${games}\n`);
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const summarize = (rs: typeof records) => {
  const wins = rs.reduce((a, b) => a + b.win, 0),
    rate = wins / rs.length,
    z = 1.96,
    den = 1 + (z * z) / rs.length,
    center = (rate + (z * z) / (2 * rs.length)) / den,
    half =
      (z * Math.sqrt((rate * (1 - rate)) / rs.length + (z * z) / (4 * rs.length * rs.length))) /
      den;
  return {
    games: rs.length,
    winRate: rate,
    approx95: [Math.max(0, center - half), Math.min(1, center + half)],
    chance: mean(rs.map((r) => 1 / r.players)),
    averageScore: mean(rs.map((r) => r.score)),
  };
};
const report = {
  candidate,
  opponent,
  seed,
  expert,
  difficulty: difficulty || undefined,
  banditMistakes: difficulty === 'bandit' ? banditMistakes : undefined,
  search: {
    samples: difficulty === 'legend' ? 8 : samples,
    maxCandidates: difficulty === 'legend' ? 3 : maxCandidates,
    rollout: difficulty === 'legend' ? 'policy' : rollout,
    horizon: difficulty === 'legend' ? 'round' : horizon,
    averageMs: searchCount ? searchMs / searchCount : 0,
  },
  seconds: (performance.now() - start) / 1000,
  overall: summarize(records),
  byPlayers: Object.fromEntries(
    [2, 3, 4, 5, 6]
      .filter((n) => records.some((r) => r.players === n))
      .map((n) => [n, summarize(records.filter((r) => r.players === n))]),
  ),
  records,
};
console.log(JSON.stringify({ ...report, records: undefined }, null, 2));
if (out) fs.writeFileSync(out, JSON.stringify(report, null, 2));
