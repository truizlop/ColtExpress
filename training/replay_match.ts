/** Reproduce a human match locally without calling or retraining a policy. */
import fs from 'node:fs';
import { replayMatch, type MatchRecord } from '../src/matchRecord';
const path = process.argv[2];
if (!path) throw new Error('Usage: pnpm exec tsx training/replay_match.ts MATCH.json');
if (fs.statSync(path).size > 2_000_000) throw new Error('Match file exceeds 2 MB.');
const record = JSON.parse(fs.readFileSync(path, 'utf8')) as MatchRecord;
const result = replayMatch(record);
console.log(
  JSON.stringify(
    {
      valid: true,
      fromStart: record.fromStart,
      moves: record.moves.length,
      players: result.players.length,
      expert: result.config.expert,
      scores: result.scores,
      winners: result.winners,
      humanWon: result.winners.includes(0),
      modelVersions: [...new Set(record.moves.map((m) => m.modelVersion))],
      difficulties: [...new Set(record.moves.map((m) => m.difficulty))],
    },
    null,
    2,
  ),
);
