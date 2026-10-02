import { describe, it, expect } from 'vitest';
import {
  createGame,
  legalActions,
  applyAction,
  observe,
  assertInvariants,
} from '../src/game/engine';
import { sampleWorld, search } from '../src/ai/search';
import fs from 'node:fs';
import type { Model } from '../src/ai/network';
import { seeded } from '../src/game/random';
describe('Information-set sampling', () => {
  it('samples complete, legal, conserved worlds across all player counts and deck rules', () => {
    const r = seeded(31415);
    let checked = 0;
    for (let game = 0; game < 25; game++) {
      const s = createGame({ players: 2 + (game % 5), expert: game % 2 === 0, seed: 12345 + game });
      while (s.phase !== 'finished') {
        if (['scheme', 'cover', 'execute'].includes(s.phase) && r() < 0.14) {
          const o = observe(s, s.actor),
            w = sampleWorld(o, Math.floor(r() * 2 ** 32));
          assertInvariants(w);
          expect(legalActions(w)).toEqual(o.legal);
          expect(observe(w, o.viewer).players[o.viewer].hand).toEqual(o.players[o.viewer].hand);
          checked++;
        }
        const actions = legalActions(s);
        applyAction(s, actions[Math.floor(r() * actions.length)], false);
      }
    }
    expect(checked).toBeGreaterThan(300);
  });
  it('does not use hidden deck order or the actual world seed', () => {
    const s = createGame({
        players: 4,
        characters: ['cheyenne', 'django', 'belle', 'tuco'],
        seed: 4321,
        firstPlayer: 0,
      }),
      a = observe(s, 0);
    s.rng = 22;
    s.seed = 1;
    s.players[1].deck.reverse();
    s.rounds[4].event = 'revenge';
    const b = observe(s, 0);
    expect(a).toEqual(b);
    expect(sampleWorld(a, 1234)).toEqual(sampleWorld(b, 1234));
  });
  it('makes repeatable legal neural-leaf search decisions without mutating observations', () => {
    const model = JSON.parse(fs.readFileSync('public/models/champion.json', 'utf8')) as Model;
    for (const players of [2, 3, 4, 5, 6]) {
      const s = createGame({ players, seed: 4242, firstPlayer: 0 });
      while (s.phase === 'choose') applyAction(s, legalActions(s)[0], false);
      const o = observe(s, s.actor),
        before = JSON.stringify(o);
      const options = {
        samples: 2,
        maxCandidates: 3,
        rollout: 'policy' as const,
        horizon: 'round' as const,
      };
      const a = search(model, o, 728, options),
        b = search(model, o, 728, options);
      expect(o.legal[a.index]).toBeDefined();
      expect(a.estimates).toEqual(b.estimates);
      expect(a.simulations).toBeGreaterThan(0);
      expect(a.estimates.every((e) => Number.isFinite(e.value))).toBe(true);
      expect(JSON.stringify(o)).toBe(before);
    }
  });
});
