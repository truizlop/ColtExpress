import { ACTION_KINDS, type Action, type Card, type Observation } from '../game/types';
import { CHARACTERS } from '../game/data';
import { stateFeatures, actionFeatures } from './features';
import { analyze, forecast, bestResolution, potential, wealth, worth, type Board } from './tactics';

export const STATE_DIM_V2 = 1280,
  ACTION_DIM_V2 = 192;
const cardKinds = [...ACTION_KINDS, 'bullet'];
const directKinds = [
  'play',
  'draw',
  'pass',
  'continue',
  'choose',
  'keep',
  'discard',
  ...ACTION_KINDS,
];
function pad(xs: number[], size: number) {
  if (xs.length > size) throw new Error(`Feature-v2 overflow ${xs.length}/${size}`);
  while (xs.length < size) xs.push(0);
  return xs;
}
/** Canonicalize seats, never information: the observer is always seat zero.
 * Card/loot IDs remain opaque references; random seeds and hidden state are absent.
 */
export function canonicalObservation(o: Observation): Observation {
  const n = o.players.length;
  const pid = (id: number) => (id - o.viewer + n) % n;
  const ordered = [...o.bandits].sort(
    (a, b) => pid(a.controller) - pid(b.controller) || a.id - b.id,
  );
  const bids = new Map(ordered.map((b, i) => [b.id, i]));
  const bid = (id: number) => bids.get(id) ?? id;
  const card = (c: Card): Card => ({
    ...c,
    bandit: bid(c.bandit),
    ...(c.source === undefined ? {} : { source: bid(c.source) }),
  });
  return {
    ...o,
    viewer: 0,
    actor: pid(o.actor),
    firstPlayer: pid(o.firstPlayer),
    coverBandit: bid(o.coverBandit),
    bandits: ordered.map((b, id) => ({ ...b, id, controller: pid(b.controller) })),
    players: [...o.players]
      .sort((a, b) => pid(a.id) - pid(b.id))
      .map((p) => ({
        ...p,
        id: pid(p.id),
        hand: p.hand?.map(card) ?? null,
        discard: p.discard.map(card),
        inventory: p.inventory.map((x) => ({
          ...x,
          bandit: bid(x.bandit),
          ...(x.source === undefined ? {} : { source: bid(x.source) }),
        })),
      })),
    schedule: o.schedule.map((s) => ({ ...s, controller: pid(s.controller) })),
    queue: o.queue.map((q) => ({
      ...q,
      controller: pid(q.controller),
      bandit: q.bandit === null ? null : bid(q.bandit),
    })),
    selectionCards: o.selectionCards.map(card),
    legal: o.legal.map((a) => ('target' in a ? { ...a, target: bid(a.target) } : a)),
    winners: o.winners.map(pid),
    scores: o.players.map((_, i) => o.scores[(i + o.viewer) % n] ?? 0),
  };
}
function boardFeatures(b: Board, o: Observation) {
  const f: number[] = [];
  for (let i = 0; i < 6; i++) {
    const p = b.bandits[i];
    if (!p) {
      f.push(...Array(14).fill(0));
      continue;
    }
    f.push(
      1,
      ...Array.from({ length: 7 }, (_, j) => +(p.car === j)),
      p.floor,
      p.shots / 6,
      p.wounds / 16,
      wealth(p) / 5000,
      potential(b, i) / 10,
      +(p.controller === 0),
    );
  }
  for (let i = 0; i < 7; i++)
    for (const floor of [0, 1] as const) {
      const ls = b.cars[i]?.loot[floor] ?? [];
      f.push(
        ls.reduce((t, l) => t + worth(l), 0) / 3000,
        Math.max(0, ...ls.map(worth)) / 1000,
        ls.length / 6,
        b.bandits.filter((p) => p.car === i && p.floor === floor && p.controller === 0).length / 2,
        b.bandits.filter((p) => p.car === i && p.floor === floor && p.controller !== 0).length / 5,
      );
    }
  for (let i = 0; i < 6; i++) {
    const p = o.players[i];
    if (!p) {
      f.push(...Array(18).fill(0));
      continue;
    }
    const known = [...(p.hand ?? []), ...p.discard];
    const queued = o.queue
      .slice(o.executionIndex)
      .filter((q) => q.controller === i && q.kind !== null);
    f.push(
      ...cardKinds.map(
        (k) => p.inventory.filter((x) => x.kind === k).reduce((t, x) => t + x.count, 0) / 12,
      ),
    );
    f.push(
      ...cardKinds.map(
        (k) =>
          (p.inventory.filter((x) => x.kind === k).reduce((t, x) => t + x.count, 0) -
            known.filter((c) => c.kind === k).length -
            queued.filter((q) => q.kind === k).length) /
          12,
      ),
    );
    f.push(+p.firstTurnUsed, p.handCount / 20, p.deckCount / 30, p.discard.length / 30);
  }
  return f;
}
export function encodeV2(raw: Observation) {
  const o = canonicalObservation(raw),
    b = forecast(o);
  const state = stateFeatures(o);
  state.push(...boardFeatures(b, o));
  // Preserve the complete possible program (up to 60 cards), including its tail.
  for (let i = 32; i < 64; i++) {
    const q = o.queue[i];
    state.push(
      ...(q
        ? [
            1,
            +(q.controller === 0),
            (q.bandit ?? -1) / 6,
            +q.hidden,
            ...ACTION_KINDS.map((k) => +(q.kind === k)),
          ]
        : Array(10).fill(0)),
    );
  }
  state.push(
    o.queue.length / 64,
    o.schedule.length / 60,
    ((o.firstPlayer - o.viewer + o.players.length) % o.players.length) / 6,
  );
  for (let i = 0; i < 6; i++) {
    state.push(o.schedule.slice(o.scheduleIndex).filter((s) => s.controller === i).length / 10);
    state.push(o.queue.slice(o.executionIndex).filter((q) => q.controller === i).length / 10);
  }
  const actions = o.legal.map((a) => extendedAction(o, a, b));
  return { state: pad(state, STATE_DIM_V2), actions };
}
function extendedAction(o: Observation, a: Action, b: Board) {
  const c = analyze(o, a, b),
    next = c.board.bandits[c.bandit],
    me = b.bandits[c.bandit];
  const f = actionFeatures(o, a, b, c);
  f.push(...directKinds.map((k) => +(a.kind === k)));
  f.push(...Array.from({ length: 7 }, (_, j) => +('to' in a && a.to === j)));
  const target = 'target' in a ? c.board.bandits[a.target] : undefined;
  f.push(
    ...Array.from({ length: 7 }, (_, j) => +(target?.car === j)),
    ...(target ? [+!target.floor, +target.floor] : [0, 0]),
  );
  f.push(
    ...Array.from({ length: 6 }, (_, j) => +(target?.controller === j)),
    ...CHARACTERS.map((k) => +(target?.character === k)),
  );
  const token =
    'loot' in a
      ? [...o.bandits.flatMap((x) => x.loot), ...o.cars.flatMap((x) => x.loot.flat())].find(
          (l) => l.id === a.loot,
        )
      : undefined;
  f.push(
    ...['purse', 'jewel', 'strongbox'].map((k) => +(token?.kind === k)),
    token ? worth(token) / 1000 : 0,
  );
  const hand = (o.players[0].hand ?? []).filter((x) => !('card' in a) || x.id !== a.card);
  for (const kind of ACTION_KINDS) {
    const available = hand.filter((x) => x.bandit === c.bandit && x.kind === kind).length;
    f.push(available / 3, available ? bestResolution(c.board, c.bandit, kind).value / 10 : 0);
  }
  for (let car = 0; car < 7; car++)
    for (const floor of [0, 1] as const) {
      const ls = c.board.cars[car]?.loot[floor] ?? [];
      const dist = Math.abs(car - next.car) / (next.floor ? 3 : 1) + +(floor !== next.floor);
      f.push(ls.length ? Math.max(...ls.map(worth)) / 1000 / (1 + dist) : 0);
    }
  for (let i = 0; i < 6; i++) {
    const p = c.board.bandits[i];
    f.push(...(p ? [p.car / 6, p.floor, wealth(p) / 5000, p.wounds / 16] : [0, 0, 0, 0]));
  }
  const shots = o.players.map((p) =>
    c.board.bandits.filter((x) => x.controller === p.id).reduce((t, x) => t + x.shots, 0),
  );
  f.push(
    c.board.marshal / 6,
    (shots[0] - Math.max(...shots.slice(1))) / 12,
    +('target' in a && o.bandits[a.target].controller === 0),
    next.car - me.car,
    (target?.car ?? 0) - ('target' in a ? b.bandits[a.target].car : 0),
  );
  return pad(f, ACTION_DIM_V2);
}
