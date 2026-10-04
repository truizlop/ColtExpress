import { assertInvariants, applyAction } from './game/engine';
import type { Action, GameState } from './game/types';
import type { Difficulty } from './ai/difficulty';

export interface MatchTrace {
  initial: GameState;
  fromStart: boolean;
  moves: { actor: number; action: Action; difficulty: Difficulty; modelVersion: string }[];
}
export interface MatchRecord extends MatchTrace {
  format: 'colt-express-match-v1';
  final: { scores: number[]; winners: number[] };
}
export function newMatchTrace(game: GameState, fromStart: boolean): MatchTrace {
  return { initial: structuredClone(game), fromStart, moves: [] };
}
export function completedMatch(trace: MatchTrace, game: GameState): MatchRecord {
  if (game.phase !== 'finished') throw new Error('Finish the heist before saving a match record.');
  return {
    format: 'colt-express-match-v1',
    ...structuredClone(trace),
    final: { scores: [...game.scores], winners: [...game.winners] },
  };
}
/** Offline diagnostic replay; hidden initial state is exported only after the game ends. */
export function replayMatch(record: MatchRecord): GameState {
  if (
    record.format !== 'colt-express-match-v1' ||
    !Array.isArray(record.moves) ||
    record.moves.length > 1500 ||
    !Array.isArray(record.final?.scores) ||
    !Array.isArray(record.final?.winners)
  )
    throw new Error('Invalid match record.');
  const game = structuredClone(record.initial);
  assertInvariants(game);
  for (const [i, move] of record.moves.entries()) {
    if (game.phase === 'finished' || move.actor !== game.actor)
      throw new Error(`Match record diverges at move ${i + 1}.`);
    applyAction(game, move.action);
  }
  if (
    game.phase !== 'finished' ||
    JSON.stringify(game.scores) !== JSON.stringify(record.final.scores) ||
    JSON.stringify(game.winners) !== JSON.stringify(record.final.winners)
  )
    throw new Error('Replayed outcome does not match the saved result.');
  return game;
}
