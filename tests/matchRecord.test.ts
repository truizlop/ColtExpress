import { describe, expect, it } from 'vitest';
import { createGame, observe, applyAction } from '../src/game/engine';
import { baseline } from '../src/ai/tactics';
import { seeded } from '../src/game/random';
import { newMatchTrace, completedMatch, replayMatch } from '../src/matchRecord';

describe('Human match feedback records', () => {
  it('replays complete games exactly across table sizes and expert rules', () => {
    for (const players of [2, 3, 4, 5, 6]) {
      const game = createGame({ players, expert: players > 2, seed: 71471 + players });
      const trace = newMatchTrace(game, true),
        rng = seeded(97);
      expect(() => completedMatch(trace, game)).toThrow('Finish the heist');
      while (game.phase !== 'finished') {
        const o = observe(game, game.actor, false),
          action = o.legal[baseline(o, 'tactical', rng)];
        trace.moves.push({ actor: game.actor, action, difficulty: 'legend', modelVersion: 'test' });
        applyAction(game, action);
      }
      const record = completedMatch(trace, game);
      expect(replayMatch(JSON.parse(JSON.stringify(record)))).toEqual(game);
      const tampered = structuredClone(record);
      tampered.moves[0].actor = (tampered.moves[0].actor + 1) % players;
      expect(() => replayMatch(tampered)).toThrow('diverges');
      tampered.moves = record.moves;
      tampered.final.scores[0] += 1;
      expect(() => replayMatch(tampered)).toThrow('outcome');
    }
  });
  it('can preserve the remainder of an older saved game without claiming a full replay', () => {
    const game = createGame({ players: 3, seed: 17 });
    const rng = seeded(291);
    let trace = newMatchTrace(game, true);
    while (game.phase !== 'finished') {
      const o = observe(game, game.actor, false),
        action = o.legal[baseline(o, 'tactical', rng)];
      trace.moves.push({ actor: game.actor, action, difficulty: 'bandit', modelVersion: 'test' });
      applyAction(game, action);
      if (game.round === 1 && trace.fromStart) trace = newMatchTrace(game, false);
    }
    const record = completedMatch(trace, game);
    expect(record.fromStart).toBe(false);
    expect(replayMatch(record)).toEqual(game);
  });
});
