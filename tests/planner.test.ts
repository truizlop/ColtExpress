import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { plan } from '../src/ai/planner';
import type { Model } from '../src/ai/network';
import { createGame, observe } from '../src/game/engine';
const model = JSON.parse(
  fs.readFileSync('experiments/v2/models/express64-release.json', 'utf8'),
) as Model;
describe('Broader information-set planner', () => {
  it('samples every candidate before pruning, keeps legal choices, and repeats with a seed', () => {
    const s = createGame({ players: 4, seed: 39211, firstPlayer: 0 }),
      o = observe(s, 0, false),
      before = JSON.stringify(o);
    const options = {
      worlds: 3,
      warmup: 1,
      finalists: 2,
      maxCandidates: 16,
      opponents: 'mixed' as const,
    };
    const a = plan(model, o, 921, options),
      b = plan(model, o, 921, options);
    expect(a.estimates).toHaveLength(o.legal.length);
    expect(
      a.estimates.every(
        (x) => x.samples >= 1 && Number.isFinite(x.value) && Number.isFinite(x.standardError),
      ),
    ).toBe(true);
    expect(a.estimates.filter((x) => x.finalist)).toHaveLength(2);
    expect(a.estimates.find((x) => x.index === a.index)?.finalist).toBe(true);
    expect(a.estimates).toEqual(b.estimates);
    expect(o.legal[a.index]).toBeDefined();
    expect(JSON.stringify(o)).toBe(before);
  });
  it('does not use the actual world seed, hidden hand allocation or future rounds', () => {
    const s = createGame({ players: 3, seed: 19, firstPlayer: 0 }),
      o = observe(s, 0, false);
    const options = { worlds: 2, warmup: 1, finalists: 2 };
    const a = plan(model, o, 64, options);
    s.rng = 183;
    s.seed = 81;
    s.players[1].deck.reverse();
    [s.players[1].hand[0], s.players[1].deck[0]] = [s.players[1].deck[0], s.players[1].hand[0]];
    s.rounds[4].event = 'revenge';
    expect(plan(model, observe(s, 0, false), 64, options).estimates).toEqual(a.estimates);
  });
});
