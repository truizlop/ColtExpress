import type { Action, ActionKind, Observation, VisibleLoot, Character } from '../game/types';
import { ACTION_KINDS } from '../game/types';
export interface Pawn {
  id: number;
  controller: number;
  character: Character;
  car: number;
  floor: 0 | 1;
  shots: number;
  wounds: number;
  loot: VisibleLoot[];
}
export interface Board {
  bandits: Pawn[];
  cars: { loot: [VisibleLoot[], VisibleLoot[]] }[];
  marshal: number;
  round: number;
  team: boolean;
}
export const worth = (l: VisibleLoot) => l.value ?? 375;
export const wealth = (b: Pawn) => b.loot.reduce((t, l) => t + worth(l), 0);
const copy = (b: Board): Board => ({
  bandits: b.bandits.map((x) => ({ ...x, loot: [...x.loot] })),
  cars: b.cars.map((c) => ({ loot: [[...c.loot[0]], [...c.loot[1]]] })),
  marshal: b.marshal,
  round: b.round,
  team: b.team,
});
export function publicBoard(o: Observation): Board {
  return {
    bandits: o.bandits.map((b) => ({ ...b, loot: [...b.loot] })),
    cars: o.cars.map((c) => ({ loot: [[...c.loot[0]], [...c.loot[1]]] })),
    marshal: o.marshal,
    round: o.round,
    team: o.team,
  };
}
function eligible(b: Board, bid: number, kind: 'shoot' | 'punch') {
  const me = b.bandits[bid];
  let out = b.bandits.filter((t) => {
    if (t.id === bid) return false;
    if (kind === 'punch') return t.car === me.car && t.floor === me.floor;
    if (me.shots >= 6) return false;
    if (me.character === 'tuco' && t.car === me.car && t.floor !== me.floor) return true;
    if (t.floor !== me.floor || t.car === me.car) return false;
    if (!me.floor) return Math.abs(t.car - me.car) === 1;
    return !b.bandits.some(
      (x) =>
        x.floor === 1 &&
        Math.sign(x.car - me.car) === Math.sign(t.car - me.car) &&
        Math.abs(x.car - me.car) > 0 &&
        Math.abs(x.car - me.car) < Math.abs(t.car - me.car),
    );
  });
  if (out.length > 1) out = out.filter((t) => t.character !== 'belle');
  return out;
}
export function resolutions(b: Board, bid: number, kind: ActionKind): Action[] {
  const me = b.bandits[bid],
    out: Action[] = [];
  if (kind === 'climb') return [{ kind: 'climb' }];
  if (kind === 'move')
    for (let to = 0; to < b.cars.length; to++)
      if (to !== me.car && Math.abs(to - me.car) <= (me.floor ? 3 : 1))
        out.push({ kind: 'move', to });
  if (kind === 'marshal')
    for (const to of [b.marshal - 1, b.marshal + 1])
      if (to >= 0 && to < b.cars.length) out.push({ kind: 'marshal', to });
  if (kind === 'shoot')
    for (const t of eligible(b, bid, 'shoot')) out.push({ kind: 'shoot', target: t.id });
  if (kind === 'loot')
    for (const l of b.cars[me.car].loot[me.floor]) out.push({ kind: 'loot', loot: l.id });
  if (kind === 'punch')
    for (const t of eligible(b, bid, 'punch'))
      for (const to of [t.car - 1, t.car + 1])
        if (to >= 0 && to < b.cars.length)
          for (const loot of t.loot.length ? t.loot.map((l) => l.id) : [null])
            out.push({ kind: 'punch', target: t.id, to, loot });
  return out.length ? out : [{ kind: 'pass' }];
}
export function potential(b: Board, bid: number) {
  const me = b.bandits[bid];
  let best = 0;
  for (let car = 0; car < b.cars.length; car++)
    for (const floor of [0, 1] as const) {
      const loot = b.cars[car].loot[floor];
      if (!loot.length) continue;
      const dist = Math.abs(car - me.car),
        travel =
          me.floor === floor
            ? floor
              ? Math.ceil(dist / 3)
              : dist
            : 1 + (me.floor || floor ? Math.ceil(dist / 3) : dist);
      const contest = b.bandits.filter(
        (t) =>
          t.id !== me.id && t.controller !== me.controller && t.car === car && t.floor === floor,
      ).length;
      const val =
        Math.max(...loot.map(worth)) / 100 / (1 + travel * 0.85 + contest * 0.35) -
        (car === b.marshal && floor === 0 ? 2 : 0);
      best = Math.max(best, val);
    }
  return best;
}
export function resolvePublic(b: Board, bid: number, a: Action) {
  const me = b.bandits[bid];
  if (a.kind === 'move') me.car = a.to;
  if (a.kind === 'climb') me.floor = me.floor ? 0 : 1;
  if (a.kind === 'marshal') b.marshal = a.to;
  if (a.kind === 'loot') {
    const ls = b.cars[me.car].loot[me.floor],
      i = ls.findIndex((l) => l.id === a.loot);
    if (i >= 0) me.loot.push(ls.splice(i, 1)[0]);
  }
  if (a.kind === 'shoot') {
    const t = b.bandits[a.target];
    me.shots++;
    t.wounds++;
    if (me.character === 'django')
      t.car = Math.max(0, Math.min(b.cars.length - 1, t.car + Math.sign(t.car - me.car)));
  }
  if (a.kind === 'punch') {
    const t = b.bandits[a.target],
      i = t.loot.findIndex((l) => l.id === a.loot);
    if (i >= 0) {
      const l = t.loot.splice(i, 1)[0];
      if (me.character === 'cheyenne' && l.kind === 'purse') me.loot.push(l);
      else b.cars[me.car].loot[me.floor].push(l);
    }
    t.car = a.to;
  }
  for (const t of b.bandits)
    if (t.car === b.marshal && t.floor === 0) {
      t.floor = 1;
      t.wounds++;
    }
}
function tacticalValue(b: Board, bid: number, a: Action): number {
  const me = b.bandits[bid];
  let v = 0;
  if (a.kind === 'pass') return -3;
  if (a.kind === 'loot')
    v =
      (b.cars[me.car].loot[me.floor].find((l) => l.id === a.loot)
        ? worth(b.cars[me.car].loot[me.floor].find((l) => l.id === a.loot)!)
        : 0) / 100;
  if (a.kind === 'shoot') {
    const t = b.bandits[a.target];
    if (t.controller === me.controller) return -6;
    const rivals = b.bandits.filter((t) => t.controller !== me.controller),
      max = Math.max(...rivals.map((t) => t.shots));
    v =
      0.8 +
      (4 - b.round) * 0.24 +
      (me.shots <= max ? (me.shots === max ? 2.1 : 1.7) : 0.7) +
      (wealth(t) > wealth(me) ? 0.4 : 0);
  }
  if (a.kind === 'punch') {
    const t = b.bandits[a.target],
      l = t.loot.find((l) => l.id === a.loot),
      value = l ? worth(l) / 100 : 0;
    v = t.controller === me.controller ? -value * 0.9 : value * 0.55 + 0.2;
    if (l?.kind === 'purse' && me.character === 'cheyenne') v += value;
    if (a.to === b.marshal && t.floor === 0)
      v += (t.controller === me.controller ? -1 : 1) * (4 - b.round) * 0.3;
  }
  if (a.kind === 'marshal') {
    v = b.bandits
      .filter((t) => t.car === a.to && t.floor === 0)
      .reduce((n, t) => n + (t.controller === me.controller ? -2 : 1.25), 0);
    if (b.marshal === me.car && me.floor === 1) v += 1;
  }
  const after = copy(b);
  resolvePublic(after, bid, a);
  const next = after.bandits[bid];
  const spatial = potential(after, bid) - potential(b, bid);
  v += spatial * 0.9;
  v -= (next.wounds - me.wounds) * (1 + (4 - b.round) * 0.25);
  if (a.kind === 'climb' && me.floor === 1 && next.floor === 0) v += 0.15;
  return v;
}
export function bestResolution(
  b: Board,
  bid: number,
  kind: ActionKind,
): { action: Action; value: number } {
  let best = { action: { kind: 'pass' } as Action, value: -Infinity };
  for (const action of resolutions(b, bid, kind)) {
    const value = tacticalValue(b, bid, action);
    if (value > best.value) best = { action, value };
  }
  return best;
}
export function forecast(o: Observation): Board {
  const b = publicBoard(o);
  if (o.phase !== 'scheme' && o.phase !== 'cover') return b;
  for (let i = o.executionIndex; i < o.queue.length; i++) {
    const q = o.queue[i];
    if (q.kind !== null && q.bandit !== null) {
      const a = bestResolution(b, q.bandit, q.kind).action;
      resolvePublic(b, q.bandit, a);
    }
  }
  return b;
}
export interface Candidate {
  score: number;
  bandit: number;
  kind: string;
  resolved: Action;
  board: Board;
  before: Board;
  lootGain: number;
  enemyLoss: number;
  positionGain: number;
  wounds: number;
  shots: number;
}
export function analyze(o: Observation, a: Action, b: Board): Candidate {
  let bid = o.bandits.find((t) => t.controller === o.viewer)!.id,
    kind: string = a.kind,
    resolved = a,
    score = 0;
  const hand = o.players[o.viewer].hand ?? [],
    c = 'card' in a ? [...hand, ...o.selectionCards].find((c) => c.id === a.card) : undefined;
  if (c) {
    bid = c.bandit;
    kind = c.kind;
  }
  if (o.phase === 'execute') bid = o.queue[o.executionIndex]?.bandit ?? bid;
  if (o.phase === 'event' && a.kind === 'loot') {
    const token = o.cars
      .flatMap((c, car) => c.loot.flatMap((ls, floor) => ls.map((l) => ({ l, car, floor }))))
      .find((x) => x.l.id === a.loot);
    bid =
      o.bandits.find(
        (t) => t.controller === o.viewer && t.car === token?.car && t.floor === token?.floor,
      )?.id ?? bid;
  }
  const remaining = o.schedule
    .slice(o.scheduleIndex + 1)
    .filter((s) => s.controller === o.viewer).length;
  if (a.kind === 'play' && c && c.kind !== 'bullet') {
    const choice = bestResolution(b, bid, c.kind);
    resolved = choice.action;
    score = choice.value;
    const useful = hand.filter((x) => x.kind !== 'bullet' && x.id !== c.id),
      lootCards = useful.filter((x) => x.kind === 'loot').length;
    if (c.kind === 'move' || c.kind === 'climb') {
      score += remaining > 0 ? (lootCards ? 0.75 : 0.1) : -0.5;
      if (o.round === 4 && remaining === 0) score -= 2.5;
    }
    if (a.hidden) score += 0.03;
  } else if (a.kind === 'draw') {
    const playable = hand.filter((c) => c.kind !== 'bullet').length;
    score =
      remaining === 0
        ? o.expert && o.round < 4
          ? 0.1
          : -10
        : playable === 0
          ? 5
          : playable < remaining
            ? 2.4
            : -0.4;
    if (o.players[o.viewer].deckCount === 0 && !o.expert) score = -12;
    if (!hand.some((c) => c.kind === 'loot') && remaining > 1) score += 0.65;
  } else if (a.kind === 'choose')
    score =
      c?.kind === 'loot'
        ? 5
        : c?.kind === 'shoot'
          ? 4
          : c?.kind === 'move'
            ? 3
            : c?.kind === 'climb'
              ? 2
              : 1;
  else if (a.kind === 'keep' || a.kind === 'discard') {
    score = c?.kind === 'bullet' ? (a.kind === 'keep' ? -5 : 5) : a.kind === 'keep' ? 1 : -1;
  } else if (a.kind === 'continue') score = 0;
  else score = tacticalValue(b, bid, a);
  const after = copy(b);
  resolvePublic(after, bid, resolved);
  const own = (board: Board) =>
      board.bandits.filter((t) => t.controller === o.viewer).reduce((n, t) => n + wealth(t), 0),
    enemy = (board: Board) =>
      board.bandits.filter((t) => t.controller !== o.viewer).reduce((n, t) => n + wealth(t), 0);
  return {
    score,
    bandit: bid,
    kind,
    resolved,
    board: after,
    before: b,
    lootGain: (own(after) - own(b)) / 1000,
    enemyLoss: (enemy(b) - enemy(after)) / 1000,
    positionGain: (potential(after, bid) - potential(b, bid)) / 10,
    wounds: after.bandits[bid].wounds - b.bandits[bid].wounds,
    shots: after.bandits[bid].shots - b.bandits[bid].shots,
  };
}
export type Baseline = 'random' | 'greedy' | 'tactical' | 'aggressive';
export function baseline(
  o: Observation,
  policy: Baseline = 'tactical',
  rng: () => number = Math.random,
): number {
  if (o.legal.length < 2) return 0;
  if (policy === 'random') return Math.floor(rng() * o.legal.length);
  const b = policy === 'greedy' ? publicBoard(o) : forecast(o);
  let best = -Infinity,
    chosen = 0;
  o.legal.forEach((a, i) => {
    const c = analyze(o, a, b);
    let v = c.score;
    if (policy === 'aggressive' && c.kind === 'shoot') v += 1.5;
    if (policy === 'greedy') v += c.lootGain * 3;
    v += rng() * 0.12;
    if (v > best) {
      best = v;
      chosen = i;
    }
  });
  return chosen;
}
export function teacherScores(o: Observation): number[] {
  const b = forecast(o);
  return o.legal.map((a) => analyze(o, a, b).score);
}
