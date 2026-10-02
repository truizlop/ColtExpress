import readline from 'node:readline';
import fs from 'node:fs';
import { createGame, observe, applyAction, legalActions } from '../src/game/engine';
import { encode, stateFeatures } from '../src/ai/features';
import { baseline, teacherScores, type Baseline } from '../src/ai/tactics';
import { modelChoice, type Model } from '../src/ai/network';
import { seeded } from '../src/game/random';
import type { GameState } from '../src/game/types';
interface Env {
  id: number;
  episode: number;
  state: GameState;
  policies: string[];
  steps: number;
}
let envs: Env[] = [],
  episode = 0,
  rng = seeded(1),
  pool: Model[] = [],
  completed: unknown[] = [],
  runningSeed = 1;
function settle(e: Env) {
  while (e.state.phase !== 'finished') {
    const actions = legalActions(e.state);
    if (++e.steps > 1500) throw new Error('Episode exceeded safety limit.');
    if (actions.length === 1) {
      applyAction(e.state, actions[0], false);
      continue;
    }
    const policy = e.policies[e.state.actor];
    if (policy === 'learner') return;
    const o = observe(e.state, e.state.actor, false),
      i =
        policy === 'past' && pool.length
          ? modelChoice(pool[Math.floor(rng() * pool.length)], o, rng, 0.5)
          : baseline(o, policy as Baseline, rng);
    applyAction(e.state, actions[i], false);
  }
  completed.push({
    episode: e.episode,
    players: e.state.players.length,
    seed: e.state.seed,
    winners: e.state.winners,
    scores: e.state.scores,
    policies: e.policies,
  });
}
function response() {
  envs = envs.filter((e) => e.state.phase !== 'finished');
  const rows = envs.map((e) => {
    const o = observe(e.state, e.state.actor, false),
      f = encode(o);
    return {
      env: e.id,
      episode: e.episode,
      player: e.state.actor,
      players: e.state.players.length,
      state: f.state,
      actions: f.actions,
      teacher: teacherScores(o),
    };
  });
  const out = { rows, completed };
  completed = [];
  return out;
}
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of rl) {
  try {
    const msg = JSON.parse(line);
    if (msg.cmd === 'start') {
      envs = [];
      completed = [];
      rng = seeded(msg.seed ?? 1);
      runningSeed = msg.seed ?? 1;
      for (let id = 0; id < (msg.batch ?? 64); id++) {
        const players = msg.players ?? 2 + Math.floor(rng() * 5);
        const state = createGame({
          players,
          seed: runningSeed + id * 7919,
          expert: msg.expert ?? (players > 2 && rng() < 0.15),
        });
        const policies = state.players.map(() => {
          const r = rng();
          return msg.mode === 'imitation' || r < 0.65
            ? 'learner'
            : r < 0.76
              ? 'tactical'
              : r < 0.84
                ? 'greedy'
                : r < 0.92
                  ? 'aggressive'
                  : pool.length
                    ? 'past'
                    : 'tactical';
        });
        policies[Math.floor(rng() * players)] = 'learner';
        const e = { id, episode: episode++, state, policies, steps: 0 };
        settle(e);
        envs.push(e);
      }
      console.log(JSON.stringify(response()));
    } else if (msg.cmd === 'step') {
      const actions = new Map<number, number>(msg.choices);
      for (const e of envs) {
        if (!actions.has(e.id)) throw new Error('Missing action');
        const legal = legalActions(e.state),
          a = legal[actions.get(e.id)!];
        if (!a) throw new Error('Bad choice index');
        applyAction(e.state, a, false);
        settle(e);
      }
      console.log(JSON.stringify(response()));
    } else if (msg.cmd === 'pool') {
      pool = msg.paths.map((p: string) => JSON.parse(fs.readFileSync(p, 'utf8')));
      console.log(JSON.stringify({ ok: true, pool: pool.length }));
    } else if (msg.cmd === 'parity') {
      const m = JSON.parse(fs.readFileSync(msg.path, 'utf8')) as Model;
      const { inferEncoded } = await import('../src/ai/network');
      console.log(JSON.stringify(inferEncoded(m, msg.state, msg.actions)));
    } else if (msg.cmd === 'close') {
      break;
    } else throw new Error('Unknown command');
  } catch (error) {
    console.log(JSON.stringify({ error: String(error) }));
  }
}
