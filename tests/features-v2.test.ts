import { describe, it, expect } from 'vitest';
import { createGame, observe, applyAction } from '../src/game/engine';
import { encodeV2, STATE_DIM_V2, ACTION_DIM_V2, canonicalObservation } from '../src/ai/features-v2';
import { baseline } from '../src/ai/tactics';
import { seeded } from '../src/game/random';

describe('Strategic feature-v2 representation', () => {
  it('preserves finite complete observations throughout all variants', () => {
    for (const players of [2, 3, 4, 5, 6]) {
      const s = createGame({ players, expert: players > 2, seed: 816 + players }),
        r = seeded(712);
      while (s.phase !== 'finished') {
        const o = observe(s, s.actor, false),
          f = encodeV2(o),
          canonical = canonicalObservation(o);
        expect(canonical.viewer).toBe(0);
        expect(canonical.players[0].hand).not.toBeNull();
        expect(canonical.bandits[0].controller).toBe(0);
        expect(f.state).toHaveLength(STATE_DIM_V2);
        expect(f.state.every(Number.isFinite)).toBe(true);
        for (const a of f.actions) {
          expect(a).toHaveLength(ACTION_DIM_V2);
          expect(a.every(Number.isFinite)).toBe(true);
        }
        applyAction(s, o.legal[baseline(o, 'tactical', r)], false);
      }
    }
  });
  it('cannot see hidden hand/deck order or future rounds', () => {
    const s = createGame({ players: 4, seed: 817, firstPlayer: 0 }),
      before = encodeV2(observe(s, 0, false));
    [s.players[1].hand[0], s.players[1].deck[0]] = [s.players[1].deck[0], s.players[1].hand[0]];
    s.players[2].deck.reverse();
    s.seed = 42;
    s.rng = 817;
    s.rounds[4].event = 'revenge';
    expect(encodeV2(observe(s, 0, false))).toEqual(before);
  });
  it('distinguishes punch destinations and marshal directions explicitly', () => {
    const s = createGame({ players: 4, seed: 42, firstPlayer: 0 });
    s.bandits[0].car = 2;
    s.bandits[1].car = 2;
    s.marshal = 1;
    const o = observe(s, 0, false);
    o.phase = 'execute';
    o.queue = [{ controller: 0, bandit: 0, kind: 'punch', hidden: false, turn: 0, revealed: true }];
    o.executionIndex = 0;
    o.legal = [
      { kind: 'punch', target: 1, to: 1, loot: null },
      { kind: 'punch', target: 1, to: 3, loot: null },
    ];
    const punch = encodeV2(o).actions;
    expect(punch[0]).not.toEqual(punch[1]);
    o.queue[0].kind = 'marshal';
    o.legal = [
      { kind: 'marshal', to: 0 },
      { kind: 'marshal', to: 2 },
    ];
    const marshal = encodeV2(o).actions;
    expect(marshal[0]).not.toEqual(marshal[1]);
  });
  it('represents program cards beyond the old 32-card cutoff', () => {
    const s = createGame({ players: 6, seed: 818, firstPlayer: 0 }),
      o = observe(s, 0, false);
    o.phase = 'execute';
    o.queue = Array.from({ length: 40 }, () => ({
      controller: 1,
      bandit: 1,
      kind: 'move' as const,
      hidden: false,
      turn: 0,
      revealed: true,
    }));
    const before = encodeV2(o).state;
    o.queue[39].kind = 'climb';
    expect(encodeV2(o).state).not.toEqual(before);
  });
});
