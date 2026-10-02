import { ACTION_KINDS, type Action, type Observation } from '../game/types';
import { CHARACTERS } from '../game/data';
import { analyze, forecast, wealth, worth, potential } from './tactics';
export const STATE_DIM = 576,
  ACTION_DIM = 64,
  FEATURE_VERSION = 1;
const phases = ['choose', 'scheme', 'cover', 'retain', 'execute', 'event', 'roundEnd', 'finished'];
const events = [
  'none',
  'angryMarshal',
  'strongbox',
  'braking',
  'swivel',
  'rebellion',
  'pickpocket',
  'revenge',
  'hostage',
];
const turns = ['normal', 'tunnel', 'double', 'reverse'];
function pad(a: number[], n: number) {
  if (a.length > n) throw new Error(`Feature overflow ${a.length}/${n}`);
  while (a.length < n) a.push(0);
  return a;
}
export function stateFeatures(o: Observation): number[] {
  const f: number[] = [],
    own = o.viewer;
  f.push(
    ...phases.map((p) => +(o.phase === p)),
    o.round / 4,
    o.players.length / 6,
    +o.team,
    +o.expert,
    o.scheduleIndex / 30,
    o.executionIndex / 30,
    o.marshal / 6,
    o.neutralBullets / 13,
    ...events.map((e) => +(o.roundCard.event === e)),
  );
  for (let i = 0; i < 6; i++) {
    const b = o.bandits[i];
    if (!b) {
      f.push(...Array(22).fill(0));
      continue;
    }
    const p = o.players[b.controller];
    f.push(
      1,
      +(b.controller === own),
      b.car / 6,
      b.floor,
      b.shots / 6,
      b.creditedShots / 6,
      b.wounds / 12,
      wealth(b) / 4000,
      p.handCount / 16,
      p.deckCount / 24,
      ...CHARACTERS.map((c) => +(c === b.character)),
      ...ACTION_KINDS.map(
        (k) => (p.hand ?? []).filter((c) => c.bandit === b.id && c.kind === k).length / 3,
      ),
    );
  }
  for (let i = 0; i < 7; i++) {
    const c = o.cars[i];
    if (!c) {
      f.push(...Array(9).fill(0));
      continue;
    }
    f.push(
      1,
      ...[0, 1].flatMap((floor) => [
        c.loot[floor].filter((l) => l.kind === 'purse').length / 4,
        c.loot[floor].filter((l) => l.kind === 'jewel').length / 3,
        c.loot[floor].filter((l) => l.kind === 'strongbox').length / 2,
        o.bandits.filter((b) => b.car === i && b.floor === floor).length / 6,
      ]),
    );
  }
  for (let i = 0; i < 32; i++) {
    const q = o.queue[i];
    if (!q) {
      f.push(...Array(10).fill(0));
      continue;
    }
    f.push(
      1,
      +(q.controller === own),
      (q.bandit === null ? -1 : q.bandit) / 6,
      +q.hidden,
      ...ACTION_KINDS.map((k) => +(k === q.kind)),
    );
  }
  for (let i = 0; i < 5; i++) f.push(...turns.map((t) => +(o.roundCard.turns[i] === t)));
  return pad(f, STATE_DIM);
}
export function actionFeatures(o: Observation, a: Action, b = forecast(o)): number[] {
  const c = analyze(o, a, b),
    me = b.bandits[c.bandit],
    next = c.board.bandits[c.bandit],
    f: number[] = [];
  const kinds = [
    ...ACTION_KINDS,
    'draw',
    'choose',
    'keep',
    'discard',
    'pass',
    'continue',
    'bullet',
  ];
  f.push(...kinds.map((k) => +(c.kind === k)), ...CHARACTERS.map((k) => +(me.character === k)));
  f.push(
    c.score / 10,
    c.lootGain,
    c.enemyLoss,
    c.positionGain,
    c.wounds / 3,
    c.shots,
    next.car / 6,
    next.floor,
    me.car / 6,
    me.floor,
    potential(c.board, c.bandit) / 10,
    potential(b, c.bandit) / 10,
  );
  f.push(
    ...[0, 1].flatMap((floor) =>
      c.board.cars[next.car].loot[floor].length
        ? [
            Math.max(...c.board.cars[next.car].loot[floor].map(worth)) / 1000,
            c.board.cars[next.car].loot[floor].length / 6,
          ]
        : [0, 0],
    ),
  );
  f.push(
    +(next.car === c.board.marshal),
    +(a.kind === 'play' && a.hidden),
    o.schedule.slice(o.scheduleIndex + 1).filter((s) => s.controller === o.viewer).length / 6,
  );
  const hand = o.players[o.viewer].hand ?? [];
  f.push(
    ...ACTION_KINDS.map(
      (k) => hand.filter((x) => x.kind === k && (!('card' in a) || x.id !== a.card)).length / 4,
    ),
  );
  if ('target' in a) {
    const t = b.bandits[a.target];
    f.push(
      1,
      +(t.controller === o.viewer),
      t.car / 6,
      t.floor,
      t.shots / 6,
      t.wounds / 12,
      wealth(t) / 4000,
    );
  } else f.push(...Array(7).fill(0));
  f.push(
    o.round / 4,
    +o.team,
    +o.expert,
    +(o.phase === 'scheme' || o.phase === 'cover'),
    +(o.phase === 'execute'),
    next.shots / 6,
  );
  return pad(f, ACTION_DIM);
}
export function encode(o: Observation) {
  const b = forecast(o);
  return { state: stateFeatures(o), actions: o.legal.map((a) => actionFeatures(o, a, b)) };
}
